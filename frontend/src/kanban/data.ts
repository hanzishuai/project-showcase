export interface KanbanStage {
  name: string
  color: string
}

export interface KanbanVersion {
  number: string
  stage: number
  days: number
  start: string
  // 交付日期（YYYY-MM-DD）。已上线项目在详情抽屉显示为「交付时间」，其余显示「预计交付」。
  // 可选字段：兼容旧 localStorage 存档，资料未提供时留空显示「—」，不再按开始日期自动推算。
  delivery?: string
  note: string
}

export interface KanbanProject {
  name: string
  intro?: string
  owner: string
  team: string
  users: number
  features: number
  stack: string[]
  images: string[]
  videos?: string[]
  versions: KanbanVersion[]
}

export interface KanbanData {
  stages: KanbanStage[]
  projects: KanbanProject[]
  schema?: number
}

export const KANBAN_DATA_KEY = 'kanban-board-data-v1'

// 数据代次：默认数据发生实质变化时 +1，让浏览器里旧的 localStorage 存档自动失效，
// 避免刷新后仍看到旧阶段 / 旧项目。2 = project/ 真实资料；3 = 科研申报系统改为「上线」并补使用情况。
export const KANBAN_SCHEMA = 3

// 默认数据唯一真源：仓库根目录 data/kanban-board.json（2026-11-15 从本机「数据修改」页存档导出）。
// 这样从 GitHub 拉下来的干净副本，在全新浏览器里打开看到的内容与本机一致；
// 运行时仍以浏览器 localStorage 为准（见 loadKanbanData），本文件只决定「没有存档时」的初值。
import boardSnapshot from '../../../data/kanban-board.json'

export const KANBAN_DEFAULT_STAGES: KanbanStage[] = (boardSnapshot.stages as KanbanStage[]).map((stage) => ({
  name: stage.name,
  color: stage.color
}))

// 名称、简介、截图、视频、成员与使用数据同样来自 data/kanban-board.json（与上面 stages 同一份快照），
// 保证从 GitHub 拉下来的干净副本在全新浏览器里看到的初值与本机「数据修改」页一致。
// 文档未提供的字段仍保持「—」或 0，不编造。
const normalizeProject = (project: (typeof boardSnapshot.projects)[number]): KanbanProject => ({
  name: project.name,
  intro: typeof project.intro === 'string' ? project.intro : '',
  owner: project.owner ?? '—',
  team: project.team ?? '—',
  users: Number(project.users) || 0,
  features: Number(project.features) || 0,
  stack: Array.isArray(project.stack) ? [...project.stack] : [],
  images: Array.isArray(project.images) ? [...project.images] : [],
  videos: Array.isArray(project.videos) ? [...project.videos] : [],
  versions: (project.versions ?? []).map((version) => ({
    number: version.number,
    stage: Number(version.stage) || 0,
    days: Number(version.days) || 0,
    start: version.start ?? '—',
    delivery: version.delivery ?? '',
    note: version.note ?? ''
  }))
})

export const KANBAN_DEFAULT_PROJECTS: KanbanProject[] = boardSnapshot.projects.map(normalizeProject)

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function defaultKanbanData(): KanbanData {
  return {
    stages: clone(KANBAN_DEFAULT_STAGES),
    projects: clone(KANBAN_DEFAULT_PROJECTS),
    schema: KANBAN_SCHEMA
  }
}

let serverBoard: KanbanData = defaultKanbanData()
let serverRevision = 0
let boardAvailable = false

export async function initializeKanbanData(): Promise<void> {
  try {
    const response = await fetch('/api/board', { cache: 'no-store' })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const result = await response.json()
    if (!Array.isArray(result.data?.stages) || !Array.isArray(result.data?.projects)) throw new Error('数据格式错误')
    serverBoard = result.data
    serverRevision = result.revision
    boardAvailable = true
  } catch (error) {
    boardAvailable = false
    console.error('无法读取服务器看板数据', error)
    window.alert('无法读取服务器看板，当前显示默认数据且无法保存。请检查服务后刷新。')
  }
}

export function loadKanbanData(): KanbanData { return clone(serverBoard) }
export function legacyKanbanData(): KanbanData | null {
  try {
    const raw = localStorage.getItem(KANBAN_DATA_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return Array.isArray(data.stages) && data.stages.length && Array.isArray(data.projects) ? data : null
  } catch { return null }
}
export async function saveKanbanData(data: KanbanData): Promise<void> {
  if (!boardAvailable) throw new Error('无法连接服务器，请刷新后重试')
  const token = localStorage.getItem('admin-token') || ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['X-Admin-Token'] = token
  const response = await fetch('/api/board', { method: 'PUT', headers, body: JSON.stringify({ data, revision: serverRevision }) })
  if (!response.ok) {
    if (response.status === 409) throw new Error('服务器数据已被其他人修改，请刷新后重新编辑')
    if (response.status === 401 || response.status === 403) throw new Error('需要管理员口令，请先在管理后台输入口令')
    throw new Error('保存失败（HTTP ' + response.status + '）')
  }
  serverRevision = (await response.json()).revision
  serverBoard = clone(data)
}
export function resetKanbanData(): void { serverBoard = defaultKanbanData() }

// 兼容旧引用：看板运行时以 loadKanbanData() 为准
export const KANBAN_STAGES = KANBAN_DEFAULT_STAGES
export const KANBAN_PROJECTS = KANBAN_DEFAULT_PROJECTS

export const KANBAN_WEEKS = ['09/21', '09/28', '10/05', '10/12', '10/19', '10/26', '11/02', '11/09']

// 概览页趋势折线仍为平台演示数据，与 project/ 真实项目未挂钩（README 已披露）。
export const KANBAN_TREND: Record<string, number[]> = {
  开发: [3, 4, 3, 5, 4, 5, 4, 4],
  测试: [1, 2, 3, 2, 3, 2, 3, 2],
  已上线: [4, 5, 6, 6, 7, 7, 8, 8]
}
