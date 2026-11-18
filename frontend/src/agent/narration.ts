import { ref, computed } from 'vue'

export type NarrationSource = 'document' | 'script'
type Section = { title: string; segments: string[] }
type Document = { title: string; source: NarrationSource; sections: Section[] }
type Status = 'idle' | 'loading' | 'preparing' | 'playing' | 'paused' | 'error' | 'finished'
type Position = { chapter: number; sentence: number }

const document = ref<Document | null>(null)
const status = ref<Status>('idle')
const error = ref('')
const position = ref<Position>({ chapter: 0, sentence: 0 })
let current: AbortController | null = null
let chatBusy = () => false

const section = computed(() => document.value?.sections[position.value.chapter])
const total = computed(() => document.value?.sections.reduce((count, entry) => count + entry.segments.length, 0) ?? 0)
const completed = computed(() => status.value === 'finished' ? total.value :
  (document.value?.sections.slice(0, position.value.chapter).reduce((count, entry) => count + entry.segments.length, 0) ?? 0)
  + position.value.sentence)

function cancel() {
  current?.abort()
  current = null
}

function pause() {
  if (!current) return
  cancel()
  status.value = document.value ? 'paused' : 'idle'
}

function stop() {
  cancel()
  document.value = null
  position.value = { chapter: 0, sentence: 0 }
  status.value = 'idle'
  error.value = ''
}

function chapterIndex(doc: Document, requested: number | string) {
  const titles = doc.sections.map(item => item.title)
  const normal = (value: string) => value.trim().normalize('NFKC').toLowerCase()
  const numeric = typeof requested === 'number' ? requested : /^\d+$/.test(requested.trim()) ? Number(requested) : null
  let index: number
  if (numeric !== null) index = numeric - 1
  else {
    const title = normal(String(requested))
    const exact = titles.map((name, index) => normal(name) === title ? index : -1).filter(index => index !== -1)
    const partial = titles.map((name, index) => title && normal(name).includes(title) ? index : -1).filter(index => index !== -1)
    const matches = exact.length ? exact : partial
    if (matches.length > 1) throw new Error('有多个匹配的章节，请指定章节序号。')
    index = matches[0] ?? -1
  }
  if (!Number.isInteger(index) || index < 0 || index >= titles.length) throw new Error('没找到指定的章节。')
  return index
}

async function fetchAudio(text: string, signal: AbortSignal) {
  const response = await fetch('/api/v1/rag/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(25000)])
  })
  if (!response.ok) throw new Error('这一段暂时无法合成，请重试。')
  return response.blob()
}

async function playAudio(blob: Blob, signal: AbortSignal) {
  signal.throwIfAborted()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  try {
    await new Promise<void>((resolve, reject) => {
      const abort = () => { audio.pause(); reject(signal.reason) }
      signal.addEventListener('abort', abort, { once: true })
      const clear = () => signal.removeEventListener('abort', abort)
      audio.onended = () => { clear(); resolve() }
      audio.onerror = () => { clear(); reject(new Error('音频播放失败，请重试。')) }
      audio.play().catch(reason => { clear(); reject(reason) })
    })
  } finally {
    audio.pause()
    audio.onended = audio.onerror = null
    URL.revokeObjectURL(url)
  }
}

function nextPosition(doc: Document, current: Position): Position | null {
  if (current.sentence + 1 < doc.sections[current.chapter].segments.length) {
    return { chapter: current.chapter, sentence: current.sentence + 1 }
  }
  return current.chapter + 1 < doc.sections.length ? { chapter: current.chapter + 1, sentence: 0 } : null
}

type Prepared = { audio: Blob } | { failure: unknown }
async function run(doc: Document, controller: AbortController) {
  const { signal } = controller
  const prepare = (at: Position): Promise<Prepared> => fetchAudio(doc.sections[at.chapter].segments[at.sentence], signal)
    .then(audio => ({ audio }), failure => ({ failure }))

  try {
    let pending = prepare(position.value)
    // Agent tool results may be spoken by the chat SDK. Wait for that audio first.
    while (chatBusy() && !signal.aborted) await new Promise(resolve => setTimeout(resolve, 40))
    while (!signal.aborted) {
      const result = await pending
      signal.throwIfAborted()
      if ('failure' in result) throw result.failure
      const next = nextPosition(doc, position.value)
      if (next) pending = prepare(next)
      status.value = 'playing'
      await playAudio(result.audio, signal)
      signal.throwIfAborted()
      if (!next) {
        status.value = 'finished'
        break
      }
      position.value = next
      status.value = 'preparing'
    }
  } catch (reason) {
    if (!signal.aborted) {
      status.value = 'error'
      error.value = reason instanceof Error ? reason.message : '朗读失败，请重试。'
    }
  } finally {
    if (current === controller) current = null
    controller.abort()
  }
}

function resume() {
  const doc = document.value
  if (!doc) throw new Error('还没有选择要朗读的文档。')
  if (current) return
  if (status.value === 'finished') position.value = { chapter: 0, sentence: 0 }
  error.value = ''
  status.value = 'preparing'
  const controller = current = new AbortController()
  void run(doc, controller)
}

function seek(requested: number | string) {
  const doc = document.value
  if (!doc) throw new Error('还没有选择要朗读的文档。')
  const chapter = chapterIndex(doc, requested)
  pause()
  position.value = { chapter, sentence: 0 }
  status.value = 'paused'
  resume()
}

async function start(title: string, source?: NarrationSource, requested?: number | string, signal?: AbortSignal) {
  pause()
  const controller = current = new AbortController()
  const requestSignal = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal
  status.value = 'loading'
  try {
    const response = await fetch('/api/v1/rag/narration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, source }),
      signal: requestSignal
    })
    if (response.status === 401 || response.status === 403) throw new Error('当前无法访问朗读服务。')
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || '无法加载这篇文档。')
    requestSignal.throwIfAborted()
    const chapter = requested === undefined ? 0 : chapterIndex(data, requested)
    document.value = data
    position.value = { chapter, sentence: 0 }
    current = null
    resume()
    return data.title as string
  } catch (reason) {
    if (current === controller) {
      current = null
      status.value = document.value ? 'paused' : 'idle'
    }
    throw reason
  }
}

function snapshot() {
  const doc = document.value
  if (!doc) return null
  return {
    title: doc.title,
    status: status.value,
    section: section.value?.title,
    sectionNumber: position.value.chapter + 1,
    sections: doc.sections.length,
    chapterTitles: doc.sections.slice(0, 20).map(chapter => chapter.title.slice(0, 45)),
    excerpt: section.value?.segments[position.value.sentence]
  }
}

export const narration = {
  document, status, error, position, section, total, completed,
  start, pause, resume, stop, seek, snapshot,
  setChatBusy(check: () => boolean) { chatBusy = check }
}
