# 项目进程看板参考地址与展示建议

日期：2026-11-10
目标：对外展示项目数量、项目名称、开发成员、指导教师、开发进度，形态接近「项目进程看板」。

## 一、最值得看的参考

| 参考 | 地址 | 可借鉴什么 |
|---|---|---|
| Asana Portfolios | https://asana.com/features/goals-reporting/portfolios | 组合视图顶部先看整体健康度；每个项目显示负责人、状态、进度；适合「项目总数 + 项目列表」层 |
| Linear Projects | https://linear.app/docs/projects | 每个项目有项目负责人、状态、进度图、里程碑；适合做单个项目的详情抽屉/详情页 |
| ProjectManager Dashboards | https://www.projectmanager.com/software/dashboard | 项目仪表盘 + workload 视图，能看到每个成员当前工作量；适合「哪几个人在做什么」 |
| Smartsheet Project Portfolio Dashboards | https://www.smartsheet.com/content/project-portfolio-dashboards | 组合看板的常见类型：健康度、优先级、预算、状态、进度；适合确定顶部指标 |
| Smartsheet 模板下载 | https://www.smartsheet.com/content/project-portfolio-dashboard-templates | 可直接下载 Excel / PowerPoint / Google Sheets 模板，适合快速对照字段和版式 |
| Wrike Project Portfolio Dashboard | https://www.wrike.com/blog/project-portfolio-dashboard/ | 组合仪表盘的组成与示例，适合看「项目数量、状态、负责人、进度」如何排布 |
| Teamhood Project Portfolio Dashboard | https://teamhood.com/project-management/project-portfolio-dashboard/ | 真实组合看板案例，包含预算、时间线、资源分配等维度；适合做管理视角 |

## 二、中文项目/任务看板参考

| 参考 | 地址 | 可借鉴什么 |
|---|---|---|
| 禅道：看板功能介绍 | https://www.zentao.net/blog/introduction-zentao-kanban-board-functions-83741.html | 未开始 / 进行中 / 已完成 / 已关闭状态列；卡片可显示负责人；适合做「进程看板」主体 |
| Worktile：工作任务进度看板怎么搭建 | https://worktile.com/insights/qyloa34nfp293xx7lcgdz38l | 状态列 + 责任人机制，避免看板变成电子白板；适合确定每张卡的必填字段 |
| 阿里云：如何设计项目进度看板 | https://developer.aliyun.com/article/1743072 | 让项目进展、风险和负责人一目了然；适合写看板标题区和汇总区 |
| boardmix：项目看板怎么做 | https://boardmix.cn/article/project-board/ | 任务卡、状态规则与团队使用方法；适合看卡片信息层级 |
| ONES：项目进度看板图怎么制作 | https://ones.cn/blog/articles/project-progress-bulletin-board | 项目进度看板包含哪些内容；适合做字段清单 |

## 三、适合本项目的版式

推荐主视图：**项目台账 + 阶段泳道** 两层结构。

1. 顶部指标条（4 个）：
   - 项目总数：3
   - 在研项目：3
   - 已维护环节：0 / 18（来自现有阶段数据）
   - 指导教师：3 位（数据补齐后显示）

2. 项目台账（默认视图，适合给别人快速扫读）：
   列：项目名称 / 当前阶段 / 开发成员 / 指导教师 / 进度 / 最近更新。
   每行用一个状态色点 + 项目名，成员用头像首字 chips，指导教师用文字，进度用「已完成阶段数 / 6」或阶段进度条。

3. 阶段泳道（切到「看板」视图）：
   六列：需求分析 / 方案设计 / 开发实现 / 测试验证 / 部署上线 / 运维迭代。
   每张项目卡：项目名、成员、指导教师、当前阶段、阶段小圆点。
   当前 3 个项目都还没有结构化阶段，卡片可以落在「需求分析」列并显示「阶段待维护」，不要伪造完成度。

4. 详情抽屉：点项目卡或台账行打开，显示项目简介、成员、指导教师、六段阶段、资料清单、截图。

## 四、数据缺口（必须先补）

当前 `data/projects.json` 只有项目名、摘要、文档、阶段状态，没有开发成员和指导教师字段。建议新增：

```json
{
  "developers": [
    { "name": "成员姓名", "role": "前端/后端/测试" }
  ],
  "advisor": "指导教师姓名"
}
```

正式展示前请把演示占位替换为真实姓名；在没有数据时显示「待补充」，不要写假名字或假百分比。

## 五、当前项目已有的调研记录

`data/projects.json` 的 `meta.researchLinks` 已保存过 Smartsheet、Tempo、Portfolio Hub、ONES、Microsoft SDLC、Wikipedia 等参考链接，可直接复用；本文件补充了更适合「项目进程看板 + 成员 + 指导教师」的地址。
