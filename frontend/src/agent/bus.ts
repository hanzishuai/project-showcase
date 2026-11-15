/**
 * Agent 动作总线：后端返回的 action 事件在这里分发给页面注册的处理函数。
 *
 * 页面在 onMounted 注册、onBeforeUnmount 注销；没有处理函数的动作会短暂排队重试，
 * 以便「先导航、再操作」这类连续动作在目标页面挂载后仍能执行。
 */
import { Message } from '@arco-design/web-vue'

export interface AgentAction {
  tool: string
  args: Record<string, unknown>
}

/** 动作失败时交给数字人亲口说（由 AgentDock 注册） */
let failureHandler: ((text: string) => void) | null = null

export function setActionFailureHandler(handler: ((text: string) => void) | null): void {
  failureHandler = handler
}

/** 动作执行失败时给用户的一句人话 */
const FAILURE_TEXT: Record<string, string> = {
  open_project: '没找到这个项目，看看名字对不对？',
  open_gallery: '先打开一个项目的详情，才能看图。',
  filter_board: '这个筛选条件没设上。',
}

type Handler = (args: Record<string, unknown>) => boolean | string | void

const handlers = new Map<string, Handler>()
const pending: AgentAction[] = []
let retryTimer: ReturnType<typeof setTimeout> | null = null

export function registerAction(tool: string, handler: Handler): () => void {
  handlers.set(tool, handler)
  return () => {
    if (handlers.get(tool) === handler) handlers.delete(tool)
  }
}

function run(action: AgentAction): boolean {
  const handler = handlers.get(action.tool)
  if (!handler) return false
  try {
    const result = handler(action.args ?? {})
    if (typeof result === 'string' && result) {
      Message.success({ content: result, duration: 2200 })
    } else if (result === false) {
      const text = FAILURE_TEXT[action.tool] ?? '这个操作没完成'
      // 优先让数字人说出来，其次才用 toast
      if (failureHandler) failureHandler(text)
      else Message.warning(text)
    }
    return true
  } catch (error) {
    console.warn('[agent] action failed', action.tool, error)
    Message.error('操作执行失败')
    return true
  }
}

function flushPending(): void {
  retryTimer = null
  const rest: AgentAction[] = []
  for (const action of pending.splice(0)) {
    if (!run(action)) rest.push(action)
  }
  pending.push(...rest)
  if (pending.length > 0) {
    retryTimer = setTimeout(flushPending, 150)
  }
}

// 方便调试/自测：在浏览器控制台直接派发动作
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__agentDispatchAction = dispatchAction
}

let waited = 0
export function dispatchAction(action: AgentAction): void {
  if (!action || !action.tool) return
  if (run(action)) return
  if (waited === 0) waited = Date.now()
  pending.push(action)
  if (pending.length > 0 && retryTimer === null) {
    retryTimer = setTimeout(() => {
      flushPending()
    }, 120)
  }
  // 超过 3 秒还找不到处理函数就丢弃，避免无限排队
  if (Date.now() - waited > 3000) {
    pending.length = 0
    waited = 0
  }
}
