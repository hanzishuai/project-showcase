/**
 * Agent 动作总线：后端返回的 action 事件在这里分发给页面注册的处理函数。
 *
 * 页面在 onMounted 注册、onBeforeUnmount 注销；没有处理函数的动作会短暂排队重试，
 * 以便「先导航、再操作」这类连续动作在目标页面挂载后仍能执行。
 */
export interface AgentAction {
  tool: string
  args: Record<string, unknown>
}

type Handler = (args: Record<string, unknown>) => boolean | void

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
    handler(action.args ?? {})
    return true
  } catch (error) {
    console.warn('[agent] action failed', action.tool, error)
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
