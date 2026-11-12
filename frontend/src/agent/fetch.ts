/**
 * 自定义 fetch：把数字人的 /ask 请求转到 Agent 端点，并顺便执行返回的动作。
 *
 * 做法：把响应流 tee 成两路 —— 一路原样交给 rag-avatar 组件做流式显示，
 * 另一路自己解析 SSE，遇到 `action` 事件就丢给动作总线。
 */
import { dispatchAction, type AgentAction } from './bus'
import { snapshotUiState } from './uiState'

const RAG_ASK = '/api/v1/rag/ask'
const AGENT_ASK = '/api/v1/agent/ask'

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return (input as Request).url
}

async function consumeActions(stream: ReadableStream<Uint8Array>): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let eventName = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let index = buffer.indexOf('\n')
      while (index >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, '')
        buffer = buffer.slice(index + 1)
        if (line === '') {
          eventName = ''
        } else if (line.startsWith('event:')) {
          eventName = line.slice(6).trim()
        } else if (line.startsWith('data:') && eventName === 'action') {
          try {
            const payload = JSON.parse(line.slice(5).trim()) as AgentAction
            dispatchAction(payload)
          } catch {
            // 忽略坏帧
          }
        }
        index = buffer.indexOf('\n')
      }
    }
  } catch {
    // 流被中断（用户打断）时静默结束
  } finally {
    reader.releaseLock()
  }
}

export const agentFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = resolveUrl(input)
  if (!url.includes(RAG_ASK)) {
    return fetch(input, init)
  }

  let body: Record<string, unknown> = {}
  try {
    body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
  } catch {
    body = {}
  }

  const headers = new Headers(init?.headers ?? {})
  headers.set('Content-Type', 'application/json')
  const response = await fetch(AGENT_ASK, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, ui: snapshotUiState() }),
    signal: init?.signal
  })

  if (!response.ok || !response.body) return response
  const [forSdk, forActions] = response.body.tee()
  void consumeActions(forActions)
  return new Response(forSdk, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  })
}
