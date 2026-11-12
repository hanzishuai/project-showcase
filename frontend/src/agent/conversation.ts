/**
 * 连续对话：唤醒后一直听，把每一句都交给数字人；回答完自动继续听，直到手动结束。
 *
 * 与 wake.ts 的分工：
 *   wake.ts 只负责匹配唤醒词；本模块负责唤醒后的多轮收音。
 *   两者都用 createWavRecorder + VAD，不碰 SDK 内部的录音状态，
 *   因此「点麦克风结束」可以做到立即停麦且不会误发一句提问。
 */
import { createWavRecorder } from '../../vendor/rag-avatar/rag-avatar.js'

export type ConversationStatus = 'off' | 'listening' | 'speech' | 'transcribing' | 'waiting' | 'error'

export interface ConversationOptions {
  apiBaseUrl?: string
  /** 返回 true 时暂停收音（数字人正在思考或播报） */
  shouldPause?: () => boolean
  /** 识别出一句话，交给调用方提问 */
  onTranscript: (text: string) => void
  onStatus?: (status: ConversationStatus, info?: { level?: number }) => void
  /** 麦克风不可用等致命错误；调用方应结束连续对话 */
  onFatal?: (message: string) => void
}

const SILENCE_MS = 900
const MAX_UTTERANCE_MS = 20000
const RESTART_DELAY_MS = 350
const PAUSE_RETRY_MS = 450
const MIN_AUDIO_BYTES = 6000
/** 一点人声都没听到就不送识别，避免安静时狂发 ASR 请求 */
const SPEECH_LEVEL = 0.03

export interface ConversationLoop {
  start: () => void
  stop: () => void
  readonly active: boolean
}

export function createConversationLoop(options: ConversationOptions): ConversationLoop {
  const apiBase = options.apiBaseUrl ?? ''
  let running = false
  let recording = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let recorder: ReturnType<typeof createWavRecorder> | null = null

  const setStatus: ConversationOptions['onStatus'] = (status, info) => options.onStatus?.(status, info)

  function shouldPause(): boolean {
    try {
      return options.shouldPause ? options.shouldPause() : false
    } catch {
      return false
    }
  }

  function clearTimer(): void {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  async function transcribe(blob: Blob): Promise<string> {
    const form = new FormData()
    form.append('file', blob, 'turn.wav')
    const response = await fetch(apiBase + '/api/v1/rag/asr', { method: 'POST', body: form })
    if (!response.ok) throw new Error('ASR HTTP ' + response.status)
    const data = await response.json().catch(() => ({}))
    return String(data.text || '')
  }

  async function listenOnce(): Promise<void> {
    if (!running || recording) return
    if (shouldPause()) {
      timer = setTimeout(() => void listenOnce(), PAUSE_RETRY_MS)
      return
    }
    recording = true
    setStatus('listening')

    let spoke = false
    let finished = false
    const rec = createWavRecorder({
      vad: { silenceMs: SILENCE_MS },
      onVadSilence: () => void finish(true),
      onLevel: (level: number) => {
        // 录音过程中数字人突然开始说话/思考：作废这一轮，避免把自己的声音当成用户提问
        if (shouldPause()) {
          void finish(false)
          return
        }
        if (level > SPEECH_LEVEL) {
          spoke = true
          setStatus('speech', { level })
        }
      }
    })
    recorder = rec

    const finish = async (submit = true): Promise<void> => {
      if (finished) return
      finished = true
      clearTimer()
      let blob: Blob | null = null
      try {
        blob = await rec.stop()
      } catch {
        blob = null
      }
      recording = false
      recorder = null
      if (!running) return

      if (submit && spoke && blob && blob.size >= MIN_AUDIO_BYTES) {
        setStatus('transcribing')
        try {
          const text = (await transcribe(blob)).trim()
          if (running && text) {
            setStatus('waiting')
            options.onTranscript(text)
          }
        } catch (error) {
          // 识别失败就继续听，不打断连续对话
          console.warn('[conversation] 识别失败', error)
        }
      }
      if (running) {
        timer = setTimeout(() => void listenOnce(), RESTART_DELAY_MS)
      }
    }

    try {
      await rec.start()
    } catch (error) {
      recording = false
      recorder = null
      running = false
      setStatus('error')
      options.onFatal?.(error instanceof Error ? error.message : '麦克风不可用')
      return
    }
    timer = setTimeout(() => void finish(), MAX_UTTERANCE_MS)
  }

  return {
    get active() {
      return running
    },
    start() {
      if (running) return
      running = true
      setStatus('listening')
      void listenOnce()
    },
    stop() {
      running = false
      clearTimer()
      try {
        recorder?.cancel?.()
      } catch {
        // 忽略
      }
      recorder = null
      recording = false
      setStatus('off')
    }
  }
}
