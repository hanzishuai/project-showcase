#!/usr/bin/env node
/**
 * Agent 自测：对 /api/v1/agent/ask 跑一批「指令 → 期望动作」用例。
 *
 * 用法：node scripts/agent-selftest.mjs [--verbose]
 * 退出码：0 = 全部通过；1 = 有失败。
 */
const BASE = process.env.AGENT_BASE || 'http://127.0.0.1:8000'
const VERBOSE = process.argv.includes('--verbose')

const PROJECTS = [
  '实验室预约系统', '科研成果管理平台', '课程实践评价系统', '校园活动服务中心',
  '实习岗位匹配平台', '毕业设计协作平台', '教学资源共享库', '竞赛项目孵化平台', '学术讲座预约平台'
]

const BOARD_UI = { page: 'board', boardView: 'board', projectFilter: '', advisorFilter: '', openProject: '' }
const BOARD_PROJECTS = [
  { name: '实验室预约系统', version: 'v1.2', stage: '开发', advisor: '张三', stack: 'Vue 3·Spring Boot·MySQL', team: '张三、李宁、王琳', users: 0, features: 0 },
  { name: '科研成果管理平台', version: 'v2.0', stage: '测试', advisor: '李四', stack: 'React·Node.js·PostgreSQL', team: '李四、孙瑶、陈泽', users: 0, features: 0 },
  { name: '课程实践评价系统', version: 'v1.1', stage: '开发', advisor: '王五', stack: 'Vue 3·Spring Boot·Redis', team: '王五、周可、赵敏', users: 0, features: 0 },
  { name: '学术讲座预约平台', version: 'v1.1', stage: '上线', advisor: '吴迪', stack: 'Vue 3·Spring Boot·PostgreSQL', team: '吴迪、贺云、何琳', users: 1260, features: 24 },
]
const BOARD_FULL = { ...BOARD_UI, boardProjects: BOARD_PROJECTS, visibleCards: 4 }
const ADMIN_UI = { page: 'admin', adminTab: 'dashboard', openProject: '' }

/** expect.tools: 必须调用的工具（按需校验参数子集）；forbid: 不允许出现的工具 */
const CASES = [
  {
    name: '打开管理后台',
    ui: BOARD_UI,
    expect: {
      tools: [],
      anyOf: [
        { tool: 'navigate_page', args: { page: 'admin' } },
        { tool: 'open_admin_tab', args: { tab: 'dashboard' } }
      ]
    }
  },
  { name: '打开管理后台的知识库页面', ui: BOARD_UI, expect: { tools: [{ tool: 'open_admin_tab', args: { tab: 'knowledge' } }], forbid: ['navigate_page'] } },
  { name: '打开对话记录', ui: ADMIN_UI, expect: { tools: [{ tool: 'open_admin_tab', args: { tab: 'conversations' } }] } },
  { name: '把看板切到数据总览', ui: BOARD_UI, expect: { tools: [{ tool: 'set_board_view', args: { view: 'overview' } }] } },
  { name: '切回生命周期看板', ui: { ...BOARD_UI, boardView: 'overview' }, expect: { tools: [{ tool: 'set_board_view', args: { view: 'board' } }] } },
  { name: '只看张三指导的项目', ui: BOARD_UI, expect: { tools: [{ tool: 'filter_board', args: { advisor: '张三' } }] } },
  { name: '清除筛选，显示全部项目', ui: { ...BOARD_UI, advisorFilter: '张三' }, expect: { tools: [{ tool: 'filter_board', args: { advisor: '' } }] } },
  { name: '打开实验室预约系统的详情', ui: BOARD_UI, expect: { tools: [{ tool: 'open_project', args: { project: '实验室预约系统' } }] } },
  { name: '把详情抽屉关了', ui: { ...BOARD_UI, openProject: '实验室预约系统' }, expect: { tools: [{ tool: 'close_drawer' }] } },
  { name: '返回到看板', ui: ADMIN_UI, expect: { tools: [{ tool: 'navigate_page', args: { page: 'board' } }] } },
  { name: '打开一个不存在的项目：火星基地管理系统', ui: BOARD_UI, expect: { tools: [], forbid: ['open_project'] } },
  { name: '平台现在正式上线了吗', ui: BOARD_UI, expect: { tools: [] } },
  { name: '重建知识库索引', ui: BOARD_UI, expect: { tools: [], forbid: ['rebuild_knowledge_index'] } },
  { name: '把这个项目删掉', ui: { ...BOARD_UI, openProject: '实验室预约系统' }, expect: { tools: [] } },

  // ---- 更难的：模糊指代 / 组合 / 上下文 ----
  { name: '看看那个预约系统的详情', ui: BOARD_UI, expect: { tools: [{ tool: 'open_project', args: { project: '实验室预约系统' } }] } },
  { name: '只看实验室预约系统', ui: BOARD_UI, expect: { tools: [{ tool: 'filter_board', args: { project: '实验室预约系统' } }] } },
  { name: '把历史版本也显示出来', ui: BOARD_UI, expect: { tools: [{ tool: 'filter_board', args: { show_history: true } }] } },
  { name: '打开图片看看', ui: { ...BOARD_UI, openProject: '实验室预约系统', galleryOpen: false }, expect: { tools: [{ tool: 'open_gallery' }] } },
  { name: '看下一张', ui: { ...BOARD_UI, openProject: '实验室预约系统', galleryOpen: true, galleryIndex: 0 }, expect: { tools: [{ tool: 'step_gallery', args: { delta: 1 } }] } },
  { name: '把图片关掉', ui: { ...BOARD_UI, openProject: '实验室预约系统', galleryOpen: true, galleryIndex: 0 }, expect: { tools: [{ tool: 'close_gallery' }] } },
  { name: '你好', ui: BOARD_UI, expect: { tools: [] } },
  { name: '这个页面上都有什么', ui: BOARD_UI, expect: { tools: [] } },
  { name: '打开后台，然后切到知识库管理', ui: BOARD_UI, expect: { tools: [{ tool: 'open_admin_tab', args: { tab: 'knowledge' } }], forbid: ['navigate_page'] } },
  { name: '帮我把它改名叫实验室管理系统', ui: { ...BOARD_UI, openProject: '实验室预约系统' }, expect: { tools: [] } },
  { name: '显示全部指导老师', ui: { ...BOARD_UI, advisorFilter: '张三' }, expect: { tools: [{ tool: 'filter_board', args: { advisor: '' } }] } },
  { name: '回到生命周期看板', ui: { page: 'admin', adminTab: 'knowledge' }, expect: { tools: [{ tool: 'navigate_page', args: { page: 'board' } }] } },
  { name: '打开数据修改页', ui: BOARD_UI, expect: { tools: [{ tool: 'navigate_page', args: { page: 'edit' } }] } },
  { name: '看看学术讲座预约平台', ui: BOARD_UI, expect: { tools: [{ tool: 'open_project', args: { project: '学术讲座预约平台' } }] } },

  // ---- 多轮：靠历史理解指代 ----
  {
    name: '把刚才那个项目的详情打开',
    ui: BOARD_UI,
    history: [
      { role: 'user', content: '实验室预约系统现在什么进度？' },
      { role: 'assistant', content: '实验室预约系统当前是 v1.2 版本，处在开发阶段，已停留 19 天。' },
    ],
    expect: { tools: [{ tool: 'open_project', args: { project: '实验室预约系统' } }] },
  },
  {
    name: '那它的图片呢',
    ui: BOARD_UI,
    history: [
      { role: 'user', content: '科研成果管理平台做完了吗？' },
      { role: 'assistant', content: '科研成果管理平台当前是 v2.0 版本，处在测试阶段。' },
    ],
    // 可以直接打开详情，也可以一步打开「详情 + 图片」，两种都对
    expect: {
      tools: [],
      anyOf: [
        { tool: 'open_project', args: { project: '科研成果管理平台' } },
        { tool: 'open_gallery', args: { project: '科研成果管理平台' } }
      ]
    },
  },
  { name: '现在还剩几个项目', ui: { ...BOARD_UI, advisorFilter: '张三', visibleCards: 1 }, expect: { tools: [] } },
  { name: '把筛选清空', ui: { ...BOARD_UI, projectFilter: '实验室预约系统', advisorFilter: '张三' }, expect: { tools: [{ tool: 'filter_board' }] } },
  { name: '把它关了', ui: { ...BOARD_UI, openProject: '实验室预约系统' }, expect: { tools: [{ tool: 'close_drawer' }] } },
  { name: '学术讲座预约平台在哪一列', ui: { ...BOARD_UI, boardProjects: [{ name: '学术讲座预约平台', version: 'v1.1', stage: '上线', advisor: '吴迪' }] }, expect: { tools: [] } },
  // ---- 看板事实问答：直接答、不操作 ----
  { name: '实验室预约系统现在什么进度？', ui: BOARD_FULL, expect: { tools: [], sayIncludes: ['v1.2'] } },
  { name: '哪些项目已经上线了？', ui: BOARD_FULL, expect: { tools: [], sayIncludes: ['学术讲座预约平台'] } },
  { name: '张三指导了哪些项目？', ui: BOARD_FULL, expect: { tools: [], sayIncludes: ['实验室预约系统'] } },
  { name: '实验室预约系统用什么技术栈？', ui: BOARD_FULL, expect: { tools: [], sayIncludes: ['Vue 3'] } },
  { name: '实验室预约系统的团队都有谁？', ui: BOARD_FULL, expect: { tools: [], sayIncludes: ['李宁'] } },
  { name: '学术讲座预约平台有多少用户？', ui: BOARD_FULL, expect: { tools: [], sayIncludes: ['1260'] } },
  { name: '在看板页问后台有多少会话', ui: { ...BOARD_FULL, adminStats: { sessions: 42, documents: 1 } }, expect: { tools: [], sayIncludes: ['42'] } },

  // ---- 复合指令：动作 + 同时回答 ----
  {
    name: '打开管理后台，顺便告诉我有几个会话',
    ui: { ...BOARD_FULL, adminStats: { sessions: 42, documents: 1 } },
    expect: {
      tools: [],
      anyOf: [
        { tool: 'open_admin_tab', args: { tab: 'dashboard' } },
        { tool: 'navigate_page', args: { page: 'admin' } }
      ],
      sayIncludes: ['42']
    }
  },
  {
    name: '打开实验室预约系统的详情，然后告诉我它用什么技术栈',
    ui: BOARD_FULL,
    expect: { tools: [{ tool: 'open_project', args: { project: '实验室预约系统' } }], sayIncludes: ['Vue 3'] }
  },
  {
    name: '切到数据总览，顺便说说有几个项目',
    ui: BOARD_FULL,
    expect: { tools: [{ tool: 'set_board_view', args: { view: 'overview' } }], sayIncludes: ['4'] }
  },
  { name: '管理后台有多少个会话', ui: { page: 'admin', adminTab: 'dashboard', adminStats: { sessions: 42, documents: 3 } }, expect: { tools: [], sayIncludes: ['42'] } },
  { name: '知识库里有哪些文档', ui: { page: 'admin', adminTab: 'knowledge', adminStats: { sessions: 1, documents: 2 }, knowledgeDocs: ['产教融合服务平台.md', '实验室预约系统说明.md'] }, expect: { tools: [], sayIncludes: ['产教融合'] } },
  // ---- 多动作时序 ----
  {
    name: '把详情关了，再切到数据总览',
    ui: { ...BOARD_UI, openProject: '实验室预约系统' },
    expect: { tools: [{ tool: 'close_drawer' }, { tool: 'set_board_view', args: { view: 'overview' } }] }
  },
  {
    name: '先回到看板，再打开学术讲座预约平台的详情',
    ui: { page: 'admin', adminTab: 'knowledge' },
    // open_project 本身会切回看板并打开详情，所以只要求它出现；navigate 可有可无
    expect: { tools: [{ tool: 'open_project', args: { project: '学术讲座预约平台' } }] }
  },
  {
    name: '打开管理后台，切到知识库管理，再说说有几篇文档',
    ui: { ...BOARD_FULL, adminStats: { sessions: 42, documents: 1 }, knowledgeDocs: ['产教融合服务平台.md'] },
    expect: { tools: [{ tool: 'open_admin_tab', args: { tab: 'knowledge' } }], sayIncludes: ['1'] }
  },

  // ---- 能力介绍 / 系统导览 / 指代回指 ----
  { name: '你能做什么？', ui: BOARD_FULL, expect: { tools: [], sayAnyOf: ['看板', '界面', '页面', '项目'] } },
  {
    name: '帮我把这个系统讲一遍',
    ui: BOARD_FULL,
    expect: { tools: [], sayIncludes: ['看板'] }
  },
  {
    name: '刚才那个项目叫什么来着',
    ui: BOARD_FULL,
    history: [
      { role: 'user', content: '学术讲座预约平台有多少用户？' },
      { role: 'assistant', content: '学术讲座预约平台累计用户 1260 人。' }
    ],
    expect: { tools: [], sayIncludes: ['学术讲座'] }
  },
  {
    name: '它上线了吗',
    ui: BOARD_UI,
    history: [
      { role: 'user', content: '平台是干什么的？' },
      { role: 'assistant', content: '产教融合服务平台是学校和企业之间的技术对接平台，目前还是演示版，没有正式上线。' },
    ],
    expect: { tools: [] },
  },
]

async function ask(question, ui, history) {
  const response = await fetch(BASE + '/api/v1/agent/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, ui: { ...ui, projects: PROJECTS }, history: history || [] }),
  })
  if (!response.ok || !response.body) throw new Error('HTTP ' + response.status)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let event = ''
  const actions = []
  const tokens = []
  let error = null
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
      if (event === 'action') {
        try { actions.push(JSON.parse(payload)) } catch {}
      } else if (event === 'token') {
        try { tokens.push(JSON.parse(payload).text || '') } catch {}
      } else if (event === 'error') {
        try { error = JSON.parse(payload).message || 'error' } catch { error = 'error' }
      }
    }
  }
  return { actions, say: tokens.join(''), error }
}

function matches(action, want) {
  if (action.tool !== want.tool) return false
  for (const [key, value] of Object.entries(want.args || {})) {
    if (String(action.args?.[key] ?? '') !== String(value)) return false
  }
  return true
}

function check(expect, actions, say, error) {
  const problems = []
  if (error) problems.push('请求返回错误：' + error)
  const usedTools = actions.map((a) => a.tool)
  for (const want of expect.tools || []) {
    const hit = actions.find((a) => a.tool === want.tool)
    if (!hit) {
      problems.push('缺少动作 ' + want.tool)
      continue
    }
    for (const [key, value] of Object.entries(want.args || {})) {
      const actual = hit.args?.[key]
      if (Array.isArray(value)) {
        if (!value.includes(actual)) problems.push(want.tool + '.' + key + ' 期望∈' + JSON.stringify(value) + ' 实际=' + JSON.stringify(actual))
      } else if (String(actual ?? '') !== String(value)) {
        problems.push(want.tool + '.' + key + ' 期望=' + JSON.stringify(value) + ' 实际=' + JSON.stringify(actual))
      }
    }
  }
  if (expect.anyOf && expect.anyOf.length > 0) {
    const hit = expect.anyOf.some((want) => actions.some((action) => matches(action, want)))
    if (!hit) {
      problems.push('anyOf 未命中：' + JSON.stringify(expect.anyOf.map((w) => w.tool)))
    }
  }
  for (const bad of expect.forbid || []) {
    if (usedTools.includes(bad)) problems.push('不该出现动作 ' + bad)
  }
  if ((expect.tools || []).length === 0 && !expect.anyOf && actions.length > 0) {
    problems.push('期望无动作，实际=' + JSON.stringify(usedTools))
  }
  for (const keyword of expect.sayIncludes || []) {
    if (!say.includes(keyword)) problems.push('回答里应包含「' + keyword + '」')
  }
  if (expect.sayAnyOf && expect.sayAnyOf.length > 0) {
    const hit = expect.sayAnyOf.some((keyword) => say.includes(keyword))
    if (!hit) problems.push('回答里应至少包含其一：' + JSON.stringify(expect.sayAnyOf))
  }
  return problems
}

let passed = 0
const failures = []
for (const item of CASES) {
  try {
    let result = await ask(item.name, item.ui, item.history)
    if (result.error || (!result.say && !result.actions.length)) {
      // 偶发的模型/网络错误：重试一次再判
      await new Promise((resolve) => setTimeout(resolve, 800))
      result = await ask(item.name, item.ui, item.history)
    }
    let problems = check(item.expect, result.actions, result.say, result.error)
    let flaky = false
    if (problems.length > 0) {
      // 模型有随机性：再给一次机会，通过则标记 flaky（不掩盖问题，但避免误报）
      await new Promise((resolve) => setTimeout(resolve, 600))
      const retried = await ask(item.name, item.ui, item.history)
      const retryProblems = check(item.expect, retried.actions, retried.say, retried.error)
      if (retryProblems.length === 0) {
        problems = []
        flaky = true
        result = retried
      } else {
        problems = retryProblems
        result = retried
      }
    }
    if (problems.length === 0) {
      passed += 1
      console.log((flaky ? '  ⚠️ ' : '  ✅ ') + item.name + (flaky ? '（重试后通过）' : ''))
    } else {
      failures.push({ name: item.name, problems, result })
      console.log('  ❌ ' + item.name + ' → ' + problems.join('；'))
      if (VERBOSE) console.log('     实际动作: ' + JSON.stringify(result.actions) + '\n     话术: ' + result.say.slice(0, 120))
    }
  } catch (error) {
    failures.push({ name: item.name, problems: [String(error)] })
    console.log('  ❌ ' + item.name + ' → 请求失败 ' + error)
  }
}

console.log('\n通过 ' + passed + ' / ' + CASES.length)
if (failures.length > 0) {
  console.log('\n失败明细:')
  for (const item of failures) console.log('- ' + item.name + ': ' + item.problems.join('；'))
  process.exit(1)
}
