import { reactive } from 'vue'

/** 当前界面状态：随组件变化更新，发给 Agent 作为上下文。 */
export const uiState = reactive({
  page: 'board' as 'board' | 'edit' | 'admin',
  boardView: 'board' as 'board' | 'overview',
  projectFilter: '',
  advisorFilter: '',
  showHistory: false,
  openProject: '',
  openVersion: '',
  slideIndex: -1,
  mediaType: '' as '' | 'image' | 'video',
  mediaPlaying: false,
  adminTab: 'dashboard' as 'dashboard' | 'conversations' | 'knowledge' | 'settings',
  adminAccess: 'unknown' as 'unknown' | 'ready' | 'need-token',
  editProjectCount: 0,
  editVersionCount: 0,
  /** 全屏灯箱等遮罩打开时隐藏数字人，避免压在上面 */
  modalOpen: false,
  /** 图片灯箱状态：模型据此决定是「打开图片」还是「翻页」 */
  galleryOpen: false,
  galleryIndex: -1,
  /** 当前筛选后可见的版本卡数量，Agent 用它回答「还剩几个」 */
  visibleCards: 0,
  /** 管理后台概览数据 */
  adminStats: null as null | { sessions: number; documents: number },
  /** 知识库文档名，让 Agent 能回答「知识库里有哪些文档」 */
  knowledgeDocs: [] as string[]
})

export function snapshotUiState(): Record<string, unknown> {
  return {
    page: uiState.page,
    boardView: uiState.boardView,
    projectFilter: uiState.projectFilter,
    advisorFilter: uiState.advisorFilter,
    showHistory: uiState.showHistory,
    openProject: uiState.openProject,
    openVersion: uiState.openVersion,
    slideIndex: uiState.slideIndex,
    mediaType: uiState.mediaType,
    mediaPlaying: uiState.mediaPlaying,
    galleryOpen: uiState.galleryOpen,
    galleryIndex: uiState.galleryIndex,
    visibleCards: uiState.visibleCards,
    adminStats: uiState.adminStats,
    knowledgeDocs: uiState.knowledgeDocs,
    adminTab: uiState.adminTab,
    adminAccess: uiState.adminAccess,
    editProjectCount: uiState.editProjectCount,
    editVersionCount: uiState.editVersionCount
  }
}
