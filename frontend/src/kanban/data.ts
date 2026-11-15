export interface KanbanStage {
  name: string
  color: string
}

export interface KanbanVersion {
  number: string
  stage: number
  days: number
  start: string
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

export const KANBAN_DEFAULT_STAGES: KanbanStage[] = [
  { name: '需求对接', color: '#64748B' },
  { name: '数据库设计', color: '#22D3EE' },
  { name: '开发', color: '#3B82F6' },
  { name: '测试', color: '#A78BFA' },
  { name: '上线', color: '#34D399' }
]

// 名称、简介、截图、视频均来自仓库 project/ 目录已提交的资料。
// 文档未提供的字段（成员、用户数、功能数、阶段换算、开始日期）一律留「—」或 0，不编造。
export const KANBAN_DEFAULT_PROJECTS: KanbanProject[] = [
  {
    name: '高校党组织管理平台',
    intro: '面向高校党建工作的信息化系统，依据原型设计实现，前后端分离：后端 Spring Boot 3 + MySQL 提供纯 API，前端 Vue 3 + Vite 适配 PC 与移动端。按学生、支部书记、党委书记三类角色配合 JWT 鉴权，核心是入党全流程四阶段工作流（积极分子 8 项、发展对象 15 项、接收预备党员 4 项、转正 9 项材料逐级解锁），共七次审批、驳回须填理由，并做满 18 周岁与绩点校验、PDF 材料上传下载浏览。另有党员信息 Excel 批量导入导出、思想汇报三个月周期与超期提醒、入党积极分子在线考试（共产党员网 420 题随机抽题、自动判分、60 分合格）以及待办、公示与通知中心。',
    owner: '—',
    team: '—',
    users: 0,
    features: 0,
    stack: ['Spring Boot 3', 'MySQL', 'Vue 3', 'Vite', 'JWT'],
    images: [
      '/media/微信图片_20261109162755_36_102.jpg',
      '/media/微信图片_20261109162756_38_102.png',
      '/media/微信图片_20261109162757_39_102.png'
    ],
    versions: [
      { number: 'v1.0', stage: 2, days: 0, start: '—', note: '基于原型设计实现前后端分离与入党全流程四阶段工作流；文档未提供版本阶段与日期的结构化信息' }
    ]
  },
  {
    name: '科技成果转化平台',
    intro: '面向学校与企业技术成果、需求对接的演示平台（资料文档题为《产教融合服务平台项目情况汇报》）：学校发布科技成果、企业提出技术需求，可按技术领域查找，管理员把关并可下架。2026-10-27 开工，计划 11-13 交付演示；主要功能已做完，当前在做后台选项自维护、权限细化，并修复角色页面不刷新、身份显示不对、「我的发布」跳错等问题。平台尚未正式上线，演示版含 20 条成果、20 条需求、9 个技术领域与 24 张演示图片。正式上线仍需落到企业名下、补齐企业资质与备案域名、替换真实数据，并按学校意见调整企业微信登录。',
    owner: '—',
    team: '—',
    users: 0,
    features: 0,
    stack: [],
    images: [
      '/media/截图-科技成果列表.png',
      '/media/截图-企业需求列表.png',
      '/media/截图-管理后台统计.png',
      '/media/截图-操作日志.png'
    ],
    versions: [
      { number: 'v1.0', stage: 3, days: 0, start: '2026-10-27', note: '主要功能已做完，正在做后台选项自维护、权限细化与页面问题修复；尚未正式上线' }
    ]
  },
  {
    name: '科研项目申报系统',
    intro: '面向邯郸市科学技术局及全市科研单位、项目负责人的课题申报与审核业务平台，集课题发布、线上填报、材料上传、单位筛选、归口分发、处室审核、二次确认、线下评审与合同签订于一体，全程留痕，并支持申报书 PDF 生成导出。当前业务整体处于线下评审环节；现有 379 个申报个人、48 家单位、378 条申报书，其中 348 条待线下评审。以下截图取自项目介绍文档内嵌图片。',
    owner: '—',
    team: '—',
    // 使用情况两枚卡按 DOCX 已有数字映射口径：379 个申报个人 → 累计用户；9 个主要业务环节 → 上线功能。非运营统计。
    users: 379,
    features: 9,
    stack: [],
    images: [
      '/media/科研项目申报-1.png',
      '/media/科研项目申报-2.png',
      '/media/科研项目申报-3.png',
      '/media/科研项目申报-4.png',
      '/media/科研项目申报-5.png'
    ],
    versions: [
      { number: 'v1.0', stage: 4, days: 0, start: '—', note: '系统已上线运行；当前业务整体处于线下评审环节，文档未提供版本开始日期' }
    ]
  },
  {
    name: '智能小车实训项目',
    intro: '项目资料为两段现场演示视频与一张现场照片（原素材目录名「小车」）。资料中未附项目说明文档，因此团队成员、技术栈、阶段与开始日期暂缺，可在「数据修改」页补齐；下方轮播可直接播放现场演示视频。',
    owner: '—',
    team: '—',
    users: 0,
    features: 0,
    stack: [],
    images: ['/media/智能小车-现场.jpg'],
    videos: [
      '/media/智能小车-演示1.mp4',
      '/media/智能小车-演示2.mp4'
    ],
    versions: [
      { number: 'v1.0', stage: 0, days: 0, start: '—', note: '仅提交演示视频与现场照片，未提供项目说明文档与阶段信息' }
    ]
  },
  {
    name: '设施蔬菜采摘实训项目',
    intro: '项目资料为两段现场演示视频（原素材目录名「蔬菜采摘」）。资料中未附项目说明文档，因此团队成员、技术栈、阶段与开始日期暂缺，可在「数据修改」页补齐；下方轮播可直接播放现场演示视频。',
    owner: '—',
    team: '—',
    users: 0,
    features: 0,
    stack: [],
    images: [],
    videos: [
      '/media/蔬菜采摘-演示1.mp4',
      '/media/蔬菜采摘-演示2.mp4'
    ],
    versions: [
      { number: 'v1.0', stage: 0, days: 0, start: '—', note: '仅提交演示视频，未提供项目说明文档与阶段信息' }
    ]
  }
]

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
