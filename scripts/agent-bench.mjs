#!/usr/bin/env node
/**
 * Agent 性能基准：连跑 N 次，统计首字延迟（TTFT）与总耗时的分位数。
 *
 * 用法：node scripts/agent-bench.mjs [次数=20]
 */
const BASE = process.env.AGENT_BASE || 'http://127.0.0.1:8000'
const ROUNDS = Number(process.argv[2] || 20)

const BOARD = [
  { name: '实验室预约系统', version: 'v1.2', stage: '开发', advisor: '张三', stack: 'Vue 3·Spring Boot·MySQL', team: '张三、李宁、王琳', users: 0, features: 0 },
  { name: '学术讲座预约平台', version: 'v1.1', stage: '上线', advisor: '吴迪', stack: 'Vue 3·Spring Boot·PostgreSQL', team: '吴迪、贺云、何琳', users: 1260, features: 24 }
]
const UI = {
  page: 'board',
  boardView: 'board',
  visibleCards: 2,
  projects: BOARD.map((item) => item.name),
  boardProjects: BOARD,
  adminStats: { sessions: 42, documents: 1 },
  knowledgeDocs: ['产教融合服务平台.md']
}

const QUESTIONS = [
  { kind: '动作', text: '打开管理后台' },
  { kind: '动作', text: '切到数据总览' },
  { kind: '事实', text: '实验室预约系统现在什么进度？' },
  { kind: '事实', text: '哪些项目已经上线？' },
  { kind: '复合', text: '打开实验室预约系统，顺便说说技术栈' }
]

async function run(question) {
  const started = performance.now()
  const response = await fetch(BASE + '/api/v1/agent/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, ui: UI })
  })
  if (!response.ok || !response.body) throw new Error('HTTP ' + response.status)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let event = ''
  let ttft = null
  let chars = 0
  let actions = 0
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
        try { chars += (JSON.parse(payload).text || '').length } catch {}
      } else if (event === 'action') {
        actions += 1
      }
    }
  }
  return { ttft: ttft ?? performance.now() - started, total: performance.now() - started, chars, actions }
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
    const result = await run(question.text)
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

console.log('\n按类型：')
for (const kind of ['动作', '事实', '复合']) {
  const list = ok.filter((row) => row.kind === kind)
  if (list.length === 0) continue
  const values = list.map((row) => row.ttft)
  console.log('  ' + kind + '  样本=' + list.length + '  首字 P50=' + Math.round(percentile(values, 50)) + 'ms  P90=' + Math.round(percentile(values, 90)) + 'ms')
}

if (ok.length !== rows.length) process.exit(1)
