import { createWavRecorder, createAsrStreamSession } from '../../vendor/rag-avatar/rag-avatar.js'

export const WAKE_PHRASE = '你好豆姐'
export type VoiceStatus = 'off' | 'wake' | 'listening' | 'recognizing' | 'answering' | 'error'
export function extractWakeCommand(text: string): string | null {
  const match = text.match(/你[好号][，,。！!？?、\s]*[豆窦][姐杰]/)
  if (!match || match.index === undefined) return null
  return text.slice(match.index + match[0].length).replace(/^[，,。！!？?、\s]+/, '').trim()
}

export function isGoodbye(text: string): boolean {
  return /再见[，,。！!？?、\s]*[豆窦][姐杰]/.test(text)
}

export function createVoiceLoop(options: {
  onStatus: (status: VoiceStatus, detail?: string) => void
  shouldPause: () => boolean
  onQuestion: (text: string, signal: AbortSignal) => Promise<string | null | void>
  onWakeDetected?: (command: string) => void
  onAcknowledge: (text: string, signal: AbortSignal) => Promise<void>
}) {
  let active = false
  let awake = false
  let generation = 0
  let recorder: ReturnType<typeof createWavRecorder> | null = null
  let stream: ReturnType<typeof createAsrStreamSession> | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let controller: AbortController | null = null
  const clearTimer = () => { if (timer !== null) clearTimeout(timer); timer = null }
  function stop() {
    active = false
    awake = false
    generation++
    clearTimer()
    controller?.abort()
    controller = null
    recorder?.cancel()
    recorder = null
    stream?.cancel()
    stream?.dispose()
    stream = null
    options.onStatus('off')
  }
  async function listen(run: number): Promise<void> {
    if (!active || run !== generation) return
    if (options.shouldPause()) {
      timer = setTimeout(() => void listen(run), 500)
      return
    }
    options.onStatus(awake ? 'listening' : 'wake')
    let spoken = false
    let finished = false
    let liveAsr: ReturnType<typeof createAsrStreamSession> | null = null
    if (options.onWakeDetected) {
      liveAsr = createAsrStreamSession({
        apiBaseUrl: '',
        onPartial(text: string) {
          if (!active || run !== generation || finished) return
          if (extractWakeCommand(text) !== null) options.onWakeDetected?.('')
        }
      })
      stream = liveAsr
      void liveAsr.open().catch(() => {})
    }
    const rec = createWavRecorder({
      onPcmChunk: liveAsr ? (samples: Int16Array) => liveAsr?.push(samples) : undefined,
      vad: { enabled: true, silenceMs: 900 },
      onLevel: (level: number) => {
        if (options.shouldPause()) { void finish(false); return }
        if (level > 0.03) spoken = true
      },
      onVadSilence: () => void finish()
    })
    recorder = rec
    async function finish(submit = true) {
      if (finished) return
      finished = true
      clearTimer()
      let wav: Blob
      try { wav = await rec.stop() } catch { rec.dispose(); return }
      rec.dispose()
      liveAsr?.cancel()
      liveAsr?.dispose()
      if (stream === liveAsr) stream = null
      if (recorder === rec) recorder = null
      if (!active || run !== generation) return
      if (!submit || options.shouldPause() || !spoken || wav.size < 4000) {
        timer = setTimeout(() => void listen(run), 350)
        return
      }
      options.onStatus('recognizing')
      const requestController = new AbortController()
      controller = requestController
      try {
        const form = new FormData()
        form.append('file', wav, 'voice.wav')
        const response = await fetch('/api/v1/rag/asr', { method: 'POST', body: form, signal: requestController.signal })
        if (!response.ok) throw new Error('语音识别服务不可用（' + response.status + '）')
        const text = String((await response.json()).text || '').trim()
        if (!active || run !== generation) return
        let question = text
        if (!awake) {
          const command = extractWakeCommand(text)
          if (command === null) { timer = setTimeout(() => void listen(run), 350); return }
          if (options.onWakeDetected) {
            options.onWakeDetected(command)
            return
          }
          awake = true
          question = command
          options.onStatus('answering', '你好，我在')
          await options.onAcknowledge('你好，我在', requestController.signal)
          if (!active || run !== generation) return
        }
        if (awake && isGoodbye(question)) {
          awake = false
          options.onStatus('answering', '好的，再见')
          await options.onAcknowledge('好的，再见', requestController.signal)
          if (active && run === generation) timer = setTimeout(() => void listen(run), 800)
          return
        }
        while (question && active && run === generation) {
          options.onStatus('answering')
          const interruptedCommand = await options.onQuestion(question, requestController.signal)
          if (!active || run !== generation || interruptedCommand == null) break
          options.onStatus('answering', '你好，我在')
          await options.onAcknowledge('你好，我在', requestController.signal)
          if (!active || run !== generation) return
          question = interruptedCommand
          if (isGoodbye(question)) {
            awake = false
            options.onStatus('answering', '好的，再见')
            await options.onAcknowledge('好的，再见', requestController.signal)
            break
          }
        }
        if (active && run === generation) timer = setTimeout(() => void listen(run), 800)
      } catch (error) {
        if (!active || run !== generation) return
        stop()
        options.onStatus('error', error instanceof Error ? error.message : '语音识别失败')
      } finally { if (controller === requestController) controller = null }
    }
    try {
      await rec.start()
      if (!active || run !== generation) { rec.cancel(); rec.dispose(); return }
      timer = setTimeout(() => void finish(), options.onWakeDetected ? 3500 : awake ? 20000 : 8000)
    } catch (error) {
      rec.dispose()
      liveAsr?.cancel()
      liveAsr?.dispose()
      if (stream === liveAsr) stream = null
      if (!active || run !== generation) return
      stop()
      options.onStatus('error', error instanceof Error ? error.message : '无法开启麦克风')
    }
  }
  return {
    start() { if (active) return; active = true; awake = false; generation++; void listen(generation) },
    stop,
    get active() { return active }
  }
}
