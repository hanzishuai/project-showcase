const BASE = '/api/admin'
// Knowledge-base preview/commit live on the embeddable RAG surface.
const RAG = '/api/v1/rag'

async function request(url: string, options?: RequestInit, base = BASE): Promise<any> {
  const opts: RequestInit = { ...options }
  const isFormData = opts.body instanceof FormData
  if (!opts.headers && !isFormData) {
    opts.headers = { 'Content-Type': 'application/json' }
  }
  const res = await fetch(`${base}${url}`, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data?.detail ?? data?.error
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((item: any) => item?.msg || '').filter(Boolean).join('；')
        : ''
    throw new Error(message || `请求失败 (${res.status})`)
  }
  return data
}

export interface KnowledgeChunk {
  index: number
  title: string
  text: string
  chars: number
}

export interface KnowledgePreview {
  filename: string
  title: string
  markdown: string
  markdown_chars: number
  chunks: KnowledgeChunk[]
  warnings: string[]
}

export interface KnowledgeDocument {
  name: string
  size: number
  /** Epoch seconds from the RAG API (older admin API returned an ISO string). */
  modified_at: number | string
}

export interface KnowledgeCommitResult {
  status: string
  filename: string
  path?: string
  chunks: number
  documents: number
}

export interface KnowledgeRebuildResult {
  status: string
  chunks: number
  documents?: number
}

export const api = {
  listSessions: (limit = 50, offset = 0) => request(`/sessions?limit=${limit}&offset=${offset}`),
  getMessages: (sid: string) => request(`/sessions/${sid}/messages`),
  deleteSession: (sid: string) => request(`/sessions/${sid}`, { method: 'DELETE' }),
  searchSessions: (q: string) => request(`/sessions/search?q=${encodeURIComponent(q)}`),

  getStats: () => request('/stats'),

  /** Parse an upload and return chunks without touching the index. */
  previewDocument: (file: File): Promise<KnowledgePreview> => {
    const form = new FormData()
    form.append('file', file)
    return request('/knowledge/preview', { method: 'POST', body: form }, RAG)
  },
  /** Write the previewed markdown into docs/ and rebuild the index. */
  commitDocument: (filename: string, markdown: string): Promise<KnowledgeCommitResult> =>
    request('/knowledge/commit', { method: 'POST', body: JSON.stringify({ filename, markdown }) }, RAG),
  rebuildIndex: (): Promise<KnowledgeRebuildResult> => request('/knowledge/rebuild', { method: 'POST' }, RAG),
  listDocuments: (): Promise<{ data: KnowledgeDocument[] }> => request('/knowledge/documents', undefined, RAG),
  deleteDocument: (filename: string) =>
    request(`/knowledge/documents/${encodeURIComponent(filename)}`, { method: 'DELETE' }, RAG),
}
