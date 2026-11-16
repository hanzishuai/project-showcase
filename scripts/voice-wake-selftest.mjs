import { build } from '../frontend/node_modules/esbuild/lib/main.js'
import assert from 'node:assert/strict'
const bundle = await build({ entryPoints: ['frontend/src/agent/voiceLoop.ts'], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'mock-recorder', setup(build) { build.onResolve({ filter: /rag-avatar\.js$/ }, () => ({ path: 'recorder', namespace: 'mock' })); build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const createWavRecorder = (...args) => globalThis.mockRecorder(...args); export const createAsrStreamSession = (...args) => globalThis.mockAsrStream(...args)', loader: 'js' })) } }] })
const { createVoiceLoop, extractWakeCommand } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
assert.equal(extractWakeCommand('你好，豆姐，介绍项目'), '介绍项目')
assert.equal(extractWakeCommand('你好豆姐'), '')
assert.equal(extractWakeCommand('你好，窦杰，请介绍这个项目。'), '请介绍这个项目。')
assert.equal(extractWakeCommand('你好小豆'), null)
const realTimeout = globalThis.setTimeout
const realClear = globalThis.clearTimeout
const realFetch = globalThis.fetch
let callbacks = new Map(), next = 0, rec, transcript = '', questions = [], statuses = [], replies = [], stream
globalThis.setTimeout = fn => { callbacks.set(++next, fn); return next }
globalThis.clearTimeout = id => callbacks.delete(id)
globalThis.mockRecorder = options => rec = { options, async start() {}, async stop() { return new Blob([new Uint8Array(5000)]) }, cancel() { this.cancelled = true }, dispose() {} }
globalThis.mockAsrStream = options => stream = { options, async open() {}, push() {}, cancel() {}, dispose() {} }
globalThis.fetch = async () => ({ ok: true, async json() { return { text: transcript } } })
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
const advance = async () => { const [id, fn] = [...callbacks.entries()][0]; callbacks.delete(id); fn(); await flush() }
async function say(text) { transcript = text; rec.options.onLevel(.1); rec.options.onVadSilence(); await flush() }
try {
  const loop = createVoiceLoop({ onStatus: s => statuses.push(s), shouldPause: () => false, onQuestion: async q => { questions.push(q) }, onAcknowledge: async text => { replies.push(text) } })
  loop.start(); await flush()
  await say('不含唤醒词'); assert.deepEqual(questions, []); await advance()
  await say('你好豆姐，介绍项目'); assert.deepEqual(questions, ['介绍项目']); assert.deepEqual(replies, ['你好，我在']); await advance()
  await say('还有哪些项目'); assert.deepEqual(questions, ['介绍项目', '还有哪些项目']); await advance()
  await say('再见豆姐'); assert.deepEqual(replies, ['你好，我在', '好的，再见']); assert.deepEqual(questions, ['介绍项目', '还有哪些项目']); await advance()
  await say('不含唤醒词'); assert.equal(questions.length, 2); await advance()
  await say('你好豆姐'); assert.deepEqual(replies, ['你好，我在', '好的，再见', '你好，我在']); await advance()
  loop.stop(); assert.equal(rec.cancelled, true); assert.equal(loop.active, false); assert.equal(statuses.at(-1), 'off')
  globalThis.fetch = async () => ({ ok: false, status: 503 })
  loop.start(); await flush(); await say('你好豆姐')
  assert.equal(loop.active, false); assert.equal(statuses.at(-1), 'error')
  globalThis.fetch = async () => ({ ok: true, async json() { return { text: transcript } } })
  let interruptions = []
  const detector = createVoiceLoop({ onStatus: () => {}, shouldPause: () => false, onWakeDetected: command => { interruptions.push(command); detector.stop() }, onQuestion: async () => {}, onAcknowledge: async () => {} })
  detector.start(); await flush()
  assert.ok(stream, '播报时必须启动流式识别，不能等待静音')
  stream.options.onPartial('旁边有人说话'); assert.deepEqual(interruptions, [])
  stream.options.onPartial('你好豆姐'); assert.deepEqual(interruptions, ['']); assert.equal(detector.active, false)
  console.log('语音唤醒、连续对话、指定词打断和识别错误模拟测试通过')
} finally { globalThis.setTimeout = realTimeout; globalThis.clearTimeout = realClear; globalThis.fetch = realFetch }
