/** 执行页面动作并返回可用于模型的实际结果。 */
import { nextTick } from 'vue'
import { Message } from '@arco-design/web-vue'
import { snapshotUiState } from './uiState'

export interface AgentAction { tool: string; args: Record<string, unknown>; action_id?: string }
export interface ActionOutcome { ok: boolean; message: string; ui: Record<string, unknown> }
type Handler = (args: Record<string, unknown>, signal?: AbortSignal) => boolean | string | void | Promise<boolean | string | void>
const handlers = new Map<string, Handler>()
export function availableActions(): string[] { return [...handlers.keys()] }
let failureHandler: ((text: string) => void) | null = null
export function setActionFailureHandler(handler: ((text: string) => void) | null): void { failureHandler = handler }
export function registerAction(tool: string, handler: Handler): () => void {
  handlers.set(tool, handler)
  return () => { if (handlers.get(tool) === handler) handlers.delete(tool) }
}
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
export async function dispatchAction(action: AgentAction, signal?: AbortSignal): Promise<ActionOutcome> {
  let handler = handlers.get(action.tool)
  const deadline = Date.now() + 3000
  while (!handler && Date.now() < deadline && !signal?.aborted) {
    await delay(100)
    handler = handlers.get(action.tool)
  }
  let ok = false
  let message = ''
  if (signal?.aborted) message = '操作已中断'
  else if (!handler) message = '当前页面没有可用的操作处理器'
  else {
    try {
      const result = await handler(action.args ?? {}, signal)
      ok = result !== false
      message = typeof result === 'string' && result ? result : ok ? '操作完成' : '操作未完成，请检查当前页面和参数'
    } catch (error) { message = error instanceof Error ? error.message : '操作执行失败' }
  }
  if (!ok && !signal?.aborted) {
    if (failureHandler) failureHandler(message)
    else Message.warning(message)
  }
  await nextTick()
  return { ok, message, ui: { ...snapshotUiState(), availableActions: availableActions(), contractVersion: 1 } }
}
if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>).__agentDispatchAction = dispatchAction
