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

export function loadKanbanData(): KanbanData {
  try {
    const raw = localStorage.getItem(KANBAN_DATA_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as KanbanData
      if (Array.isArray(parsed.stages) && parsed.stages.length > 0 && Array.isArray(parsed.projects)) {
        // 旧代次存档不再沿用，直接回退到当前默认资料。
        if (parsed.schema !== KANBAN_SCHEMA) return defaultKanbanData()
        for (const project of parsed.projects) {
          if (!Array.isArray(project.videos)) project.videos = []
          if (typeof project.intro !== 'string') project.intro = ''
        }
        return parsed
      }
    }
  } catch {
    // 浏览器禁用本地存储或数据损坏时回退到默认数据
  }
  return defaultKanbanData()
}

export function saveKanbanData(data: KanbanData): void {
  localStorage.setItem(KANBAN_DATA_KEY, JSON.stringify({ ...data, schema: KANBAN_SCHEMA }))
}

export function resetKanbanData(): void {
  localStorage.removeItem(KANBAN_DATA_KEY)
}

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
