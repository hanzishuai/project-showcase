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
  modalOpen: false,
  /** 看板项目名，作为 Agent 的可用目标（避免它编造项目） */
  projects: [] as string[],
  /** 图片灯箱状态：模型据此决定是「打开图片」还是「翻页」 */
  galleryOpen: false,
  galleryIndex: -1
})

export function snapshotUiState(): Record<string, unknown> {
  return {
    page: uiState.page,
    boardView: uiState.boardView,
    projectFilter: uiState.projectFilter,
    advisorFilter: uiState.advisorFilter,
    showHistory: uiState.showHistory,
    openProject: uiState.openProject,
    galleryOpen: uiState.galleryOpen,
    galleryIndex: uiState.galleryIndex,
    adminTab: uiState.adminTab
  }
}
