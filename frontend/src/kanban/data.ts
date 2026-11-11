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
  owner: string
  team: string
  users: number
  features: number
  stack: string[]
  images: string[]
  versions: KanbanVersion[]
}

export interface KanbanData {
  stages: KanbanStage[]
  projects: KanbanProject[]
}

export const KANBAN_DATA_KEY = 'kanban-board-data-v1'

export const KANBAN_DEFAULT_STAGES: KanbanStage[] = [
  { name: '需求对接', color: '#64748B' },
  { name: '数据库设计', color: '#22D3EE' },
  { name: '开发', color: '#3B82F6' },
  { name: '测试', color: '#A78BFA' },
  { name: '上线', color: '#34D399' }
]

export const KANBAN_DEFAULT_PROJECTS: KanbanProject[] = [
  {
    name: '实验室预约系统',
    owner: '张三',
    team: '张三、李宁、王琳',
    users: 1286,
    features: 22,
    stack: ['Vue 3', 'Spring Boot', 'MySQL'],
    images: [
      '/media/微信图片_20261109162755_36_102.jpg',
      '/media/微信图片_20261109162756_38_102.png',
      '/media/微信图片_20261109162757_39_102.png',
      '/media/截图-管理后台统计.png'
    ],
    versions: [
      { number: 'v1.0', stage: 4, days: 3, start: '2026-04-02', note: '基础预约能力上线' },
      { number: 'v1.1', stage: 3, days: 8, start: '2026-07-12', note: '开放审批流配置' },
      { number: 'v1.2', stage: 2, days: 19, start: '2026-10-06', note: '支持跨实验室资源调度' }
    ]
  },
  {
    name: '科研成果管理平台',
    owner: '李四',
    team: '李四、孙瑶、陈泽',
    users: 964,
    features: 31,
    stack: ['React', 'Node.js', 'PostgreSQL'],
    images: [
      '/media/截图-科技成果列表.png',
      '/media/截图-管理后台统计.png',
      '/media/截图-操作日志.png',
      '/media/微信图片_20261109162755_36_102.jpg'
    ],
    versions: [
      { number: 'v1.0', stage: 4, days: 2, start: '2026-05-08', note: '成果归档功能上线' },
      { number: 'v2.0', stage: 3, days: 7, start: '2026-09-25', note: '成果统计模块联调' }
    ]
  },
  {
    name: '课程实践评价系统',
    owner: '王五',
    team: '王五、周可、赵敏',
    users: 742,
    features: 18,
    stack: ['Vue 3', 'Spring Boot', 'Redis'],
    images: [
      '/media/微信图片_20261109162756_38_102.png',
      '/media/截图-操作日志.png',
      '/media/截图-管理后台统计.png',
      '/media/截图-科技成果列表.png'
    ],
    versions: [
      { number: 'v1.0', stage: 4, days: 1, start: '2026-03-16', note: '课程评价正式启用' },
      { number: 'v1.1', stage: 2, days: 11, start: '2026-10-10', note: '过程性评价能力扩展' }
    ]
  },
  {
    name: '校园活动服务中心',
    owner: '赵六',
    team: '赵六、唐洁、刘远',
    users: 1582,
    features: 26,
    stack: ['React', 'Node.js', 'MySQL'],
    images: [
      '/media/微信图片_20261109162757_39_102.png',
      '/media/截图-企业需求列表.png',
      '/media/微信图片_20261109162755_36_102.jpg',
      '/media/截图-管理后台统计.png'
    ],
    versions: [
      { number: 'v1.0', stage: 4, days: 4, start: '2026-02-18', note: '活动报名投入使用' },
      { number: 'v1.1', stage: 3, days: 18, start: '2026-09-09', note: '活动核销发布准备' }
    ]
  },
  {
    name: '实习岗位匹配平台',
    owner: '陈晨',
    team: '陈晨、吴航、郑莹',
    users: 0,
    features: 0,
    stack: ['Vue 3', 'Spring Boot', 'MySQL'],
    images: [
      '/media/截图-企业需求列表.png',
      '/media/微信图片_20261109162755_36_102.jpg',
      '/media/微信图片_20261109162756_38_102.png',
      '/media/截图-科技成果列表.png'
    ],
    versions: [
      { number: 'v1.0', stage: 1, days: 6, start: '2026-10-23', note: '岗位数据模型设计' },
      { number: 'v1.1', stage: 0, days: 5, start: '2026-11-05', note: '匹配规则需求梳理' }
    ]
  },
  {
    name: '毕业设计协作平台',
    owner: '刘洋',
    team: '刘洋、许宁、宋明',
    users: 1124,
    features: 24,
    stack: ['React', 'Node.js', 'PostgreSQL'],
    images: [
      '/media/截图-管理后台统计.png',
      '/media/微信图片_20261109162755_36_102.jpg',
      '/media/微信图片_20261109162757_39_102.png',
      '/media/截图-企业需求列表.png'
    ],
    versions: [
      { number: 'v1.0', stage: 4, days: 2, start: '2026-01-12', note: '选题与过程管理上线' },
      { number: 'v2.0', stage: 3, days: 16, start: '2026-08-26', note: '答辩材料审核改造' }
    ]
  },
  {
    name: '教学资源共享库',
    owner: '孙悦',
    team: '孙悦、胡嘉、陆涛',
    users: 648,
    features: 14,
    stack: ['Vue 3', 'Spring Boot', 'Redis'],
    images: [
      '/media/截图-操作日志.png',
      '/media/截图-科技成果列表.png',
      '/media/微信图片_20261109162756_38_102.png',
      '/media/截图-企业需求列表.png'
    ],
    versions: [
      { number: 'v1.0', stage: 4, days: 1, start: '2026-06-08', note: '资源检索上线' },
      { number: 'v1.2', stage: 2, days: 9, start: '2026-10-15', note: '权限分级与审计' }
    ]
  },
  {
    name: '竞赛项目孵化平台',
    owner: '周航',
    team: '周航、何青、杨帆',
    users: 0,
    features: 0,
    stack: ['React', 'Node.js', 'MySQL'],
    images: [
      '/media/截图-科技成果列表.png',
      '/media/截图-管理后台统计.png',
      '/media/微信图片_20261109162757_39_102.png',
      '/media/微信图片_20261109162755_36_102.jpg'
    ],
    versions: [
      { number: 'v1.0', stage: 0, days: 4, start: '2026-11-01', note: '竞赛需求对接' },
      { number: 'v1.1', stage: 1, days: 3, start: '2026-11-04', note: '项目库结构设计' }
    ]
  },
  {
    name: '学术讲座预约平台',
    owner: '吴迪',
    team: '吴迪、贺云、何琳',
    users: 1260,
    features: 24,
    stack: ['Vue 3', 'Spring Boot', 'PostgreSQL'],
    images: [
      '/media/微信图片_20261109162755_36_102.jpg',
      '/media/微信图片_20261109162756_38_102.png',
      '/media/微信图片_20261109162757_39_102.png',
      '/media/截图-企业需求列表.png'
    ],
    versions: [
      { number: 'v1.0', stage: 3, days: 7, start: '2026-08-12', note: '灰度发布与验收' },
      { number: 'v1.1', stage: 4, days: 1, start: '2026-09-29', note: '预约通知优化上线' }
    ]
  }
]

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function defaultKanbanData(): KanbanData {
  return {
    stages: clone(KANBAN_DEFAULT_STAGES),
    projects: clone(KANBAN_DEFAULT_PROJECTS)
  }
}

export function loadKanbanData(): KanbanData {
  try {
    const raw = localStorage.getItem(KANBAN_DATA_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as KanbanData
      if (Array.isArray(parsed.stages) && parsed.stages.length > 0 && Array.isArray(parsed.projects)) {
        return parsed
      }
    }
  } catch {
    // 浏览器禁用本地存储或数据损坏时回退到默认数据
  }
  return defaultKanbanData()
}

export function saveKanbanData(data: KanbanData): void {
  localStorage.setItem(KANBAN_DATA_KEY, JSON.stringify(data))
}

export function resetKanbanData(): void {
  localStorage.removeItem(KANBAN_DATA_KEY)
}

// 兼容旧引用：看板运行时以 loadKanbanData() 为准
export const KANBAN_STAGES = KANBAN_DEFAULT_STAGES
export const KANBAN_PROJECTS = KANBAN_DEFAULT_PROJECTS

export const KANBAN_WEEKS = ['09/21', '09/28', '10/05', '10/12', '10/19', '10/26', '11/02', '11/09']

export const KANBAN_TREND: Record<string, number[]> = {
  开发: [3, 4, 3, 5, 4, 5, 4, 4],
  测试: [1, 2, 3, 2, 3, 2, 3, 2],
  已上线: [4, 5, 6, 6, 7, 7, 8, 8]
}
