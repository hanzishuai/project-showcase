import { build } from '../frontend/node_modules/esbuild/lib/main.js'
import assert from 'node:assert/strict'

const bundle = await build({
  entryPoints: ['frontend/src/agent/voiceLoop.ts'],
  bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'voice-mocks', setup(builder) {
    builder.onResolve({ filter: /rag-avatar\.js$/ }, () => ({ path: 'recorder', namespace: 'mock' }))
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
      contents: `
        export const createWavRecorder = options => globalThis.mockRecorder(options)
        export const createAsrStreamSession = options => globalThis.mockAsrStream(options)
        export const encodeWav = samples => new Blob([samples.buffer])
      `, loader: 'js'
    }))
  }}]
})
const { createVoiceLoop, extractWakeCommand } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64')
)
assert.equal(extractWakeCommand('你好，窦杰，请介绍这个项目。'), '请介绍这个项目。')
assert.equal(extractWakeCommand('豆姐'), '')
assert.equal(extractWakeCommand('豆姐，你好'), '')

let rec, stream, starts = 0, interrupts = 0, attempts = 0
let captureOpen = true
let connectionFailed = false
let answering = false
let finishAnswer
let releaseAnswer
const questions = []
const replies = []
const statuses = []
const realFetch = globalThis.fetch
globalThis.mockRecorder = options => rec = {
  options,
  async start() { starts++; captureOpen = true },
  dispose() { captureOpen = false }
}
globalThis.mockAsrStream = options => stream = {
  options, final: '',
  async open() { if (connectionFailed) throw new Error('socket unavailable') },
  push() {},
  async stop() { return this.final },
  dispose() { this.disposed = true }
}
globalThis.fetch = async () => { attempts++; return { ok: false, status: 503 } }

const flush = () => new Promise(resolve => setImmediate(resolve))
const audible = () => { for (let i = 0; i < 2; i++) rec.options.onPcmChunk(new Int16Array(1280).fill(5000)) }
function endTurn(text) {
  stream.final = text
  for (let i = 0; i < 9; i++) rec.options.onPcmChunk(new Int16Array(1280))
  return flush()
}
async function say(text) { audible(); await endTurn(text) }

const loop = createVoiceLoop({
  onStatus: status => statuses.push(status),
  isAssistantBusy: () => answering,
  onInterrupt() {
    interrupts++
    answering = false
    finishAnswer?.()
  },
  async onQuestion(question, signal) {
    questions.push(question)
    answering = true
    await new Promise(resolve => {
      finishAnswer = resolve
      releaseAnswer = () => { answering = false; resolve() }
      signal.addEventListener('abort', resolve, { once: true })
    })
  },
  onAcknowledge: async text => { replies.push(text) }
})

try {
  await loop.start()
  await say('你好豆姐，介绍项目')
  assert.deepEqual(replies, ['你好，我在'])
  assert.deepEqual(questions, ['介绍项目'])
  assert.equal(captureOpen, true)

  audible()
  stream.options.onPartial('旁边有人说话')
  await endTurn('旁边有人说话')
  assert.equal(interrupts, 0)
  assert.equal(questions.length, 1)

  audible()
  stream.options.onPartial('豆姐')
  assert.equal(interrupts, 1, '必须在停顿和最终识别之前打断')
  assert.equal(captureOpen, true)
  audible()
  stream.options.onPartial('豆姐，给我看看版本')
  await endTurn('豆姐，给我看看版本')
  assert.deepEqual(questions, ['介绍项目', '给我看看版本'])
  assert.equal(interrupts, 1, '同一句多次更新不能重复打断')

  audible()
  stream.options.onPartial('再见豆姐')
  await endTurn('再见豆姐')
  assert.equal(interrupts, 2)
  assert.equal(statuses.at(-1), 'wake')
  assert.deepEqual(replies, ['你好，我在', '好的，再见'])
  assert.equal(starts, 1, '唤醒、问答、打断和结束均复用同一个录音器')

  for (const goodbye of ['豆姐再见', '再见，豆姐', '豆姐，再见', '豆姐拜拜']) {
    await say('豆姐你好')
    await say(goodbye)
    assert.equal(statuses.at(-1), 'wake', goodbye)
  }
  await say('豆姐')
  const beforeNoise = questions.length
  await say('Thank you.')
  assert.equal(questions.length, beforeNoise, '背景噪声不应触发 Thank you 对话')
  await say('Okay.')
  assert.equal(questions.length, beforeNoise, '背景噪声不应触发 Okay 对话')
  await say('再问一个问题')
  releaseAnswer()
  await flush()
  assert.equal(statuses.at(-1), 'listening')
  assert.equal(questions.at(-1), '再问一个问题')
  loop.stop()
  assert.equal(captureOpen, false)
  assert.equal(loop.active, false)

  connectionFailed = true
  await loop.start()
  await say('你好豆姐')
  assert.equal(attempts, 2)
  assert.equal(statuses.at(-1), 'error')
  assert.equal(captureOpen, false)
  console.log('持续收音、豆姐即时打断、衔接新问题、再见和识别回退均通过')
} finally {
  loop.stop()
  globalThis.fetch = realFetch
}
