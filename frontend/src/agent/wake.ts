/**
 * 语音唤醒：常驻听麦克风，听到唤醒词就回调。
 *
 * 做法（不依赖任何云端唤醒词服务）：
 *   开麦 → 静音 700ms 自动结束一句 → 上传 /api/v1/rag/asr 转文字 →
 *   匹配唤醒词（默认「你好你好」）→ 触发回调 → 继续监听。
 *
 * 说明：被判成「一句」的音频才会送识别，没人说话时不会产生请求。
 */
import { createWavRecorder } from '../../vendor/rag-avatar/rag-avatar.js'

export type WakeStatus = 'off' | 'listening' | 'speech' | 'transcribing' | 'detected' | 'error'

export interface WakeDetectorOptions {
  apiBaseUrl?: string
  phrase?: string
  /** 返回 true 时暂停监听（例如数字人正在播报/回答） */
  shouldPause?: () => boolean
  onWake: (transcript: string) => void
  onStatus?: (status: WakeStatus, info?: { transcript?: string; level?: number }) => void
}

export const DEFAULT_PHRASE = '你好你好'
/** 唤醒词变更事件：设置页保存后，常驻浮层立即更新提示文案。 */
export const WAKE_PHRASE_EVENT = 'agent-wake-phrase'
const SILENCE_MS = 700
const MAX_UTTERANCE_MS = 6000
const RESTART_DELAY_MS = 250
const MIN_AUDIO_BYTES = 4000
/** 一点人声都没有就不送识别，避免安静时每个 VAD 片段都发一次 ASR */
const SPEECH_LEVEL = 0.03
const PHRASE_STORAGE_KEY = 'agent-wake-phrase'

function normalize(text: string): string {
  return (text || '').replace(/[^\u4e00-\u9fa5]/g, '')
}

/** 是否命中唤醒词：支持「你好你好」以及被识别成「你好，你好」的情况。 */
export function matchesWakePhrase(transcript: string, phrase: string): boolean {
  const clean = normalize(transcript)
  const target = normalize(phrase)
  if (!clean || !target) return false
  if (clean.includes(target)) return true
  if (target === '你好你好') {
    const hits = clean.match(/你好/g)
    return !!hits && hits.length >= 2
  }
  return false
}

export function getWakePhrase(): string {
  try {
    return localStorage.getItem(PHRASE_STORAGE_KEY) || DEFAULT_PHRASE
  } catch {
    return DEFAULT_PHRASE
  }
}

/** 保存唤醒词（本浏览器），并通知常驻浮层立即更新提示文案。 */
export function setWakePhrase(phrase: string): void {
  const next = (phrase || '').trim() || DEFAULT_PHRASE
  try {
    localStorage.setItem(PHRASE_STORAGE_KEY, next)
  } catch {
    // 忽略
  }
  try {
    window.dispatchEvent(new CustomEvent(WAKE_PHRASE_EVENT, { detail: next }))
  } catch {
    // 忽略
  }
}

export interface WakeDetector {
  start: () => Promise<void>
  stop: () => void
  readonly active: boolean
}

export function createWakeWordDetector(options: WakeDetectorOptions): WakeDetector {
  const apiBase = options.apiBaseUrl ?? ''
  let running = false
  let recording = false
  let pausedUntil = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let recorder: ReturnType<typeof createWavRecorder> | null = null

  const setStatus: WakeDetectorOptions['onStatus'] = (status, info) => options.onStatus?.(status, info)

  function shouldPause(): boolean {
    if (Date.now() < pausedUntil) return true
    try {
      return options.shouldPause ? options.shouldPause() : false
    } catch {
      return false
    }
  }

  async function transcribe(blob: Blob): Promise<string> {
    const form = new FormData()
    form.append('file', blob, 'wake.wav')
    const response = await fetch(apiBase + '/api/v1/rag/asr', { method: 'POST', body: form })
    if (!response.ok) throw new Error('ASR HTTP ' + response.status)
    const data = await response.json().catch(() => ({}))
    return String(data.text || '')
  }

  async function listenOnce(): Promise<void> {
    if (!running || recording) return
    if (shouldPause()) {
      timer = setTimeout(() => void listenOnce(), 500)
      return
    }
    recording = true
    setStatus('listening')

    let finished = false
    let spoke = false
    const rec = createWavRecorder({
      vad: { silenceMs: SILENCE_MS },
      onVadSilence: () => void finish(),
      onLevel: (level: number) => {
        if (level > SPEECH_LEVEL) spoke = true
        if (level > 0.08) setStatus('speech', { level })
      }
    })
    recorder = rec

    const finish = async (): Promise<void> => {
      if (finished) return
      finished = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      let blob: Blob | null = null
      try {
        blob = await rec.stop()
      } catch {
        blob = null
      }
      recording = false
      recorder = null
      if (!running) return

      if (spoke && blob && blob.size >= MIN_AUDIO_BYTES) {
        setStatus('transcribing')
        try {
          const text = await transcribe(blob)
          const phrase = getWakePhrase() || options.phrase || DEFAULT_PHRASE
          if (matchesWakePhrase(text, phrase)) {
            setStatus('detected', { transcript: text })
            options.onWake(text)
            pausedUntil = Date.now() + 9000 // 唤醒后先把麦克风让给数字人录音
          }
        } catch {
          // 识别失败就继续听，不打断
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
      setStatus('error')
      console.warn('[wake] 麦克风不可用', error)
      return
    }
    timer = setTimeout(() => void finish(), MAX_UTTERANCE_MS)
  }

  return {
    get active() {
      return running
    },
    async start() {
      if (running) return
      running = true
      await listenOnce()
    },
    stop() {
      running = false
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
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
