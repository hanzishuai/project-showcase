#!/usr/bin/env node
/**
 * Agent 性能基准：连跑 N 次，统计首字延迟（TTFT）与总耗时的分位数。
 *
 * 用法：node scripts/agent-bench.mjs [次数=20]
 */
const BASE = process.env.AGENT_BASE || 'http://127.0.0.1:8000'
const ROUNDS = Number(process.argv[2] || 20)
const MEASURE_TTS = process.argv.includes('--tts')
const argValue = (name, fallback) => {
  const hit = process.argv.find((item) => item.startsWith('--' + name + '='))
  return hit ? Number(hit.split('=')[1]) : fallback
}
// 性能回归阈值：超过就退出码 1（可命令行覆盖）
const MAX_TTFT_P90 = argValue('max-p90', 1800)
const MAX_TOTAL_P90 = argValue('max-total-p90', 2200)

const boardResponse = await fetch(BASE + '/api/board', { signal: AbortSignal.timeout(10000) })
if (!boardResponse.ok) throw new Error('无法读取当前看板数据：HTTP ' + boardResponse.status)
const { data } = await boardResponse.json()
const project = data.projects.find(item => item.intro && item.versions.length)
if (!project) throw new Error('看板缺少带简介和版本的项目')
const UI = {
  page: 'board',
  boardView: 'board',
  openProject: project.name,
  mediaType: 'video',
  mediaPlaying: false
}
const QUESTIONS = [
  { kind: '动作', text: '打开' + project.name },
  { kind: '动作', text: '切到数据总览' },
  { kind: '事实', text: project.name + '的项目简介是什么？' },
  { kind: '事实', text: '现在展示的是视频还是图片？' },
  { kind: '复合', text: '打开' + project.name + '，顺便说说技术栈' },
  { kind: '复合', text: '帮我把' + project.name + '的详情调出来，再告诉我它用了哪些技术' }
]

async function run(question, measureTts = false) {
  const started = performance.now()
  const response = await fetch(BASE + '/api/v1/agent/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, ui: UI }),
    signal: AbortSignal.timeout(60000)
  })
  if (!response.ok || !response.body) throw new Error('HTTP ' + response.status)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let event = ''
  let ttft = null
  let answer = ''
  let actions = 0
  let actionConfirmed = null
  let completion
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let index
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, '')
      buffer = buffer.slice(index + 1)
      if (line === '') { event = ''; continue }
      if (line.startsWith('event:')) { event = line.slice(6).trim(); continue }
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (event === 'token') {
        if (ttft === null) ttft = performance.now() - started
        answer += JSON.parse(payload).text || ''
      } else if (event === 'action') {
        actions += 1
        const { action_id } = JSON.parse(payload)
        // Measure the server round trip using an immediate simulated UI acknowledgement.
        const ack = await fetch(BASE + '/api/v1/agent/action-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_id, ok: true, message: '测试页面执行成功', ui: UI }),
          signal: AbortSignal.timeout(5000)
        })
        if (!ack.ok) throw new Error('动作回传 HTTP ' + ack.status)
        actionConfirmed = performance.now() - started
      } else if (event === 'done') {
        completion = JSON.parse(payload)
      } else if (event === 'error') {
        throw new Error(JSON.parse(payload).message || 'Agent 请求失败')
      }
    }
  }
  if (ttft === null || !completion) throw new Error('Agent 未返回完整答复')
  const total = performance.now() - started
  let audioReady = null
  if (measureTts) {
    const audio = await fetch(BASE + '/api/v1/rag/tts/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: answer }),
      signal: AbortSignal.timeout(30000)
    })
    if (!audio.ok || !audio.body) throw new Error('播报 HTTP ' + audio.status)
    const pcm = audio.body.getReader()
    try {
      const chunk = await pcm.read()
      if (!chunk.value?.length) throw new Error('播报未返回音频')
      audioReady = performance.now() - started
    } finally {
      await pcm.cancel()
    }
  }
  return { ttft, total, chars: answer.length, actions, route: completion.route,
    modelCalls: completion.model_calls, actionConfirmed, audioReady }
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[index]
}

// 先打一次预热请求（排除服务冷启动），单独记录冷启动耗时
let coldStart = null
try {
  const warm = await run('你好')
  coldStart = warm.total
} catch {
  // 忽略
}
const rows = []
for (let i = 0; i < ROUNDS; i += 1) {
  const question = QUESTIONS[i % QUESTIONS.length]
  try {
    const result = await run(question.text, MEASURE_TTS && question.kind === '复合')
    rows.push({ ...question, ...result })
    process.stdout.write('.')
  } catch (error) {
    rows.push({ ...question, error: String(error), ttft: null, total: null, chars: 0, actions: 0 })
    process.stdout.write('x')
  }
}
console.log('')

const ok = rows.filter((row) => !row.error)
const ttfts = ok.map((row) => row.ttft)
const totals = ok.map((row) => row.total)

console.log('\n样本：' + ok.length + ' / ' + rows.length + (rows.length !== ok.length ? '（有失败）' : ''))
if (coldStart !== null) console.log('冷启动首问：' + Math.round(coldStart) + 'ms（不计入下方统计）')
console.log('首字延迟 ms  min=' + Math.round(Math.min(...ttfts)) +
  '  P50=' + Math.round(percentile(ttfts, 50)) +
  '  P90=' + Math.round(percentile(ttfts, 90)) +
  '  max=' + Math.round(Math.max(...ttfts)))
console.log('总耗时  ms  min=' + Math.round(Math.min(...totals)) +
  '  P50=' + Math.round(percentile(totals, 50)) +
  '  P90=' + Math.round(percentile(totals, 90)) +
  '  max=' + Math.round(Math.max(...totals)))

console.log('直接处理样本：' + ok.filter(row => row.route === 'direct').length)
console.log('\n按类型：')
for (const kind of ['动作', '事实', '复合']) {
  const list = ok.filter((row) => row.kind === kind)
  if (list.length === 0) continue
  const values = list.map((row) => row.ttft)
  console.log('  ' + kind + '  样本=' + list.length + '  首字 P50=' + Math.round(percentile(values, 50)) + 'ms  P90=' + Math.round(percentile(values, 90)) + 'ms')
}

for (const row of ok.filter(row => row.kind === '复合')) {
  console.log('  ' + row.text + ' | 模型调用 ' + row.modelCalls + ' | 首字 ' +
    Math.round(row.ttft) + 'ms' +
    (row.actionConfirmed === null ? ' | 无页面回执' : ' | 模拟回执 ' + Math.round(row.actionConfirmed) + 'ms') +
    (row.audioReady === null ? '' : ' | 首段音频接口 ' + Math.round(row.audioReady) + 'ms'))
}

let failed = ok.length !== rows.length
const ttftP90 = percentile(ttfts, 90)
const totalP90 = percentile(totals, 90)
if (ttftP90 > MAX_TTFT_P90) {
  console.log('\n⚠️ 性能回归：首字 P90 ' + Math.round(ttftP90) + 'ms 超过阈值 ' + MAX_TTFT_P90 + 'ms')
  failed = true
}
if (totalP90 > MAX_TOTAL_P90) {
  console.log('⚠️ 性能回归：总耗时 P90 ' + Math.round(totalP90) + 'ms 超过阈值 ' + MAX_TOTAL_P90 + 'ms')
  failed = true
}
if (!failed) console.log('\n阈值检查通过（首字 P90 ≤ ' + MAX_TTFT_P90 + 'ms，总耗时 P90 ≤ ' + MAX_TOTAL_P90 + 'ms）')
if (failed) process.exit(1)
