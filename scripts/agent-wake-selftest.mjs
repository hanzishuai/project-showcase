#!/usr/bin/env node
/**
 * 语音唤醒 + 连续对话自测：
 *   假麦克风循环播放「你好你好」+ 若干句「你好」→
 *   开启唤醒 → 断言进入连续对话 → 自动提问 → 回答完自动继续 →
 *   点麦克风结束 → 不再收音。
 */
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.AGENT_BASE || 'http://127.0.0.1:8000'
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (ok || !detail ? '' : ' → ' + detail))
}

function resampleWavTo16k(buffer) {
  const dataIndex = buffer.indexOf(Buffer.from('data'))
  if (dataIndex < 0) throw new Error('WAV 缺少 data 块')
  const rate = buffer.readUInt32LE(24)
  const pcm = buffer.subarray(dataIndex + 8)
  const samples = new Int16Array(pcm.length / 2)
  for (let i = 0; i < samples.length; i += 1) samples[i] = pcm.readInt16LE(i * 2)
  const ratio = rate / 16000
  const outLength = Math.floor(samples.length / ratio)
  const out = new Int16Array(outLength)
  for (let i = 0; i < outLength; i += 1) {
    const pos = i * ratio
    const left = Math.floor(pos)
    const frac = pos - left
    const a = samples[left]
    const b = left + 1 < samples.length ? samples[left + 1] : a
    out[i] = Math.max(-32768, Math.min(32767, Math.round(a + (b - a) * frac)))
  }
  return Buffer.from(out.buffer)
}

function wavFromPcm(pcm) {
  const header = Buffer.alloc(44)
  const dataSize = pcm.length
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(16000, 24)
  header.writeUInt32LE(16000 * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  return Buffer.concat([header, pcm])
}

async function tts16k(text) {
  const response = await fetch(BASE + '/api/v1/rag/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  })
  if (!response.ok) throw new Error('TTS 失败 ' + response.status)
  return resampleWavTo16k(Buffer.from(await response.arrayBuffer()))
}

function silencePcm(ms) {
  return Buffer.alloc(Math.round((16000 * 2 * ms) / 1000))
}

/** 拼一段「唤醒词 + 3 句追问」，句间留 1.8s 静音，模拟真人连续说几句话 */
async function buildConversationAudio() {
  const wake = await tts16k('你好你好')
  const turn = await tts16k('你好')
  // 注意：Chrome 假麦克风每开一次流都会把文件从头播，所以文件开头不能放静音，
  // 否则唤醒检测每次只听得到开头静音、一直重启。真实麦克风不受影响。
  const parts = [wake, silencePcm(1600)]
  for (let i = 0; i < 3; i += 1) parts.push(turn, silencePcm(1800))
  parts.push(silencePcm(2500))
  return wavFromPcm(Buffer.concat(parts))
}

async function findTarget(port, tries = 80) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/json/list')
      const list = await response.json()
      const page = list.find((item) => item.type === 'page' && String(item.url).includes('127.0.0.1:8000'))
      if (page) return page
    } catch {
      // 还没起来
    }
    await sleep(250)
  }
  throw new Error('无法连接 Chrome')
}

let child = null
let profileDir = null
let wavDir = null
try {
  const wav = await buildConversationAudio()
  wavDir = await mkdtemp(join(tmpdir(), 'agent-conv-'))
  const wavPath = join(wavDir, 'conversation.wav')
  await writeFile(wavPath, wav)
  record('生成连续对话测试音频', wav.length > 1000, wav.length + ' bytes')

  profileDir = await mkdtemp(join(tmpdir(), 'agent-conv-profile-'))
  const port = 9600 + Math.floor(Math.random() * 100)
  child = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--window-size=1600,1000',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--use-file-for-fake-audio-capture=' + wavPath,
    '--remote-debugging-port=' + String(port),
    '--user-data-dir=' + profileDir,
    BASE + '/'
  ], { detached: true, stdio: 'ignore' })
  child.unref()

  const target = await findTarget(port)
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', () => reject(new Error('CDP 连接失败')), { once: true })
  })
  let seq = 0
  const pending = new Map()
  const errors = []
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(String(message.params?.exceptionDetails?.text || 'exception').slice(0, 120))
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') {
      errors.push('console: ' + (message.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 120))
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++seq
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.result?.exceptionDetails) throw new Error(JSON.stringify(result.result.exceptionDetails).slice(0, 200))
    return result.result?.result?.value
  }
  const snapshot = () =>
    evaluate(`(() => {
      const pill = document.querySelector('.agent-dock__conv');
      const mic = document.querySelector('.pp7-chat-mic');
      const users = [...document.querySelectorAll('.pp7-chat-msg--user')].map((el) => (el.querySelector('.pp7-chat-msg__bubble')?.textContent || '').trim());
      return {
        pill: pill ? pill.textContent.trim() : '',
        pillState: pill ? pill.className : '',
        wakeLabel: (document.querySelector('.agent-dock__wake-label') || {}).textContent || '',
        micActive: !!mic && mic.classList.contains('is-conversation'),
        userCount: users.length,
        userTexts: users.slice(-3),
        assistantCount: document.querySelectorAll('.pp7-chat-msg--assistant').length
      };
    })()`)

  await send('Runtime.enable')
  await sleep(7000)

  const button = await evaluate("(() => { const b = document.querySelector('.agent-dock__wake'); return b ? 'ok' : 'no-button'; })()")
  record('唤醒开关存在', button === 'ok', button)

  await evaluate("document.querySelector('.agent-dock__wake').click()")
  await sleep(800)
  const onState = await evaluate("(() => ({ on: !!document.querySelector('.agent-dock__wake.is-on'), label: (document.querySelector('.agent-dock__wake-label')||{}).textContent || '' }))()")
  record('开启后进入监听', onState.on, JSON.stringify(onState))

  // 1) 听到唤醒词后自动进入连续对话（不需要点麦克风）
  let pill = null
  for (let i = 0; i < 60; i += 1) {
    await sleep(500)
    const state = await snapshot()
    if (state.pill.includes('连续对话')) {
      pill = state
      break
    }
  }
  record('听到唤醒词后进入连续对话', !!pill && pill.micActive, JSON.stringify(pill))

  // 2) 连续对话自动提问（没有点麦克风）
  let firstTurn = null
  for (let i = 0; i < 60; i += 1) {
    await sleep(500)
    const state = await snapshot()
    if (state.userCount >= 1) {
      firstTurn = state
      break
    }
  }
  record('连续对话自动提问（未点麦克风）', !!firstTurn && firstTurn.userCount >= 1, JSON.stringify(firstTurn))

  // 3) 回答完自动继续听，第二轮也能自动提问
  let secondTurn = null
  for (let i = 0; i < 90; i += 1) {
    await sleep(500)
    const state = await snapshot()
    if (state.userCount >= 2) {
      secondTurn = state
      break
    }
  }
  record('回答完自动继续听（第二轮）', !!secondTurn && secondTurn.userCount >= 2, JSON.stringify(secondTurn))

  // 4) 点麦克风结束连续对话
  await evaluate("document.querySelector('.pp7-chat-mic').click()")
  await sleep(1200)
  const ended = await snapshot()
  record('点麦克风结束连续对话', ended.pill === '' && !ended.micActive, JSON.stringify(ended))

  // 5) 关掉唤醒开关（假麦克风还在循环，避免又被唤醒），确认不再自动提问
  await evaluate("document.querySelector('.agent-dock__wake').click()")
  const frozen = await snapshot()
  await sleep(6000)
  const later = await snapshot()
  record('结束后不再自动收音', later.userCount === frozen.userCount, JSON.stringify({ before: frozen.userCount, after: later.userCount }))
  record('无前端报错', errors.length === 0, JSON.stringify(errors))

  ws.close()
} catch (error) {
  record('连续对话测试执行', false, String(error))
} finally {
  if (child) {
    try { process.kill(-child.pid, 'SIGKILL') } catch {}
    try { child.kill('SIGKILL') } catch {}
  }
  if (profileDir) await rm(profileDir, { recursive: true, force: true }).catch(() => {})
  if (wavDir) await rm(wavDir, { recursive: true, force: true }).catch(() => {})
}

const passed = results.filter((item) => item.ok).length
console.log('\n通过 ' + passed + ' / ' + results.length)
if (passed !== results.length) process.exit(1)
