import { uiState } from './uiState'

/** 拉取与页面无关的全局数据（后台统计、知识库文档），让 Agent 在任何页面都能回答。 */
export async function refreshGlobalContext(): Promise<void> {
  try {
    const response = await fetch('/api/admin/stats')
    if (response.ok) {
      const data = await response.json()
      uiState.adminStats = {
        sessions: Number(data.total_sessions ?? 0),
        documents: Number(data.total_documents ?? 0)
      }
    }
  } catch {
    // 忽略：不影响页面
  }
  try {
    const response = await fetch('/api/v1/rag/knowledge/documents')
    if (response.ok) {
      const data = await response.json()
      const list = Array.isArray(data.data) ? data.data : []
      uiState.knowledgeDocs = list
        .map((item: { name?: string }) => String(item?.name ?? ''))
        .filter(Boolean)
    }
  } catch {
    // 忽略
  }
}
