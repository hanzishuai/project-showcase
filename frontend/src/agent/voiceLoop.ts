import { createAsrStreamSession, createWavRecorder, encodeWav } from '../../vendor/rag-avatar/rag-avatar.js'

export const WAKE_PHRASE = '你好豆姐'
export const INTERRUPT_PHRASE = '豆姐'
export type VoiceStatus = 'off' | 'wake' | 'listening' | 'recognizing' | 'answering' | 'error'

const SAMPLE_RATE = 16_000
const PRE_ROLL_SAMPLES = 4_800
const SILENCE_SAMPLES = 11_200
const MAX_TURN_SAMPLES = SAMPLE_RATE * 15
const NAME = /[豆窦][，,、\s]*[姐杰]/
const ADDRESS = /^[豆窦][，,、\s]*[姐杰]/
const WAKE = /你[好号][，,。！!？?、\s]*[豆窦][，,、\s]*[姐杰]/
const GOODBYE = /再见[，,。！!？?、\s]*[豆窦][，,、\s]*[姐杰]/

function commandAfter(text: string, phrase: RegExp): string | null {
  const match = phrase.exec(text)
  return match ? text.slice(match.index + match[0].length).replace(/^[，,。！!？?、\s]+/, '').trim() : null
}

export function extractWakeCommand(text: string): string | null {
  return commandAfter(text, WAKE)
}

type Recognition = ReturnType<typeof createAsrStreamSession>
type VoiceTurn = {
  recognizer: Recognition
  ready: Promise<boolean>
  chunks: Int16Array[]
  samples: number
  quiet: number
  duringReply: boolean
  interrupted: boolean
  partial: string
}

async function recognizeWav(turn: VoiceTurn, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted()
  const pcm = new Int16Array(turn.samples)
  let offset = 0
  for (const chunk of turn.chunks) {
    pcm.set(chunk, offset)
    offset += chunk.length
  }
  const form = new FormData()
  form.append('file', encodeWav(pcm, SAMPLE_RATE), 'voice.wav')
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch('/api/v1/rag/asr', {
        method: 'POST', body: form, signal: AbortSignal.any([signal, AbortSignal.timeout(8000)])
      })
      if (response.ok) return String((await response.json()).text || '').trim()
      if (response.status < 500 || attempt === 1) {
        return Promise.reject(new Error('语音识别服务不可用（' + response.status + '）'))
      }
    } catch (error) {
      if (signal.aborted || attempt === 1) throw error
    }
  }
}

export function createVoiceLoop(options: {
  onStatus: (status: VoiceStatus, detail?: string) => void
  isAssistantBusy: () => boolean
  onInterrupt: () => void
  onQuestion: (text: string, signal: AbortSignal) => Promise<void>
  onAcknowledge: (text: string, signal: AbortSignal) => Promise<void>
}) {
  let session: AbortController | null = null
  let recorder: ReturnType<typeof createWavRecorder> | null = null
  let collecting: VoiceTurn | null = null
  let recognizing: VoiceTurn | null = null
  let output: AbortController | null = null
  let awake = false
  let preRoll: Int16Array[] = []
  let preRollSize = 0

  function stop() {
    session?.abort()
    session = null
    output?.abort()
    output = null
    awake = false
    collecting?.recognizer.dispose()
    recognizing?.recognizer.dispose()
    collecting = null
    recognizing = null
    recorder?.dispose()
    recorder = null
    preRoll = []
    preRollSize = 0
    options.onStatus('off')
  }

  function fail(signal: AbortSignal, detail: string) {
    if (signal.aborted) return
    stop()
    options.onStatus('error', detail)
  }

  function busy() {
    return !!output || options.isAssistantBusy()
  }

  function interrupt(turn: VoiceTurn, text: string) {
    if (!awake || !turn.duringReply || turn.interrupted || !NAME.test(text)) return
    turn.interrupted = true
    output?.abort()
    options.onInterrupt()
    options.onStatus('recognizing')
  }

  async function respond(signal: AbortSignal, question: string, acknowledgement = '') {
    const reply = new AbortController()
    output = reply
    const replySignal = AbortSignal.any([signal, reply.signal])
    try {
      if (acknowledgement) {
        options.onStatus('answering', acknowledgement)
        await options.onAcknowledge(acknowledgement, replySignal)
      }
      if (question && !replySignal.aborted) {
        options.onStatus('answering')
        await options.onQuestion(question, replySignal)
      }
    } catch (error) {
      if (!replySignal.aborted) fail(signal, error instanceof Error ? error.message : '语音对话失败')
    } finally {
      if (output === reply) {
        output = null
        if (!signal.aborted && !reply.signal.aborted) options.onStatus(awake ? 'listening' : 'wake')
      }
    }
  }

  function handleText(turn: VoiceTurn, text: string, signal: AbortSignal) {
    if (!text || signal.aborted) return
    if (!awake) {
      const question = extractWakeCommand(text)
      if (question === null || busy()) return
      awake = true
      void respond(signal, question, '你好，我在')
      return
    }
    if (turn.duringReply) {
      interrupt(turn, text)
      if (!turn.interrupted) return
    }
    if (GOODBYE.test(text)) {
      awake = false
      void respond(signal, '', '好的，再见')
      return
    }
    const command = turn.interrupted
      ? commandAfter(text, NAME)
      : extractWakeCommand(text) ?? commandAfter(text, ADDRESS)
    const question = command ?? (turn.interrupted ? '' : text)
    if (!busy() || turn.interrupted) {
      if (question) void respond(signal, question)
      else if (command !== null || turn.interrupted) void respond(signal, '', '我在')
    }
  }

  async function finish(turn: VoiceTurn, signal: AbortSignal) {
    collecting = null
    recognizing = turn
    if (!busy() || turn.interrupted) options.onStatus('recognizing')
    try {
      let text = ''
      try {
        if (await turn.ready && !signal.aborted) text = (await turn.recognizer.stop()).trim()
      } catch {
        // The same utterance can be recovered through the upload endpoint.
      }
      if (!text && !signal.aborted) {
        try { text = await recognizeWav(turn, signal) }
        catch (error) { if (!turn.interrupted || !turn.partial) throw error }
      }
      handleText(turn, text || turn.partial, signal)
    } catch (error) {
      fail(signal, error instanceof Error ? error.message : '语音识别失败')
    } finally {
      turn.recognizer.dispose()
      if (recognizing === turn) recognizing = null
      if (!signal.aborted && !busy()) options.onStatus(awake ? 'listening' : 'wake')
    }
  }

  function record(chunk: Int16Array, signal: AbortSignal) {
    if (signal.aborted) return
    const energy = chunk.reduce((sum, sample) => sum + sample * sample, 0)
    const voiced = energy > chunk.length * (32768 * 0.012) ** 2

    if (!collecting && voiced && !recognizing && (awake || !busy())) {
      const recognizer = createAsrStreamSession({
        apiBaseUrl: '', signal, connectTimeoutMs: 3000, finalTimeoutMs: 2500,
        onPartial(text: string) {
          if (signal.aborted || (collecting !== turn && recognizing !== turn)) return
          turn.partial = text
          interrupt(turn, text)
        }
      })
      const turn: VoiceTurn = {
        recognizer, ready: recognizer.open().then(() => true, () => false),
        chunks: preRoll, samples: preRollSize, quiet: 0,
        duringReply: busy(), interrupted: false, partial: ''
      }
      collecting = turn
      for (const pending of preRoll) recognizer.push(pending)
      preRoll = []
      preRollSize = 0
    }

    const turn = collecting
    if (turn) {
      // A typed question may start after this turn began.
      if (busy() && !turn.interrupted) turn.duringReply = true
      turn.chunks.push(chunk)
      turn.samples += chunk.length
      turn.quiet = voiced ? 0 : turn.quiet + chunk.length
      turn.recognizer.push(chunk)
      if (turn.quiet >= SILENCE_SAMPLES || turn.samples >= MAX_TURN_SAMPLES) void finish(turn, signal)
      return
    }

    preRoll.push(chunk)
    preRollSize += chunk.length
    while (preRollSize > PRE_ROLL_SAMPLES && preRoll.length > 1) preRollSize -= preRoll.shift()!.length
  }

  return {
    async start() {
      if (session) return
      const { signal } = session = new AbortController()
      const capture = recorder = createWavRecorder({
        sampleRate: SAMPLE_RATE, pcmChunkMs: 80, vad: false, streamOnly: true,
        onPcmChunk: (chunk: Int16Array) => record(chunk, signal)
      })
      try {
        await capture.start()
        if (!signal.aborted) options.onStatus('wake')
      } catch (error) {
        fail(signal, error instanceof Error ? error.message : '无法开启麦克风')
      }
    },
    stop,
    get active() { return !!session }
  }
}
