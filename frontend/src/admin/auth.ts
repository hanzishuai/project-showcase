/**
 * 管理后台口令（可选）。
 *
 * 服务端设置 ADMIN_TOKEN 后，/api/admin、问答日志、知识库管理需要 X-Admin-Token。
 * 口令存在 localStorage，本模块给这些请求自动加请求头；未设置口令时行为不变。
 */
const TOKEN_KEY = 'admin-token'

const ADMIN_PREFIXES = ['/api/admin', '/api/v1/rag/qa', '/api/v1/rag/knowledge']

export function getAdminToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setAdminToken(token: string): void {
  try {
    const next = token.trim()
    if (next) localStorage.setItem(TOKEN_KEY, next)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // 忽略
  }
}

function pathOf(input: RequestInfo | URL): string {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return url.replace(/^https?:\/\/[^/]+/, '')
}

function needsAdmin(url: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => url.startsWith(prefix))
}

export function installAdminFetch(): void {
  const holder = window as unknown as { __adminFetchInstalled?: boolean }
  if (holder.__adminFetchInstalled) return
  holder.__adminFetchInstalled = true
  const original = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (!needsAdmin(pathOf(input))) return original(input, init)
    const headers = new Headers(init?.headers || (typeof input === 'object' && !(input instanceof URL) ? input.headers : undefined))
    const token = getAdminToken()
    if (token) headers.set('X-Admin-Token', token)
    return original(input, { ...init, headers })
  }
}
