#!/usr/bin/env node
/**
 * 语音闭环自测：假麦克风喂一段合成语音 → 流式 ASR → 自动提问 → 助手回复。
 *
 * 依赖：服务在 127.0.0.1:8000 运行（TTS 用来生成测试音频）。
 * 用法：node scripts/agent-voice-selftest.mjs
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

/** 24k/16bit/mono WAV → 16k/16bit/mono WAV（浏览器麦克风采集常用 16k） */
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

async function makeSpeechWav(text) {
  const response = await fetch(BASE + '/api/v1/rag/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  })
  if (!response.ok) throw new Error('TTS 失败 HTTP ' + response.status)
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
  const wav = await makeSpeechWav('打开管理后台')
  wavDir = await mkdtemp(join(tmpdir(), 'agent-voice-'))
  const wavPath = join(wavDir, 'speech.wav')
  await writeFile(wavPath, wav)
  record('生成测试语音', wav.length > 1000, wav.length + ' bytes')

  profileDir = await mkdtemp(join(tmpdir(), 'agent-voice-profile-'))
  const port = 9500 + Math.floor(Math.random() * 100)
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
  await sleep(5000)

  const mic = await evaluate(`(() => { const el = document.querySelector('.pp7-chat-mic'); return el ? 'ok' : 'no-mic'; })()`)
  record('麦克风按钮存在', mic === 'ok', mic)

  await evaluate(`document.querySelector('.pp7-chat-mic').click()`)
  await sleep(1500)

  const recording = await evaluate(`(() => ({
    recording: !!document.querySelector('.pp7-chat-recording'),
    partial: (document.querySelector('.pp7-chat-recording__partial') || {}).textContent || ''
  }))()`)
  record('进入录音状态', !!recording.recording, JSON.stringify(recording))
  record('录音时显示流式识别', String(recording.partial || '').includes('识别中'), String(recording.partial || ''))

  // 假麦克风会一直播放文件，VAD 不会自动断句：等 3 秒后手动结束
  await sleep(3000)
  await evaluate(`(() => { const el = document.querySelector('.pp7-chat-mic'); if (el && el.classList.contains('is-recording')) el.click(); return true; })()`)

  // 等待识别完成与自动提问
  let transcript = ''
  for (let i = 0; i < 20; i += 1) {
    await sleep(1000)
    const state = await evaluate(`(() => {
      const stillRecording = !!document.querySelector('.pp7-chat-recording');
      const msgs = [...document.querySelectorAll('.pp7-chat-msg')];
      const users = msgs.filter((m) => m.className.includes('user'));
      const last = msgs[msgs.length - 1];
      return {
        stillRecording,
        userCount: users.length,
        userText: users.length ? (users[users.length - 1].querySelector('.pp7-chat-msg__bubble') || {}).textContent || '' : '',
        lastText: last ? (last.querySelector('.pp7-chat-msg__bubble') || {}).textContent || '' : ''
      };
    })()`)
    if (!state.stillRecording && state.userCount > 0 && state.lastText && !state.lastText.includes('识别')) {
      transcript = state.userText.trim()
      record('语音识别出文字', transcript.length > 0, transcript.slice(0, 40))
      record('识别后自动提问并得到回复', state.lastText.trim().length > 0, state.lastText.trim().slice(0, 60))
      break
    }
    if (i === 19) record('语音识别出文字', false, '等待超时')
  }
  ws.close()
} catch (error) {
  record('语音测试执行', false, String(error))
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
