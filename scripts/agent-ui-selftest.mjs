#!/usr/bin/env node
/**
 * Agent 浏览器级自测：真开 Chrome、真点、真看 DOM。
 *
 * 用法：node scripts/agent-ui-selftest.mjs [--keep]
 * 前置：服务已在 127.0.0.1:8000 运行。
 */
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.AGENT_BASE || 'http://127.0.0.1:8000'
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function findTarget(port, tries = 80) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/json/list')
      const list = await response.json()
      const page = list.find((item) => item.type === 'page' && String(item.url).includes('127.0.0.1:8000'))
      if (page) return page
    } catch {
      // Chrome 还没起来
    }
    await sleep(250)
  }
  throw new Error('无法连接 Chrome')
}

function createCdp(ws) {
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
  return { send, evaluate, errors }
}

const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (ok || !detail ? '' : ' → ' + detail))
}

let child = null
let profileDir = null
try {
  profileDir = await mkdtemp(join(tmpdir(), 'agent-ui-'))
  const port = 9400 + Math.floor(Math.random() * 100)
  child = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--window-size=1920,1080',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
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
  const { send, evaluate, errors } = createCdp(ws)
  await send('Runtime.enable')
  await sleep(5000)

  const ask = async (question, wait = 4500) => {
    const submitted = await evaluate(`(() => {
      const ta = document.querySelector('.pp7-chat-textarea');
      if (!ta) return 'no-textarea';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, ${JSON.stringify(question)});
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const form = document.querySelector('.pp7-chat-input');
      if (!form) return 'no-form';
      form.requestSubmit();
      return 'ok';
    })()`)
    if (submitted !== 'ok') throw new Error(submitted)
    await sleep(wait)
  }

  const askExpect = async (question, check, options = {}) => {
    const wait = options.wait ?? 4500
    await ask(question, wait)
    let snapshot = await state()
    if (check(snapshot)) return snapshot
    // 模型有随机性：再来一次
    await sleep(600)
    await ask(question, wait)
    snapshot = await state()
    return snapshot
  }

  const state = () =>
    evaluate(`(() => {
      const visible = (el) => !!el && getComputedStyle(el).display !== 'none';
      const selects = document.querySelectorAll('.controls select');
      const drawer = document.querySelector('aside.drawer');
      const dock = document.querySelector('.agent-dock');
      const stage = document.querySelector('.pet-stage');
      const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; };
      return {
        hash: location.hash,
        board: visible(document.querySelector('main.board-view')),
        overview: visible(document.querySelector('main.overview')),
        advisor: selects[1] ? selects[1].value : null,
        cards: document.querySelectorAll('.version-card').length,
        drawerOpen: drawer ? drawer.className.includes('open') : false,
        admin: !!document.querySelector('.admin-root'),
        adminTab: (document.querySelector('.admin-root .nav-link.active') || {}).textContent || '',
        dock: rect(dock),
        stage: rect(stage),
        toasts: [...document.querySelectorAll('.arco-message')].map((e) => e.textContent.trim()),
        lastReply: (() => { const list = document.querySelectorAll('.pp7-chat-msg'); const last = list[list.length - 1]; return last ? (last.querySelector('.pp7-chat-msg__bubble')?.textContent || '').trim() : ''; })(),
        modal: [...document.querySelectorAll('.arco-modal')].some((m) => {
          const style = getComputedStyle(m);
          return style.display !== 'none' && style.visibility !== 'hidden' && m.getBoundingClientRect().width > 0;
        })
      };
    })()`)

  // 1. 初始状态：浮层贴合留白区
  const s0 = await state()
  record('浮层贴合并列位', !!s0.dock && !!s0.stage && s0.dock.x === s0.stage.x && s0.dock.w === s0.stage.w, JSON.stringify({ dock: s0.dock, stage: s0.stage }))
  record('看板初始 9 张卡', s0.cards === 9, String(s0.cards))

  // 2. 切数据总览
  await ask('把看板切到数据总览')
  const s1 = await state()
  record('切到数据总览', s1.overview && !s1.board, JSON.stringify({ overview: s1.overview, board: s1.board }))

  // 3. 筛选
  await ask('切回生命周期看板，只看张三指导的项目', 3000)
  const s2 = await state()
  record('筛出张三的项目', s2.advisor === '张三' && s2.cards === 1, JSON.stringify({ advisor: s2.advisor, cards: s2.cards }))
  record('筛选结果有提示', s2.toasts.some((t) => t.includes('张三')), JSON.stringify(s2.toasts))

  // 4. 打开详情
  await ask('打开实验室预约系统的详情', 3500)
  const s3 = await state()
  record('详情抽屉打开', s3.drawerOpen, JSON.stringify(s3.drawerOpen))

  // 4.5 关抽屉 + 清筛选（后续步骤要求看得到全部项目）
  await ask('把详情关了，然后显示全部项目', 3500)

  // 5. 跳后台 + 页签（带一次重试）
  const s4 = await askExpect('打开管理后台的知识库页面', (snap) => snap.hash === '#/admin' && snap.admin, { wait: 4500 })
  record('跳到管理后台', s4.hash === '#/admin' && s4.admin, JSON.stringify({ hash: s4.hash, admin: s4.admin }))
  record('知识库页签高亮', s4.adminTab.includes('知识库'), s4.adminTab)
  record('后台浮层仍在（默认收起）', !!s4.dock && (s4.dock.w === 380 || s4.dock.w === 88), JSON.stringify(s4.dock))
  // 收起状态点气泡应能展开
  const bubble = await evaluate(`(() => { const b = document.querySelector('.agent-dock__bubble'); if (!b) return 'no-bubble'; b.click(); return 'clicked'; })()`)
  await sleep(800)
  const sExpanded = await state()
  record('点气泡可展开浮层', sExpanded.dock && sExpanded.dock.w === 380, JSON.stringify({ bubble, dock: sExpanded.dock }))
  await evaluate(`(() => { const t = document.querySelector('.agent-dock__toggle'); if (t) t.click(); return true; })()`)
  await sleep(600)

  // 6.05 后台「系统设置」页
  await evaluate(`(() => { const b=[...document.querySelectorAll('.admin-root .nav-link')].find(x=>x.textContent.includes('系统设置')); if (b) b.click(); return true; })()`)
  await sleep(2500)
  const sSettings = await evaluate(`(() => ({
    heading: (document.querySelector('.admin-root .page-heading h2')||{}).textContent,
    groups: document.querySelectorAll('.admin-root .group-title').length,
    fields: document.querySelectorAll('.admin-root .field').length,
    buttons: [...document.querySelectorAll('.admin-root .actions button')].map(b => b.textContent.trim())
  }))()`)
  record('系统设置页渲染', sSettings.heading === '系统设置' && sSettings.groups >= 5 && sSettings.fields >= 10, JSON.stringify(sSettings))
  record('设置页有测试按钮', sSettings.buttons.some((b) => b.includes('测试')), JSON.stringify(sSettings.buttons))

  // 6.06 唤醒词：设置页改完立即写 localStorage，并同步常驻浮层的提示
  const wakeInput = await evaluate(`(() => {
    const title = [...document.querySelectorAll('.admin-root .group-title')].find((t) => t.textContent.includes('语音唤醒'));
    if (!title) return { found: false };
    const input = title.closest('section').querySelector('input');
    if (!input) return { found: true, input: false };
    input.focus();
    input.value = '小助手';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { found: true, input: true, value: input.value };
  })()`)
  record('设置页有唤醒词输入框', wakeInput.found && wakeInput.input, JSON.stringify(wakeInput))
  await sleep(300)
  await evaluate(`(() => {
    const title = [...document.querySelectorAll('.admin-root .group-title')].find((t) => t.textContent.includes('语音唤醒'));
    title.closest('section').querySelector('input').blur();
    return true;
  })()`)
  await sleep(600)
  const wakeState = await evaluate(`(() => ({
    stored: localStorage.getItem('agent-wake-phrase'),
    dockTitle: (document.querySelector('.agent-dock__wake') || {}).title || '',
    toasts: [...document.querySelectorAll('.arco-message')].map((e) => e.textContent.trim())
  }))()`)
  record('唤醒词写入 localStorage', wakeState.stored === '小助手', JSON.stringify(wakeState))
  record('改唤醒词后浮层提示同步', wakeState.dockTitle.includes('小助手'), wakeState.dockTitle)
  record('唤醒词保存有提示', wakeState.toasts.some((t) => t.includes('小助手')), JSON.stringify(wakeState.toasts))
  // 恢复默认，避免影响后续用例
  await evaluate(`(() => {
    const title = [...document.querySelectorAll('.admin-root .group-title')].find((t) => t.textContent.includes('语音唤醒'));
    const input = title.closest('section').querySelector('input');
    input.focus();
    input.value = '你好你好';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur();
    return true;
  })()`)
  await sleep(400)
  const wakeReset = await evaluate("localStorage.getItem('agent-wake-phrase')")
  record('唤醒词可恢复默认', wakeReset === '你好你好', String(wakeReset))

  await evaluate(`(() => { const b=[...document.querySelectorAll('.admin-root .nav-link')].find(x=>x.textContent.includes('知识库')); if (b) b.click(); return true; })()`)
  await sleep(1500)

  // 6. 写操作被拒绝
  const beforeModal = s4.modal
  await ask('重建知识库索引', 4000)
  const s5 = await state()
  record('写操作不执行（无确认框）', !beforeModal && !s5.modal, JSON.stringify({ modal: s5.modal }))

  // 6.5 看板事实问答：应直接回答，不打开详情
  await ask('返回看板', 2500)
  await ask('实验室预约系统现在什么进度', 3500)
  const sFact = await state()
  record('看板事实问答不弹详情', !sFact.drawerOpen, JSON.stringify({ drawer: sFact.drawerOpen }))
  record('回答包含阶段信息', sFact.lastReply.includes('开发') || sFact.lastReply.includes('v1.2'), sFact.lastReply.slice(0, 40))

  // 6.55 复合指令：动作 + 同时回答（此时无筛选）
  await ask('显示全部项目', 2500)
  const sCompound = await askExpect('打开学术讲座预约平台，顺便说说它有多少用户', (snap) => snap.drawerOpen, { wait: 4500 })
  record('复合指令执行了动作', sCompound.drawerOpen, JSON.stringify({ drawer: sCompound.drawerOpen }))
  record('复合指令同时回答了数据', sCompound.lastReply.includes('1260'), sCompound.lastReply.slice(0, 50))
  await ask('把详情关了', 2500)

  // 6.58 动作失败：由数字人开口解释，而不是弹 toast
  await evaluate(`window.__agentDispatchAction({ tool: 'open_project', args: { project: '不存在的项目' } })`)
  await sleep(800)
  const sFail = await state()
  record('动作失败由数字人解释', sFail.lastReply.includes('没找到'), sFail.lastReply.slice(0, 30))

  // 6.6 窗口缩放后浮层仍贴合
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await sleep(1200)
  const sSmall = await state()
  record('缩放后浮层仍贴合', !!sSmall.dock && !!sSmall.stage && sSmall.dock.x === sSmall.stage.x && Math.abs(sSmall.dock.w - sSmall.stage.w) <= 1, JSON.stringify({ dock: sSmall.dock, stage: sSmall.stage }))
  await send('Emulation.clearDeviceMetricsOverride')
  await sleep(800)

  // 7. 返回看板
  await ask('返回到看板', 3500)
  const s6 = await state()
  record('返回看板', s6.hash === '#/' && s6.board, JSON.stringify({ hash: s6.hash, board: s6.board }))
  record('浮层重新贴合', !!s6.dock && !!s6.stage && s6.dock.x === s6.stage.x, JSON.stringify({ dock: s6.dock, stage: s6.stage }))

  // 7.5 播报中打断：点麦克风应停止播报并开始录音
  await ask('帮我把这个系统讲一遍，从头开始', 1000)
  let speakingSeen = false
  for (let i = 0; i < 20; i += 1) {
    await sleep(500)
    const status = await evaluate(`(document.querySelector('.pp7-chat-header__status')||{}).textContent || ''`)
    if (status.includes('正在播报')) { speakingSeen = true; break }
  }
  record('长回答进入播报状态', speakingSeen, '未观察到播报状态')
  await evaluate(`document.querySelector('.pp7-chat-mic').click()`)
  await sleep(1200)
  const sBarge = await evaluate(`(() => ({
    status: (document.querySelector('.pp7-chat-header__status')||{}).textContent || '',
    recording: !!document.querySelector('.pp7-chat-recording')
  }))()`)
  record('播报中点麦克风打断并录音', !sBarge.status.includes('正在播报') && sBarge.recording, JSON.stringify(sBarge))
  // 结束录音，等状态回落，避免影响后续步骤
  await evaluate(`(() => { const m = document.querySelector('.pp7-chat-mic'); if (m && m.className.includes('is-recording')) m.click(); return true; })()`)
  await sleep(4000)
  await evaluate(`(() => { const b = document.querySelector('.pp7-chat-action'); if (b && b.textContent.includes('打断')) b.click(); return true; })()`)
  await sleep(1500)

  // 8. 刷新后仍记得上下文（历史持久化在 sessionStorage）
  await ask('学术讲座预约平台有多少用户？', 5000)
  let beforeReload = await state()
  if (!beforeReload.lastReply.includes('1260')) {
    await ask('学术讲座预约平台有多少用户？', 5000)
    beforeReload = await state()
  }
  record('刷新前上下文已就位', beforeReload.lastReply.includes('1260'), beforeReload.lastReply.slice(0, 40))
  await send('Page.reload')
  await sleep(8000)
  await ask('刚才那个项目叫什么来着？', 5000)
  const sReload = await state()
  record('刷新后仍能指代', sReload.lastReply.includes('学术讲座'), sReload.lastReply.slice(0, 40))

  record('无前端报错', errors.length === 0, JSON.stringify(errors.slice(0, 3)))
  ws.close()
} catch (error) {
  record('测试执行', false, String(error))
} finally {
  if (child) {
    try { process.kill(-child.pid, 'SIGKILL') } catch {}
    try { child.kill('SIGKILL') } catch {}
  }
  if (profileDir) await rm(profileDir, { recursive: true, force: true }).catch(() => {})
}

const passed = results.filter((r) => r.ok).length
console.log('\n通过 ' + passed + ' / ' + results.length)
if (passed !== results.length) process.exit(1)
