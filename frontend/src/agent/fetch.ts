/**
 * 自定义 fetch：把数字人的 /ask 请求转到 Agent 端点，并顺便执行返回的动作。
 *
 * 做法：把响应流 tee 成两路 —— 一路原样交给 rag-avatar 组件做流式显示，
 * 另一路自己解析 SSE，遇到 `action` 事件就丢给动作总线。
 */
import { dispatchAction, type AgentAction } from './bus'
import { snapshotUiState } from './uiState'

interface Turn {
  role: 'user' | 'assistant'
  content: string
}

/** 最近几轮问答：随请求带给模型理解指代，并持久化到 sessionStorage（刷新后仍能接上） */
const HISTORY_LIMIT = 12
const HISTORY_KEY = 'agent-chat-history-v1'

function loadHistory(): Turn[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is Turn => !!item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
      .slice(-HISTORY_LIMIT)
  } catch {
    return []
  }
}

const history: Turn[] = loadHistory()

function saveHistory(): void {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {
    // 存储不可用时忽略（隐私模式等）
  }
}

function pushTurn(role: Turn['role'], content: string): void {
  const text = content.trim()
  if (!text) return
  history.push({ role, content: text })
  while (history.length > HISTORY_LIMIT) history.shift()
  saveHistory()
}

const RAG_ASK = '/api/v1/rag/ask'
const AGENT_ASK = '/api/v1/agent/ask'

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return (input as Request).url
}

async function consumeStream(stream: ReadableStream<Uint8Array>, question: string): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let eventName = ''
  let answer = ''
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
        } else if (line.startsWith('data:')) {
          const payload = line.slice(5).trim()
          if (eventName === 'action') {
            try {
              dispatchAction(JSON.parse(payload) as AgentAction)
            } catch {
              // 忽略坏帧
            }
          } else if (eventName === 'token') {
            try {
              answer += String(JSON.parse(payload)?.text ?? '')
            } catch {
              // 忽略坏帧
            }
          }
        }
        index = buffer.indexOf('\n')
      }
    }
  } catch {
    // 流被中断（用户打断）时静默结束
  } finally {
    reader.releaseLock()
    if (answer.trim()) {
      pushTurn('user', question)
      pushTurn('assistant', answer)
    }
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
  const question = String(body.question ?? '')
  const response = await fetch(AGENT_ASK, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, ui: snapshotUiState(), history: [...history] }),
    signal: init?.signal
  })

  if (!response.ok || !response.body) return response
  const [forSdk, forActions] = response.body.tee()
  void consumeStream(forActions, question)
  return new Response(forSdk, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  })
}
