import { reactive } from 'vue'

/** 当前界面状态：随组件变化更新，发给 Agent 作为上下文。 */
export const uiState = reactive({
  page: 'board' as 'board' | 'edit' | 'admin',
  boardView: 'board' as 'board' | 'overview',
  projectFilter: '',
  advisorFilter: '',
  showHistory: false,
  openProject: '',
  adminTab: 'dashboard' as 'dashboard' | 'conversations' | 'knowledge',
  /** 全屏灯箱等遮罩打开时隐藏数字人，避免压在上面 */
  modalOpen: false
})

export function snapshotUiState(): Record<string, unknown> {
  return {
    page: uiState.page,
    boardView: uiState.boardView,
    projectFilter: uiState.projectFilter,
    advisorFilter: uiState.advisorFilter,
    showHistory: uiState.showHistory,
    openProject: uiState.openProject,
    adminTab: uiState.adminTab
  }
}
