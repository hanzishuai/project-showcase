#!/usr/bin/env node
/**
 * 唤醒词自测：假麦克风持续播放「你好你好」→ 打开唤醒 → 断言自动激活并进入录音。
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
  const header = Buffer.alloc(44)
  const dataSize = out.length * 2
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
  return Buffer.concat([header, Buffer.from(out.buffer)])
}

async function makeWav(text) {
  const response = await fetch(BASE + '/api/v1/rag/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  })
  if (!response.ok) throw new Error('TTS 失败 ' + response.status)
  return resampleWavTo16k(Buffer.from(await response.arrayBuffer()))
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
  const wav = await makeWav('你好你好')
  wavDir = await mkdtemp(join(tmpdir(), 'agent-wake-'))
  const wavPath = join(wavDir, 'wake.wav')
  await writeFile(wavPath, wav)
  record('生成唤醒词音频', wav.length > 1000, wav.length + ' bytes')

  profileDir = await mkdtemp(join(tmpdir(), 'agent-wake-profile-'))
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
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
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

  await send('Runtime.enable')
  await sleep(7000)

  const button = await evaluate(`(() => { const b = document.querySelector('.agent-dock__wake'); return b ? 'ok' : 'no-button'; })()`)
  record('唤醒开关存在', button === 'ok', button)

  await evaluate(`document.querySelector('.agent-dock__wake').click()`)
  await sleep(800)
  const onState = await evaluate(`(() => ({ on: !!document.querySelector('.agent-dock__wake.is-on'), label: (document.querySelector('.agent-dock__wake-label')||{}).textContent || '' }))()`)
  record('开启后进入监听', onState.on, JSON.stringify(onState))

  // 等唤醒：最多 25 秒（假麦克风循环播放，分段识别后触发）
  let woken = false
  let sawRecording = false
  for (let i = 0; i < 50; i += 1) {
    await sleep(500)
    const state = await evaluate(`(() => ({
      recording: !!document.querySelector('.pp7-chat-recording'),
      label: (document.querySelector('.agent-dock__wake-label')||{}).textContent || '',
      status: (document.querySelector('.pp7-chat-header__status')||{}).textContent || ''
    }))()`)
    if (state.recording) { sawRecording = true; woken = true; break }
    if (state.label.includes('我在')) { woken = true }
  }
  record('听到唤醒词后自动激活', woken, JSON.stringify({ sawRecording }))
  record('唤醒后自动开始录音', sawRecording, '未观察到录音态')

  await evaluate(`(() => { const b = document.querySelector('.agent-dock__wake'); if (b) b.click(); return true; })()`)
  ws.close()
} catch (error) {
  record('唤醒测试执行', false, String(error))
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
