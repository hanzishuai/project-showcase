export type ProjectKind = 'doing' | 'done'

export interface ShowcaseModule {
  name: string
  note?: string
}

export interface UsageMetric {
  label: string
  value: string
  unit: string
  note?: string
}

export interface RuntimeInfo {
  value: string
  note: string
}

export interface ShowcaseMeta {
  kind: ProjectKind
  kindLabel: string
  phase: string
  accent: string
  modulesDone: ShowcaseModule[]
  modulesDoing: ShowcaseModule[]
  modulesPlanned?: ShowcaseModule[]
  usage?: UsageMetric[]
  runtime?: RuntimeInfo
}

const DEFAULT_SHOWCASE: ShowcaseMeta = {
  kind: 'doing',
  kindLabel: '在做',
  phase: '阶段资料待补充',
  accent: '#76a9f4',
  modulesDone: [],
  modulesDoing: [{ name: '模块清单待补充', note: '文档未提供功能模块信息' }]
}

export const PROJECT_SHOWCASE: Record<string, ShowcaseMeta> = {
  'gaoxiao-dangzuzhi-guanli': {
    kind: 'doing',
    kindLabel: '在做',
    phase: '原型已实现 · 待上线',
    accent: '#76a9f4',
    modulesDone: [
      { name: '三类角色登录鉴权', note: '学生 / 支部书记 / 党委书记，JWT + 身份证登录' },
      { name: '入党四阶段工作流', note: '8 + 15 + 4 + 9 份材料，全程七次审批' },
      { name: 'PDF 材料上传与浏览', note: '上传、下载、在线预览，驳回必须填写理由' },
      { name: '党员信息批量导入导出', note: 'Excel 模板按身份证号去重更新' },
      { name: '四类党员分类管理', note: '积极分子 / 发展对象 / 预备党员 / 正式党员' },
      { name: '思想汇报与学习心得', note: '固定 12 框，连续三个月周期控制与超期提醒' },
      { name: '在线考试 420 题', note: '随机抽题、单选多选自动判分、60 分合格' },
      { name: '待办 / 公示 / 消息 / 邮件', note: '公告、铃铛通知与邮件中心' },
      { name: 'PC + 移动端适配', note: '响应式布局，前后端分离架构' }
    ],
    modulesDoing: [
      { name: '当前迭代清单待补充', note: '文档只说明基于原型实现，未列出正在开发的功能' }
    ]
  },
  'keji-chengguo-zhuanhua': {
    kind: 'doing',
    kindLabel: '在做',
    phase: '演示版运行 · 边开发边修',
    accent: '#6fc4a4',
    modulesDone: [
      { name: '科技成果发布', note: '学校教师成果上传，当前 20 条演示数据' },
      { name: '企业需求发布', note: '企业技术问题发布，当前 20 条演示需求' },
      { name: '9 个技术领域检索', note: '成果与需求按领域互相查找' },
      { name: '管理员审核与下架', note: '发布内容由管理员把关，可随时下架' },
      { name: '24 张演示图片', note: '演示版配套素材已就位' }
    ],
    modulesDoing: [
      { name: '后台常用选项自助维护', note: '技术领域等选项改为页面内可维护' },
      { name: '管理员 / 用户权限细化', note: '角色权限继续细分' },
      { name: '交互缺陷修复', note: '角色页刷新、身份显示、我的发布跳转' }
    ],
    modulesPlanned: [
      { name: '企业主体落地', note: '已与科研处沟通，材料准备中' },
      { name: '备案域名', note: '企业资质与域名条件' },
      { name: '真实数据替换', note: '替换当前演示数据' },
      { name: '企业微信登录', note: '按学校意见改造登录方式' }
    ]
  },
  'keyan-xiangmu-shenbao': {
    kind: 'done',
    kindLabel: '已做',
    phase: '业务运行中 · 线下评审阶段',
    accent: '#ad9be6',
    modulesDone: [
      { name: '课题发布', note: '科技局统一发布申报课题' },
      { name: '线上填报', note: '项目负责人在线填写申报书' },
      { name: '材料上传', note: '申报材料随申报书提交' },
      { name: '单位筛选', note: '申报单位范围内筛选' },
      { name: '归口分发', note: '按归口处室分发申报件' },
      { name: '处室审核', note: '处室审核与二次确认' },
      { name: '线下评审', note: '当前业务整体处于该环节' },
      { name: '合同签订', note: '评审通过后进入合同流程' },
      { name: '申报书 PDF 生成导出', note: '申报与审核过程全程留痕' }
    ],
    modulesDoing: [],
    usage: [
      { label: '申报个人', value: '379', unit: '人', note: '系统现有' },
      { label: '申报单位', value: '48', unit: '家', note: '覆盖全市科研单位' },
      { label: '申报书', value: '378', unit: '条', note: '已提交入库' },
      { label: '待线下评审', value: '348', unit: '条', note: '当前业务阶段' }
    ],
    runtime: { value: '—', note: '文档未提供上线日期与连续运行时长' }
  }
}

export function getShowcase(projectId: string): ShowcaseMeta {
  return PROJECT_SHOWCASE[projectId] ?? DEFAULT_SHOWCASE
}

export function projectKind(projectId: string): ProjectKind {
  return getShowcase(projectId).kind
}
