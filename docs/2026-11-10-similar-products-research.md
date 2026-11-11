---
created: 2026-11-10T14:18
updated: 2026-11-10T14:24
---

# 1 相似产品调研：项目实践聚合平台

- 日期：2026-11-10
- 调研人：similar-products-20261110（子代理）
- 对象：Vue 3 + FastAPI + SQLite 的 1920×1080 深色「项目实践聚合」大屏
- 范围：项目管理 / 项目组合看板、科研项目管理系统、高校科研成果展示平台、产品 portfolio dashboard、项目台账 / 全生命周期管理系统、数据可视化大屏；中英文共 15 个样本
- 交付边界：只新增本报告与 previews/research-2026-11-10/ 截图；项目代码、data、README 保持原样
- 证据标记：【实证】= 实际打开页面或截图所见；【推断】= 从页面结构、文案合理推断；【未验证】= 因登录、超时、弹窗等未能确认

## 1.1 结论先行：最值得借鉴的 5 个做法

### 1.1.1 1）项目清单从「只有卡片流」升级为「卡片 + 表格」双视图（P0）

- 来源产品：Asana Portfolios
- URL：https://asana.com/product/portfolios
- 证据：【实证】产品截图（[asana-portfolios-product-2026-11-10.png](../previews/research-2026-11-10/asana-portfolios-product-2026-11-10.png)）顶部有 List / Timeline / Progress / Workload 四个视图 tab，表格列为 Name / Status / Milestones / Owner；同一页有 Share / Customize，说明列表本身就是工作台，不是展示墙。
- 对当前：DashboardView.vue 第 53–59 行只有 section.cards-wrap；可在第 54 行 sec-head 右侧加「卡片 / 表格」切换，表格只复用现有 ProjectSummary 字段，不新增后端接口。
- 代价/怎么验：前端 1 个视图状态 + 1 个表格组件；先做只读。验收时用现有 3 个项目 + 1 个占位：卡片视图 4 个 .card，表格视图 3 行 + 1 行「资料待上传」；刷新默认回卡片视图。

### 1.1.2 2）卡片固定「状态 / 阶段 / 更新时间」三要素，且不把缺失值写成「已提交」

- 来源产品：ClickUp Portfolios、Asana Portfolios
- URL：https://clickup.com/features/portfolios ；https://asana.com/product/portfolios
- 证据：【实证】ClickUp 首屏 Team objectives 表格只有 Title / Status / Progress / Dates 四列，状态用 At Risk 橙、Done 绿、Pending 蓝；Asana 表格只有 Name / Status / Milestones / Owner 四列。两者都用极简列表达「是什么、到哪了、谁负责」。
- 对当前：ProjectCard.vue 第 25 行 status ?? '已提交' 把空状态伪装成「已提交」；第 28–29 行「文档原话 + DOCX 文件名」占两行；第 34–35 行六段条没有计数。建议卡片头行固定：真实 status（空则「—」）+「阶段 N/6」+「更新 YYYY-MM-DD」（空则「—」）；卡片摘要最多 2 行；文档原话降到详情页。
- 代价/怎么验：只改卡片模板与样式，不动数据。现有数据里 3 个项目的 status/updated_at 均为 null，验收应看到「—」而不是「已提交」；阶段 N 用 stage_done 计算；把窗口缩到 1366×768 时卡片高度不跳、不横向溢出。

### 1.1.3 3）详情页采用「属性栏 + 内容栏 + 证据栏」三栏，项目档案不要埋在右栏第二个 panel

- 来源产品：Linear Projects Docs
- URL：https://linear.app/docs/projects
- 证据：【实证】Linear 文档里的项目详情产品截图：左栏 Properties（Status / Lead / Members / Teams / Target date / Health / Priority / Labels），中间概览与正文，右栏 Milestones / Resources / Customers / Latest update；页面底色 #08090a、文字 #f7f8f8、Inter 字体，层次靠细灰分隔线和大标题。
- 对当前：ProjectDetailView.vue 第 166 行 info-grid 目前是右栏第二个 panel；建议把它提为右侧 sticky 属性栏（至少 6 个字段：文档阶段 / 更新时间 / 源文件 / 截图数量 / 阶段完成 / 资料说明），中间放六段记录、阶段维护、文档原话、内容摘要，截图证据独立成栏。
- 代价/怎么验：纯布局改动，不动 API；1920×1080 和 1366×768 下 document.scrollWidth 均不超过 innerWidth；6 个字段值与 /api/projects/{id} 返回值逐项比对；null 显示 —。

### 1.1.4 4）阶段用「节点流 / 阶段计数」，不要用六段等宽条冒充百分比

- 来源产品：飞书项目、Jira Roadmaps
- URL：https://project.feishu.cn/home/product ；https://www.atlassian.com/software/jira/features/roadmaps
- 证据：【实证】飞书项目产品页首屏是节点流：产品设计→产品评审→埋点设计→详细评审→技术调研，节点有状态点和「进行中」标签，上方角色标签、分支前端估分/后端估分/QA 安全检查；正文明确五种视图（列表/看板/甘特/树形/全景）和「延期醒目标识」。【实证】Jira 路线图用 Now / Next / Later / Won't 四列，卡片只放 Impact / Goal / Delivery progress，显式保留「不做」列。
- 对当前：ProjectCard.vue 第 34–35 行的 6 个等宽 seg 只有 done/未 done 两态，没有「3/6」文字；详情页 d-steps（第 115 行）也只是纵向列表。建议卡片改成「阶段 3/6」+ 6 个状态点；详情页把 d-steps 做成带连接线的节点流，每个节点显示状态 + 备注；P2 再做「阶段矩阵」总览。
- 代价/怎么验：卡片与详情模板 + CSS；阶段矩阵需要修改后端接口返回每项目 stages（P2，先不做）。验收用 stage_done=0/3/6 三个状态：0 显示「0/6」且无实心点，3 显示「3/6」前三实心，6 显示「6/6」全实心；页面任何位置不出现「阶段 50%」这类百分比。

### 1.1.5 5）深色大屏只保留一个主视觉焦点，颜色语义化，KPI 只给「值 + 单位（+ 变化）」

- 来源产品：数字冰雹 孪易 IOC、图观大屏、FineBI
- URL：https://www.digihail.com/pages/twin-easy-ioc.html ；https://www.tuguan.net/industry/large-screen-visualization/large-screen-visualization.html ；https://www.finebi.com/
- 证据：【实证】数字冰雹 IOC 大屏：深蓝底 + 半透明面板 + 青蓝描边 + 橙黄预警，左侧 KPI 卡（园区总栋数 23009、园区车辆 12234、园区车位 66/12800、综合能耗 60%），中间 3D 园区，右侧图表；图观页同样以深蓝 hero + 多块大屏拼贴展示，屏内 KPI 23327/1233/728。FineBI 首屏 KPI 卡只放值 + 单位 + 环比/同比（销售额 1899万、退款金额 265万，环比 -8.52%、同比 -12.31%）。
- 对当前：ProjectCard.vue 第 6–7 行 accents 按 index 轮播四色，颜色不表达状态；TopBar.vue 第 19–34 行四个指标各配一种色；DashboardView 两个图表与卡片区权重接近，没有唯一焦点。建议颜色语义化：齐全/正常=青蓝，缺失/待补充=琥珀，占位=灰；页面只让项目清单做最亮层级，图表区降低发光；数字用等宽字体，单位降一号。
- 代价/怎么验：主要改 styles.css 与卡片 class；验收看「同一状态始终同色、不同状态不同色」，再截 1920×1080 对比图；DOM 中不再出现 accent 随 index 改变（检查第 3、4 张卡主色不因顺序变化）。

## 1.2 调研方法与证据分级

- 实际打开并截图 15 个样本官网；previews/research-2026-11-10/ 共 18 张样本截图；当前应用对照图在 previews/ 根目录，不计入样本数。
- 每个结论至少附一个 URL 或本地截图；没有把搜索结果摘要当结论。
- 证据三态：【实证】看页面或截图；【推断】结构/文案合理推导；【未验证】登录、超时、弹窗导致没确认。
- 样本是目的性抽样，不是市场全量：优先覆盖「项目组合、科研项目、成果展示、数据大屏」四类，不用来推算市场份额。
- 搜索通道受限：内置 web_search 返回 "DeepSeek returned no web_search_tool_result blocks"；magpie SearXNG 返回 "found nothing"；DuckDuckGo 抓取失败。最终改用官网直取 + 本机 Chrome/puppeteer 打开 + Bing/360 结果交叉找官网，详细失败项见第 6 节。

## 1.3 样本表（15 个真实产品 / 网站）

| # | 名称 | URL | 类型 | 页面结构（首屏） | 视觉配色 | 关键交互 | 可借鉴点 | 证据 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Asana Portfolios | https://asana.com/product/portfolios | 项目组合看板（SaaS） | 顶部导航；面包屑 Features > Goals and reporting > Portfolios；H1 + 一行说明；嵌入产品截图：Portfolio 标题、四个视图 tab、表格四列 | 奶油白底 + 黑字、黑色胶囊 CTA；产品内浅绿大面板 + 白色表格 | 视图 tab；Share；Customize；行内状态徽章 + 里程碑菱形 | 列表/时间线/进度/工作量四视图；表格只留四列 | [产品截图](../previews/research-2026-11-10/asana-portfolios-product-2026-11-10.png) | 实证 |
| 2 | ClickUp Portfolios | https://clickup.com/features/portfolios | 项目组合看板（SaaS） | 左标题 + 右产品表格；H2 依次讲目标、追踪、创建 portfolio、优先级、共享 | 白底黑字、Plus Jakarta Sans；产品 UI 蓝/绿/橙状态色 | 表格 Title / Status / Progress / Dates；状态徽章；行首色条只做行标识 | 卡片/行只放三要素；状态色只表达状态 | [首屏](../previews/research-2026-11-10/clickup-portfolios-2026-11-10.png) | 实证 |
| 3 | Linear Projects | https://linear.app/docs/projects | 项目详情文档（SaaS） | 左侧 Docs 导航；正文 H1 Projects + Overview / Create / Delete / View / Add issues / Project documents；右侧页内目录 | 深色 #08090a、文字 #f7f8f8、Inter；细灰分隔线、大标题 | 产品截图三栏：左 Properties、中概览、右 Milestones/Resources/Customers/Latest update | 深色克制的层次；详情页左属性 + 中内容 + 右里程碑 | [文档页](../previews/research-2026-11-10/linear-projects-2026-11-10.png) | 实证 |
| 4 | Jira Roadmaps | https://www.atlassian.com/software/jira/features/roadmaps | 路线图 / 项目组合（SaaS） | H1 + 三段价值说明 + 产品截图；H2 Get everyone on same page / Plan your work / FAQ | 白底、黑字、Atlassian 蓝链接 | 路线图四列 Now / Next / Later / Won't；卡片 Impact / Goal / Delivery progress | 时间桶分列；显式保留「不做」；卡片只放影响、目标、交付进度 | [首屏](../previews/research-2026-11-10/jira-roadmaps-2026-11-10.png) | 实证 |
| 5 | Microsoft Project | https://www.microsoft.com/en-us/microsoft-365/project/project-management-software | 传统项目管理软件 | 价格比较页：H1 + Project Professional / Standard / Server 三张计划卡；Compare plans / FAQ | 米白 #fffdfb、深蓝灰 #17253d、Segoe UI | 计划卡对比、价格 CTA | 只作为「计划/资源/甘特」类型样本；不适合作为卡片流设计参考 | [价格页](../previews/research-2026-11-10/microsoft-project-pricing-2026-11-10.png) | 实证（非产品 UI） |
| 6 | monday.com PMO | https://monday.com/departments/pmo | 项目管理 / PMO（SaaS） | H1 + 副标 + 右侧人像卡；下接 AI agents 列表（intake / planner / nudger / monitor / portfolio health / report builder） | 白底黑字、紫色强调、Poppins | agent 卡片逐条列动作；Get Started / Contact sales | 把 portfolio 健康度拆成角色化 agent 动作；单一紫色强调 | [首屏](../previews/research-2026-11-10/monday-pmo-2026-11-10.png) | 实证（营销页） |
| 7 | 飞书项目 | https://project.feishu.cn/home/product | 项目协同 / 工作流（SaaS） | 白底产品页：H1 项目管理，从未如此简单；H2 可视化工作流引擎 / 数据驱动决策 / 自动化 / 计划管理 / 评审 / 轻应用；节点流截图 | 白底、黑字、紫色 CTA | 节点流（产品设计→评审→埋点→详细评审→技术调研）；角色标签、分支、进行中状态；五种视图 | 节点流 + 阶段状态 + 多视图；延期醒目标识 | [产品页](../previews/research-2026-11-10/feishu-project-product-2026-11-10.png) | 实证 |
| 8 | Teambition | https://www.teambition.com/ | 通用项目协作（钉钉） | 白底导航；H1 + 产品价值三段；模板中心 / 多视图 / 任务分配 / 统计分析；行业方案 | 白底、蓝紫渐变 CTA | 模板中心；多视图；钉钉群聊/文档/审批集成 | 模板中心 + 多视图；通用协作型，不是展示型大屏 | [首屏（有弹窗）](../previews/research-2026-11-10/teambition-home-2026-11-10.png) | 实证（弹窗遮挡） |
| 9 | 禅道 | https://www.zentao.net/ | 开源项目管理 / 研发管理 | 白导航 + 蓝色 hero；右侧产品地图（项目集/产品/项目/执行/测试/DevOps/AI/BI/看板）；版本卡与数据 | 白底 + 高饱和蓝 hero | 产品地图纵向菜单；版本对比；功能模块分组 | 项目集→产品→项目→执行层级；大屏作为 BI 出口 | [首屏](../previews/research-2026-11-10/zentao-home-2026-11-10.png) | 实证 |
| 10 | 数字冰雹 / 图观 | https://www.digihail.com/pages/twin-easy-ioc.html ；https://www.tuguan.net/industry/large-screen-visualization/large-screen-visualization.html | 数据大屏 / 数字孪生 | 白导航 + 深色大屏实拍；屏内左 KPI 卡、中 3D 园区、右图表；图观页为深蓝 hero + 大屏拼贴 | 深蓝底、半透明面板、青蓝描边、橙黄预警；大数字小单位 | 大屏实拍展示；KPI 卡；3D 场景；多屏拼贴 | 深色大屏层次与语义色；单一主视觉焦点 | [IOC 大屏](../previews/research-2026-11-10/digihail-ioc-2026-11-10.png) [图观](../previews/research-2026-11-10/tuguan-dashboard-2026-11-10.png) | 实证 |
| 11 | 科易网 | https://www.1633.com/ | 技术转移 / 科技成果转化平台 | 白导航 + 深蓝 hero；左侧 5 张竖向服务卡；服务对象 tabs（科技管理部门/产业管理部门/高校院所/科技企业）；数智工具分组 | 蓝主色 + 橙色 CTA；深蓝 hero | 服务对象 tabs；工具分组入口 | 用「服务对象 tabs + 工具分组」组织大量入口；但本质是营销获客页 | [首屏](../previews/research-2026-11-10/keyi-1633-2026-11-10.png) | 实证（营销页） |
| 12 | 科研之友 | https://www.scholarmate.com/ | 科研社交 / 成果推广 | 白/浅蓝渐变；H1 欢迎加入专业化知识共创社区；搜索框 + 热门检索；导航 科研成果/科研人员/科研机构/科研动态；AI 工具卡 | 白/浅蓝、老式蓝色标题栏（列表页） | 搜索；A-Z 字母索引；三栏成果标题列表 | 成果库可用 A-Z 索引 + 热门检索；视觉陈旧，不照搬 | [成果列表](../previews/research-2026-11-10/scholarmate-results-2026-11-10.png) | 实证 |
| 13 | 国家科技成果转化项目库 | https://www.nstad.cn/ | 政府成果库 | 顶部 Logo + 登录/帮助/注册；导航 首页/成果导航/成果统计/政策法规/工作动态；搜索 + 高级检索；四类用户说明；成果导航(34585) | 政府蓝白、红色 banner、技术领域图片入口 | 分面筛选（成果来源 4 类 + 省市 34 + 时间）；结果计数 34481；结果行只有成果名称；详情公开只给摘要，更多字段需登录 | 角色分级披露；分面筛选 + 计数；极简结果行 | [导航页](../previews/research-2026-11-10/nstad-navigation-2026-11-10.png) [详情](../previews/research-2026-11-10/nstad-detail-2026-11-10.png) | 实证（详情需登录更多字段） |
| 14 | FineBI | https://www.finebi.com/ | 商业智能 / 指标平台 | 浅蓝白渐变；H1 FineBI商业智能7.5；右侧产品看板截图（指标血缘/指标树/KPI 卡） | 浅蓝白、黑色大标题、蓝色渐变 CTA | KPI 值 + 单位 + 环比/同比；指标树下钻；指标血缘 | KPI 只给值/单位/变化；无数据不显示百分比 | [首屏](../previews/research-2026-11-10/finebi-home-2026-11-10.png) | 实证（营销页） |
| 15 | 阿里云 DataV | https://www.aliyun.com/product/bigdata/datav | 数据可视化大屏 | 白底、阿里云蓝导航；H1 DataV数据可视化；三条产品线 DataV-Board / Note / Atlas；产品优势与套餐卡 | 白底、蓝色导航、橙色 CTA 与橙色下划线标题 | 产品线 tab；套餐购买；低代码/蓝图/演播厅卖点 | 组件数量与模板是卖点；「一句话生成大屏」可作 P2 探索，不建议当前改低代码平台 | [首屏](../previews/research-2026-11-10/aliyun-datav-2026-11-10.png) | 实证（营销页） |

## 1.4 横向规律：15 个样本反复出现的 6 条

1. **指标区只放 3–5 个，值 + 单位 + 口径，不堆图表。** FineBI 的 KPI 卡只给销售额 1899万、退款金额 265万与环比/同比；ClickUp 的 portfolio 表格只给 Status / Progress / Dates；Asana 只给 Status / Milestones / Owner。当前 TopBar 4 个指标数量合适，但第 4 个在 0/18 时显示「—」、副标题写死「三份文档均未提供」，是「指标区承载了状态说明」的错位。来源：https://www.finebi.com/ 、https://clickup.com/features/portfolios 、https://asana.com/product/portfolios
2. **主视图通常是表格 / 时间线 / 看板，不是两块并排图表。** Asana 四个视图 tab、ClickUp 表格、Jira 四列路线图，都是把「项目集合」当主角；图表只做辅助。当前 DashboardView 的两个图表与 4 列卡片几乎等权，3 个项目时图表像占位。来源：https://asana.com/product/portfolios 、https://www.atlassian.com/software/jira/features/roadmaps
3. **卡片/表格行只承载 3–4 个扫描要素，长文本和证据放详情。** ClickUp 行只有 Title / Status / Progress / Dates；Asana 行只有 Name / Status / Milestones / Owner。当前 ProjectCard 同时放封面、状态、摘要、文档原话、DOCX 文件名、六段条、docx/截图数，信息密度明显偏高。来源：https://clickup.com/features/portfolios 、https://asana.com/product/portfolios
4. **详情页普遍是「属性栏 + 内容栏 + 证据/里程碑栏」三栏。** Linear 是最清晰的样本：左 Properties、中概览、右 Milestones / Resources / Customers / Latest update。当前详情页是左 4 panel + 右 2 panel 的两栏，项目档案 info-grid 埋在右栏第二个 panel，属性不 sticky。来源：https://linear.app/docs/projects
5. **阶段/状态用节点、时间桶或状态词，不用连续百分比。** 飞书项目用节点流和「进行中」标签；Jira 用 Now / Next / Later / Won't 时间桶；Asana 用 Complete / At risk / On hold / No status 状态词。当前六段条没有「N/6」文字，容易被误读为百分比；status 空值又被写成「已提交」。来源：https://project.feishu.cn/home/product 、https://www.atlassian.com/software/jira/features/roadmaps
6. **深色大屏靠「一个主视觉焦点 + 语义色 + 大数字小单位」成立。** 数字冰雹 IOC：3D 园区是唯一焦点，KPI 和图表退到两侧；图观用深蓝 hero 包住大屏拼贴；FineBI 用浅色系做 KPI 卡，说明深色与浅色是两套语言，不宜混用。当前深色 tokens 方向对，但 accents 按 index 轮播四色，颜色不表达状态，所有面板发光强度接近。来源：https://www.digihail.com/pages/twin-easy-ioc.html 、https://www.tuguan.net/industry/large-screen-visualization/large-screen-visualization.html 、https://www.finebi.com/

## 1.5 与当前页面对照

### 1.5.1 当前实现快照（代码定位）

| 区域 | 当前实现 | 代码证据 |
|---|---|---|
| 顶部指标 | 4 个 metric：项目总数 / 已提交文档 / 界面截图 / 结构化阶段；第 4 个在 stage_done 为 0 时显示「—」；副标题固定「三份文档均未提供」 | [TopBar.vue:35-37](../frontend/src/components/TopBar.vue#L35-L37) |
| 图表 | 左「各项目资料构成」横向条形（docx + 截图）；右「截图分布」环形图 + 图例；两者并排等宽 | [DashboardView.vue:37](../frontend/src/views/DashboardView.vue#L37)、[DashboardView.vue:44](../frontend/src/views/DashboardView.vue#L44)、[DonutPanel.vue:17](../frontend/src/components/DonutPanel.vue#L17) |
| 项目清单 | 固定 4 列卡片；每卡封面、状态、摘要、文档原话、DOCX 名、六段条、docx/截图数；不足 4 个补占位卡；无视图切换 | [DashboardView.vue:53-59](../frontend/src/views/DashboardView.vue#L53-L59)、[ProjectCard.vue:6-7](../frontend/src/components/ProjectCard.vue#L6-L7)、[ProjectCard.vue:25](../frontend/src/components/ProjectCard.vue#L25)、[ProjectCard.vue:28-35](../frontend/src/components/ProjectCard.vue#L28-L35)、[styles.css:164](../frontend/src/styles.css#L164) |
| 卡片→详情 | 整卡 RouterLink，路由 name: project，参数 id | [ProjectCard.vue:11-16](../frontend/src/components/ProjectCard.vue#L11-L16) |
| 详情 | 左 4 panel：六段阶段记录 / 阶段维护 / 文档原话 / 内容摘要；右 2 panel：项目档案 info-grid / 界面截图；截图为单张 lightbox | [ProjectDetailView.vue:115](../frontend/src/views/ProjectDetailView.vue#L115)、[ProjectDetailView.vue:126](../frontend/src/views/ProjectDetailView.vue#L126)、[ProjectDetailView.vue:166](../frontend/src/views/ProjectDetailView.vue#L166)、[ProjectDetailView.vue:207-217](../frontend/src/views/ProjectDetailView.vue#L207-L217) |
| 数据诚实 | 规范要求 status / progress / updatedAt 初始为 null，缺失显示 —，真实 0 与 null 严格区分；但卡片 status 回落成「已提交」，Donut 0 仍显示 0% | [api.ts](../frontend/src/api.ts) 的 ProjectSummary / ProjectDetail 类型；[ProjectCard.vue:25](../frontend/src/components/ProjectCard.vue#L25)；[DonutPanel.vue:65](../frontend/src/components/DonutPanel.vue#L65) |
| 视觉 | 深色 tokens：--line rgba(80,140,230,.22)、--txt #dbe7fb、--txt-dim #8098b8、--cyan #2ad6ff、--blue #4c8dff、--amber #2be6a8、--orange #ff9f45；面板/卡片渐变；4 色 accents 按 index 轮播 | [styles.css:5-14](../frontend/src/styles.css#L5-L14)、[ProjectCard.vue:6-7](../frontend/src/components/ProjectCard.vue#L6-L7) |

### 1.5.2 相同点、差距、判断

| 维度 | 相同点 | 差距 | 判断 |
|---|---|---|---|
| 顶部指标 | 都用 3–4 个指标做首屏摘要；都用大数字 + 小标签 | 当前第 4 指标 0 时显示「—」，副标题固定「三份文档均未提供」；FineBI/ClickUp 都给值 + 单位/状态，不把说明写死 | 指标区保留 4 个，但每个必须有真实数值或「—」；副标题改为随数据变化 |
| 项目清单 | 都用卡片/行承载项目；都靠状态词和颜色区分 | 当前单卡 7 类信息；ClickUp/Asana 行只有 3–4 类；当前无视图切换 | 先减密度，再加表格视图；不要先做复杂图表 |
| 图表 | 都用图形表达资料构成/分布 | 当前两块图表与卡片区等权；外部产品把图表当辅助，主视图是表格/路线图 | 图表保留，但压缩高度，不与卡片抢焦点 |
| 详情页 | 都有项目属性、阶段、截图、文档原话 | 当前项目档案埋在右栏第二 panel；Linear 是三栏属性/内容/证据 | 重排成三栏，属性 sticky，截图独立证据栏 |
| 阶段 | 都用六段/多段表达生命周期 | 当前六段条没有 N/6 文本，无节点连接线；飞书是节点流 | 卡片先加「N/6」，详情再升级节点流 |
| 截图查看 | 都有网格 + 点击放大 | 当前 lightbox 只支持单张，无上一张/下一张/计数；nstad 结果和详情都走极简浏览 | P1 加键盘导航与 x/y 计数；不引入 3D/缩放库 |
| 数据诚实 | 都避免无来源数字；当前规范明确 — | 当前 status 回落「已提交」、Donut 0 显示 0%，与「不编造」冲突 | 这两处是 P0，优先修 |
| 视觉 | 都深色/科技风；都使用蓝青与橙黄 | 当前 accents 按 index 轮播，颜色无语义；所有面板发光接近，没有焦点 | 颜色语义化；项目清单做主焦点，图表退后 |

### 1.5.3 可落地改造清单（P0 / P1 / P2）

#### 1.5.3.1 P0：先修正确性与语义，不动数据

| ID | 抄什么 | 为什么值得 | 代价 | 怎么验 |
|---|---|---|---|---|
| P0-1 | 把 ProjectCard.vue 第 6–7 行的 accents 从「按 index 轮播」改成「按状态映射」；status 为空时显示「—」，不使用「已提交」；补齐/待补/占位用青蓝/琥珀/灰三色 | 当前颜色不表达状态，且 status 回落把 null 伪装成「已提交」，直接违反项目「不编造、缺失显示 —」的价值取向 | 改 ProjectCard 模板 + styles.css 的 card/status/placeholder 类；不动 API | 用现有 3 个项目：有截图项目显示「资料齐全」青蓝，无截图项目（若存在）显示「截图待补充」琥珀，占位卡灰色；status 为 null 时文本必须是「—」；DOM 中不存在按 index 生成的四色主色 |
| P0-2 | ProjectCard.vue 第 34–35 行加「阶段 N/6」文本；TopBar.vue 第 36–37 行把第 4 指标改成 stage_done + ' / ' + stage_total（0 也显示 0/18），副标题根据缺失文档数动态生成 | 现在 0/18 显示「—」，把真实 0 当成缺失；六段条没有 N/6，读者会误以为百分比 | 模板文本 + 1 个 computed；不动接口 | 阶段维护里把某项目某段 PUT 成 done，刷新后 TopBar 显示「1 / 18」；全部 missing 时显示「0 / 18」；副标题从「三份文档均未提供」变为按 docx_count 计算 |
| P0-3 | DonutPanel.vue 第 17、65 行：0 张的图例显示「0 张」+ 灰色，不显示 0%；环形图中心显示总张数；total 为 0 时显示「—」或空态 | 0 是真实值，0% 是数学结果但会让读者以为「已统计但为空」；视觉上抢眼 | 改 legend 计算与颜色映射，ECharts 数据保持原样 | 某项目 shot_count=0 时，图例出现「0 张」且颜色为 --txt-mute；总数为 0 时中心显示「—」；非 0 时保留「N 张 · X%」 |

#### 1.5.3.2 P1：结构与交互，先做无需后端改动的

| ID | 抄什么 | 为什么值得 | 代价 | 怎么验 |
|---|---|---|---|---|
| P1-1 | DashboardView.vue 第 54 行 sec-head 右侧加「卡片 / 表格」切换；表格列固定 Name / Status / Stage / Updated，复用 ProjectSummary | Asana 的四个视图 tab 证明「同一批项目换一种扫描方式」比加更多图表更有用；3 个项目时表格也比 4 列卡片更省空间 | 1 个视图状态 + 1 个只读表格组件；API 保持原样 | 切到表格时 3 行项目 + 1 行「资料待上传」；切回卡片时 .card 数量 4；刷新默认卡片；表格无横向滚动 |
| P1-2 | ProjectDetailView.vue 第 166 行 info-grid 提为右侧 sticky 属性栏；字段固定 6 个：文档阶段 / 更新时间 / 源文件 / 截图数量 / 阶段完成 / 资料说明 | Linear 的三栏证明「属性不埋在内容里」；当前右栏两个 panel 高度不齐，档案被截图压到下方 | 纯 CSS Grid + 模板重排；不动 API | 6 个字段 label 与 API 值逐项比对；1920×1080 与 1366×768 无横向溢出；滚动时属性栏保持可见 |
| P1-3 | 截图 lightbox 加「上一张 / 下一张 / x of y / 方向键 / ESC」；点击遮罩关闭；焦点返回触发按钮 | 当前 lightbox 只有单图 + 关闭；nstad 等成果库都强调快速浏览；截图是当前产品最重要的证据，单张模式效率低 | 1 个 index 状态 + 键盘监听；不引入库 | 点第 1 张按 →，figcaption 变第 2 张，计数器 2/3；按 ← 回 1/3；ESC 关闭且 activeElement 回到第 1 张按钮；Tab 不逃出遮罩 |
| P1-4 | 阶段维护改为行内 select + 失焦保存 + toast；保存中禁用该行；失败显示原因 | 当前 6 行下拉 + 一个保存按钮，改动一段也要全量提交；飞书节点详情是「点节点看负责人和交付物」的局部编辑思路 | 前端表单状态 + 1 个 toast；后端已有 PUT /api/projects/{id}/stages/{seq} | 改第 3 段为 done，捕获 PUT 请求 1 次，toast 显示「已保存」，刷新详情仍为 done；改回 missing 再验一次 |
| P1-5 | 卡片摘要 clamp 2 行；文档原话只留在详情；卡片底部固定「DOCX N 份 · 截图 N 张」；空值用「—」 | ClickUp/Asana 的卡片只承载 3–4 个扫描要素；当前卡片摘要在 1920×1080 下已接近 3 行，信息过载 | 模板 + CSS line-clamp；不动数据 | 3 个项目卡高度一致；摘要超过 2 行出现省略号；文档原话不在卡片 DOM 中出现；docx/截图数为 0 时显示「0 份 / 0 张」而不是隐藏 |

#### 1.5.3.3 P2：需要新增接口或更多数据的

| ID | 抄什么 | 为什么值得 | 代价 | 怎么验 |
|---|---|---|---|---|
| P2-1 | 「阶段矩阵」视图：行=项目，列=六段，单元格=missing/active/done + 备注 | 飞书节点流 + Jira 时间桶说明阶段应可横向比较；当前只能逐项目看详情 | 新增 GET /api/projects/stages/matrix 或扩展 ProjectSummary 返回 stages；前端新表格 | 3 项目 × 6 段共 18 格；每格状态与详情页一致；点击格子跳到对应详情锚点 |
| P2-2 | 指标卡点击下钻：项目总数→按状态分组的列表；文档数→缺文档项目；截图数→0 截图项目 | FineBI 的指标树/血缘表明「指标可下钻」比静态数字有用；当前 4 个指标全是静态 | 前端筛选状态 + 复用表格视图；后端保持原样 | 点「截图 7 张」表格只显示有截图项目；点「结构化阶段 0/18」只显示 stage_done=0 项目；清空筛选恢复 3 行 |
| P2-3 | 增加「项目集」一级分组（如按课程/课题/实践批次），项目卡显示所属组 | 禅道的项目集→产品→项目→执行层级适合项目变多后的组织；当前 3 个项目不需要，但半年后会需要 | 数据结构新增 group 字段 + 分组 UI；需要改 data 与 API | 3 个项目分到 2 组时页面出现 2 个分组标题；空组不显示；分组计数等于组内项目数 |
| P2-4 | 大屏视觉重排：项目清单做主焦点，两个图表降为辅助带；颜色按状态语义；数字统一等宽字体 | 数字冰雹 IOC 和图观都只有一个主视觉焦点；当前所有面板发光接近，眼睛不知道先看哪 | 主要改 styles.css 与 Dashboard 布局；需要设计走查 | 1920×1080 截图中项目清单占最大亮度面积；同一状态颜色一致；prefers-reduced-motion 下无动画 |
| P2-5 | 导出/分享：导出当前筛选结果为 CSV；复制只读快照链接 | Asana 的 Share/Customize 说明协作场景需要分享视图；当前单用户工具先把导出做好即可 | 前端 CSV 生成；分享链接需要路由参数与只读模式（P2 后期） | 导出 3 行 CSV，列与表格一致；复制链接打开后筛选条件一致；不泄露内部字段 |

## 1.6 不抄清单（看起来像、但当前不该抄）

| 不抄的做法 | 来源样本 | 原因 | 证据 |
|---|---|---|---|
| 把营销落地页当产品工作台照搬 | Asana 首屏、科易网、阿里云 DataV、FineBI | 这些页面是获客转化页，首屏有注册/购买 CTA，真实工作台在登录后；直接照搬会把「卖点布局」当成「工作流布局」 | 【实证】见样本表第 1、11、14、15 行截图 |
| 角色化 AI agents 大全套 | monday.com PMO | 7 个 agent 是厂商营销叙事，当前产品没有任务执行、消息、审批后端；先做静态展示会变成一堆不可用的按钮 | 【推断】monday 页面为营销页，未登录验证实际 agent 行为 |
| 3D 园区 / 数字孪生主视觉 | 数字冰雹 / 图观 | 当前数据只有 DOCX 文本 + 7 张截图，没有空间数据；3D 场景会压过项目内容，且性能成本高 | 【实证】IOC 大屏以 3D 园区为焦点；当前数据见 docs/2026-11-09-project-showcase-spec.md |
| 三栏密集标题列表 / A-Z 索引 | 科研之友成果列表 | 当前只有 3 个项目，A-Z 索引是过度设计；等数据到几百条再考虑 | 【实证】科研之友列表页是三栏密集标题 + A-Z |
| 用 0% 装饰环形图 | 当前自身（DonutPanel） | 0 张是真实值，但 0% 在视觉上像「统计完成但为空」；应显示「0 张」+ 灰色，不用百分比抢焦点 | 【实证】DonutPanel.vue 第 17、65 行；当前截图环形图有图例百分比 |
| 颜色按卡片序号轮播 | 当前自身（ProjectCard accents） | 颜色不表达状态，用户很难用颜色判断「资料齐全/待补充」；这是「看起来丰富、实际无信息」 | 【实证】ProjectCard.vue 第 6–7 行 |

## 1.7 诚实清单（打不开、需登录、只有二手资料）

1. **搜索工具不可用**：内置 web_search 返回 "DeepSeek returned no web_search_tool_result blocks"；magpie-web-search 的 SearXNG 返回 "found nothing"；DuckDuckGo fetch failed。没有把搜索摘要当证据，全部以官网直取 + Chrome/puppeteer 截图为准；这会导致样本覆盖偏「官网可打开的产品」，不是完整市场地图。
2. **Asana**：https://asana.com/product/portfolios 首屏是注册转化页，不是登录后的产品；产品细节来自页面内嵌的产品截图（[asana-portfolios-product-2026-11-10.png](../previews/research-2026-11-10/asana-portfolios-product-2026-11-10.png)），没有进入真实 demo 操作。结论仅限于「截图可见的 UI」。
3. **Microsoft Project**：https://www.microsoft.com/en-us/microsoft-365/project/project-management-software 实际是价格比较页（Project Professional 2024 / Standard 2024 / Server 三张计划卡），不是产品 UI。样本表中只把它当「传统项目管理软件」类型样本，不用于卡片流设计结论。
4. **飞书项目**：https://project.feishu.cn/ 首页首屏被「飞书 CodeM」广告占满，不作为飞书项目首页证据；改用产品页 https://project.feishu.cn/home/product（HTTP 200）截图 [feishu-project-product-2026-11-10.png](../previews/research-2026-11-10/feishu-project-product-2026-11-10.png)。首页广告截图未放入样本表。
5. **Teambition**：https://www.teambition.com/ 首屏有钉钉 LTC 白皮书弹窗遮挡（[teambition-home-2026-11-10.png](../previews/research-2026-11-10/teambition-home-2026-11-10.png)）；文案部分取自 DOM，弹窗后的首屏可见性尚未确认。
6. **国家科技成果转化项目库**：https://www.nstad.cn/ 导航页 https://www.nstad.cn/nstas/navigation 需忽略证书错误（否则 ERR_CERT_DATE_INVALID）才能打开；详情页 https://www.nstad.cn/nstas/getDetalied?id=20168293 公开视图只有标题、成果简介、关键词和联系方式，更详细字段需登录，未验证登录后字段。
7. **科易网 / 阿里云 DataV / FineBI / ClickUp / monday.com**：这些是营销页或产品介绍页，不是登录后的真实工作台；关于「真实操作效率」的结论是【推断】，不是实测。
8. **科研之友**：只打开了成果列表页 https://www.scholarmate.com/indexhtml/pub_hot_zh_CN.html；首页与列表页视觉较旧，未登录进入个人工作台，未评价其项目管理能力。
9. **失败/未采用链接**：Smartsheet https://www.smartsheet.com/solutions/project-portfolio-management 导航超时 45s；monday /use-cases/portfolio-management 404；wrike /portfolio-management/ 404；smartsheet /use-case/project-portfolio-management 404；feishu /product/project 404；aliyun /product/datav 404；fanruan /finevis 404；eplugger.com.cn fetch failed；tri.tsinghua.edu.cn、iit.zju.edu.cn、aitri.sjtu.edu.cn fetch failed。以上均未作为样本结论依据。
10. **无用户测试、无性能数据**：本报告只做页面结构与视觉证据，不包含真实用户任务完成率、点击热区、Lighthouse 分数；P0/P1 的验收方式是行为断言，不是用户研究结论。
11. **截图时效**：所有截图抓取于 2026-11-10；官网可能改版。nstad 详情页是公开视图，不代表登录后完整字段。
12. **样本数**：15 个样本满足用户要求 10–15 个；其中 Microsoft Project 和 Teambition 的页面证据有上述限制，实际设计参考价值较低，已在样本表标注。

## 1.8 截图索引（previews/research-2026-11-10/）

| 文件 | 来源 | 说明 |
|---|---|---|
| [asana-portfolios-2026-11-10.png](../previews/research-2026-11-10/asana-portfolios-2026-11-10.png) | https://asana.com/product/portfolios | Asana Portfolios 首屏（注册转化页） |
| [asana-portfolios-product-2026-11-10.png](../previews/research-2026-11-10/asana-portfolios-product-2026-11-10.png) | 同上 | 页面内嵌的产品截图（Portfolio 表格 + 四视图） |
| [clickup-portfolios-2026-11-10.png](../previews/research-2026-11-10/clickup-portfolios-2026-11-10.png) | https://clickup.com/features/portfolios | ClickUp Portfolios 首屏 |
| [linear-projects-2026-11-10.png](../previews/research-2026-11-10/linear-projects-2026-11-10.png) | https://linear.app/docs/projects | Linear Projects 文档页（深色 + 三栏截图） |
| [jira-roadmaps-2026-11-10.png](../previews/research-2026-11-10/jira-roadmaps-2026-11-10.png) | https://www.atlassian.com/software/jira/features/roadmaps | Jira Roadmaps 首屏 |
| [monday-pmo-2026-11-10.png](../previews/research-2026-11-10/monday-pmo-2026-11-10.png) | https://monday.com/departments/pmo | monday PMO 首屏 |
| [feishu-project-product-2026-11-10.png](../previews/research-2026-11-10/feishu-project-product-2026-11-10.png) | https://project.feishu.cn/home/product | 飞书项目产品页（节点流） |
| [teambition-home-2026-11-10.png](../previews/research-2026-11-10/teambition-home-2026-11-10.png) | https://www.teambition.com/ | Teambition 首屏（有弹窗遮挡） |
| [zentao-home-2026-11-10.png](../previews/research-2026-11-10/zentao-home-2026-11-10.png) | https://www.zentao.net/ | 禅道首屏 |
| [digihail-ioc-2026-11-10.png](../previews/research-2026-11-10/digihail-ioc-2026-11-10.png) | https://www.digihail.com/pages/twin-easy-ioc.html | 数字冰雹 IOC 深色大屏 |
| [tuguan-dashboard-2026-11-10.png](../previews/research-2026-11-10/tuguan-dashboard-2026-11-10.png) | https://www.tuguan.net/industry/large-screen-visualization/large-screen-visualization.html | 图观大屏页 |
| [keyi-1633-2026-11-10.png](../previews/research-2026-11-10/keyi-1633-2026-11-10.png) | https://www.1633.com/ | 科易网首屏 |
| [scholarmate-results-2026-11-10.png](../previews/research-2026-11-10/scholarmate-results-2026-11-10.png) | https://www.scholarmate.com/indexhtml/pub_hot_zh_CN.html | 科研之友成果列表 |
| [nstad-navigation-2026-11-10.png](../previews/research-2026-11-10/nstad-navigation-2026-11-10.png) | https://www.nstad.cn/nstas/navigation | 国家科技成果转化项目库导航页（需忽略证书错误） |
| [nstad-detail-2026-11-10.png](../previews/research-2026-11-10/nstad-detail-2026-11-10.png) | https://www.nstad.cn/nstas/getDetalied?id=20168293 | nstad 详情页公开视图 |
| [finebi-home-2026-11-10.png](../previews/research-2026-11-10/finebi-home-2026-11-10.png) | https://www.finebi.com/ | FineBI 首屏 |
| [aliyun-datav-2026-11-10.png](../previews/research-2026-11-10/aliyun-datav-2026-11-10.png) | https://www.aliyun.com/product/bigdata/datav | 阿里云 DataV 首屏 |
| [microsoft-project-pricing-2026-11-10.png](../previews/research-2026-11-10/microsoft-project-pricing-2026-11-10.png) | https://www.microsoft.com/en-us/microsoft-365/project/project-management-software | Microsoft Project 价格比较页 |

## 1.9 一句话结论

当前产品最缺的不是「更多图表」，而是**项目清单的扫描效率、详情页的属性组织、阶段语义的真实表达**。P0 先修「status 回落已提交、0/18 显示 —、0% 抢焦点」三处诚实性问题；P1 抄 Asana 的双视图、Linear 的三栏、飞书项目的阶段节点；P2 再考虑阶段矩阵、指标下钻和项目集层级。所有截图与 URL 均已列在样本表和截图索引中，未使用未经验证的二手结论。
