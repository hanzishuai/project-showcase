import { createAsrStreamSession, createWavRecorder, encodeWav } from '../../vendor/rag-avatar/rag-avatar.js'

export const WAKE_PHRASE = '你好豆姐'
export const INTERRUPT_PHRASE = '豆姐'
export type VoiceStatus = 'off' | 'wake' | 'listening' | 'recognizing' | 'answering' | 'error'

const SAMPLE_RATE = 16_000
const PRE_ROLL_SAMPLES = 4_800
const SILENCE_SAMPLES = 11_200
const MAX_TURN_SAMPLES = SAMPLE_RATE * 15
const REPLY_WINDOW_SAMPLES = SAMPLE_RATE * 3
const MIN_VOICED_SAMPLES = SAMPLE_RATE * 0.16
const ASR_NOISE_PHRASES = /^(?:thank you|thanks|okay|ok|嗯+)[.!?，。！？、…\s]*$/i
const NAME = /[豆窦][，,、\s]*[姐杰]/
const ADDRESS = /^[豆窦][，,、\s]*[姐杰]/
const WAKE = /(?:你[好号][，,。！!？?、\s]*)?[豆窦][，,、\s]*[姐杰](?:[，,。！!？?、\s]*你[好号])?/
const GOODBYE = /(?:再见|拜拜|拜了|回头见|下次见).*?[豆窦][，,、\s]*[姐杰]|[豆窦][，,、\s]*[姐杰].*?(?:再见|拜拜|拜了|回头见|下次见)/

function commandAfter(text: string, phrase: RegExp): string | null {
  const match = phrase.exec(text)
  return match ? text.slice(match.index + match[0].length).replace(/^[，,。！!？?、\s]+/, '').trim() : null
}

export function extractWakeCommand(text: string): string | null {
  return commandAfter(text, WAKE)
}

type Recognition = ReturnType<typeof createAsrStreamSession>
type VoiceTurn = {
  controller: AbortController
  recognizer: Recognition
  ready: Promise<boolean>
  chunks: Int16Array[]
  samples: number
  quiet: number
  voicedSamples: number
  duringReply: boolean
  duringAcknowledgement: boolean
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
  isNarrating?: () => boolean
  onInterrupt: () => void
  onQuestion: (text: string, signal: AbortSignal) => Promise<void>
  onAcknowledge: (text: string, signal: AbortSignal) => Promise<void>
}) {
  let session: AbortController | null = null
  let recorder: ReturnType<typeof createWavRecorder> | null = null
  let collecting: VoiceTurn | null = null
  let recognizing: VoiceTurn | null = null
  let output: AbortController | null = null
  const state: { mode: 'waiting' | 'active'; acknowledgement: AbortController | null } = { mode: 'waiting', acknowledgement: null }
  let preRoll: Int16Array[] = []
  let preRollSize = 0

  function stop() {
    session?.abort()
    session = null
    output?.abort()
    output = null
    state.mode = 'waiting'
    state.acknowledgement = null
    collecting?.controller.abort()
    recognizing?.controller.abort()
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
    return !!output || options.isAssistantBusy() || !!options.isNarrating?.()
  }

  function interrupt(turn: VoiceTurn, text: string) {
    if ((state.mode !== 'active' && !options.isNarrating?.()) || state.acknowledgement ||
        turn.duringAcknowledgement || !turn.duringReply || turn.interrupted || !NAME.test(text)) return
    state.mode = 'active'
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
        state.acknowledgement = reply
        try { await options.onAcknowledge(acknowledgement, replySignal) }
        finally { if (state.acknowledgement === reply) state.acknowledgement = null }
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
        if (!signal.aborted && !reply.signal.aborted) options.onStatus(state.mode === 'active' ? 'listening' : 'wake')
      }
    }
  }

  function handleText(turn: VoiceTurn, text: string, signal: AbortSignal) {
    if (!text || signal.aborted || turn.duringAcknowledgement || (turn.voicedSamples < SAMPLE_RATE * 0.5 && ASR_NOISE_PHRASES.test(text.trim()))) return
    if (state.mode !== 'active') {
      interrupt(turn, text)
    }
    if (state.mode !== 'active') {
      if (GOODBYE.test(text)) return
      const question = extractWakeCommand(text)
      if (question === null || busy()) return
      state.mode = 'active'
      void respond(signal, question, '你好，我在')
      return
    }
    if (turn.duringReply) {
      if (state.acknowledgement) return
      interrupt(turn, text)
      if (!turn.interrupted) return
    }
    if (GOODBYE.test(text)) {
      state.mode = 'waiting'
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
    const turnSignal = AbortSignal.any([signal, turn.controller.signal])
    if (turn.voicedSamples < MIN_VOICED_SAMPLES && !turn.interrupted) {
      turn.recognizer.dispose()
      recognizing = null
      if (!signal.aborted && !busy()) options.onStatus(state.mode === 'active' ? 'listening' : 'wake')
      return
    }
    if (!busy() || turn.interrupted) options.onStatus('recognizing')
    try {
      let text = ''
      try {
        if (await turn.ready && !turnSignal.aborted) text = (await turn.recognizer.stop()).trim()
      } catch {
        // The same utterance can be recovered through the upload endpoint.
      }
      if (!text && !turnSignal.aborted) {
        try { text = await recognizeWav(turn, turnSignal) }
        catch (error) { if (!turn.interrupted || !turn.partial) throw error }
      }
      if (!turnSignal.aborted) handleText(turn, text || turn.partial, signal)
    } catch (error) {
      if (!turnSignal.aborted) fail(signal, error instanceof Error ? error.message : '语音识别失败')
    } finally {
      turn.recognizer.dispose()
      if (recognizing === turn) recognizing = null
      if (!signal.aborted && !collecting && !recognizing && !busy()) options.onStatus(state.mode === 'active' ? 'listening' : 'wake')
    }
  }

  function record(chunk: Int16Array, signal: AbortSignal) {
    if (signal.aborted) return
    const energy = chunk.reduce((sum, sample) => sum + sample * sample, 0)
    const voiced = energy > chunk.length * (32768 * 0.012) ** 2

    if (!collecting && voiced && recognizing && busy() && !recognizing.interrupted) {
      recognizing.controller.abort()
      recognizing.recognizer.dispose()
      recognizing = null
    }
    if (!collecting && voiced && !recognizing && (state.mode === 'active' || options.isNarrating?.() || !busy())) {
      const controller = new AbortController()
      const recognizer = createAsrStreamSession({
        apiBaseUrl: '', signal: AbortSignal.any([signal, controller.signal]), connectTimeoutMs: 3000, finalTimeoutMs: 15000,
        onPartial(text: string) {
          if (signal.aborted || (collecting !== turn && recognizing !== turn)) return
          turn.partial = text
          interrupt(turn, text)
        }
      })
      const turn: VoiceTurn = {
        controller, recognizer, ready: recognizer.open().then(() => true, () => false),
        chunks: preRoll, samples: preRollSize, quiet: 0, voicedSamples: 0,
        duringReply: busy(), duringAcknowledgement: !!state.acknowledgement, interrupted: false, partial: ''
      }
      collecting = turn
      for (const pending of preRoll) recognizer.push(pending)
      preRoll = []
      preRollSize = 0
    }

    const turn = collecting
    if (turn) {
      // A typed question may start after this turn began.
      if (state.acknowledgement) turn.duringAcknowledgement = true
      if (busy() && !turn.interrupted) turn.duringReply = true
      turn.chunks.push(chunk)
      turn.samples += chunk.length
      if (voiced) turn.voicedSamples += chunk.length
      turn.quiet = voiced ? 0 : turn.quiet + chunk.length
      turn.recognizer.push(chunk)
      const replyWindowEnded = turn.duringReply && !turn.interrupted && turn.samples >= REPLY_WINDOW_SAMPLES
      if (replyWindowEnded) {
        preRoll = []
        preRollSize = 0
        for (let i = turn.chunks.length - 1; i >= 0 && preRollSize < PRE_ROLL_SAMPLES; i--) {
          preRoll.unshift(turn.chunks[i])
          preRollSize += turn.chunks[i].length
        }
      }
      if (turn.quiet >= SILENCE_SAMPLES || turn.samples >= MAX_TURN_SAMPLES || replyWindowEnded) void finish(turn, signal)
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
