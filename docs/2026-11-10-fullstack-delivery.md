# 项目实践聚合平台 · 全栈交付报告

日期：2026-11-10
范围：把展示页升级为可运行的全栈项目（Vue 3 前端 + FastAPI 后端 + SQLite），前端版式对齐参考页「软件学院项目实践聚合平台」，功能按本项目自有资料重做。

追加：2026-11-10 按机主反馈完成 P0+P1 UI 改造（诚实性、语义色、项目卡减密、详情三栏、六段节点流、灯箱翻页）。

再追加：2026-11-10 按 EditHere 批注把总览页图表区改为「软件生命周期环节」面板（六段 × 3 个项目维护状态），删除右侧「截图证据分布」环形图。

## 1. 目标与结果

| 要求 | 落地结果 |
|---|---|
| 前后端都要有 | `frontend/` Vue 3 + Vite；`backend/` FastAPI + SQLAlchemy |
| 前端用 Vue | Vue 3.5 + Vite 6，构建产物由后端托管（ECharts 已不参与页面渲染） |
| 后端用 Python | FastAPI 0.162 + Uvicorn 0.54 + SQLAlchemy 2.1 |
| 要有数据库 | SQLite `backend/data/app.db`，首次启动建表并灌种子；可换 `DATABASE_URL` |
| 样子像参考页 | 初版为 1920×1080 浅色柔和彩虹大屏；2026-11-10 最终版改为深色生命周期看板，见第 12 节 |
| 功能不是参考页 | 本项目功能：软件生命周期六环节维护状态（六段 × 3 个项目）、项目详情、六段阶段人工维护（写库） |

## 2. 改动的文件

### 新增（后端）

- `backend/app/main.py`：FastAPI 入口，挂 API、`/media`、`/assets` 与 SPA 回退。
- `backend/app/config.py`：路径与 `DATABASE_URL` 配置。
- `backend/app/db.py`：引擎、会话、`Base`。
- `backend/app/models.py`：projects / source_files / screenshots / stage_templates / project_stages 五张表。
- `backend/app/schemas.py`：Pydantic 出入参（含 `docx_name`）。
- `backend/app/seed.py`：从 `data/projects.json` 灌种子，已有数据不覆盖。
- `backend/app/routers/api.py`：REST 路由与统计。
- `backend/tests/conftest.py`、`backend/tests/test_api.py`：9 条契约测试。
- `backend/requirements.txt`、`backend/pytest.ini`。

### 新增（前端）

- `frontend/package.json`、`vite.config.ts`、`index.html`、`src/main.ts`、`src/api.ts`、`src/styles.css`。
- `frontend/src/App.vue`：只挂 `<RouterView />`；`src/router.ts` 用 hash 路由（`#/` 总览、`#/project/:id` 详情）；`src/useFitScreen.ts` 提供 1920×1080 等比缩放。
- `frontend/src/components/ProjectCard.vue`：项目卡（`RouterLink`；封面 16:9 缩略、真实状态、两行摘要、DOCX 文件名、源文件/截图计数、阶段 `N / 6` 六个状态点、资料状态；不写死百分比）。
- `frontend/src/components/TopBar.vue`：品牌区 + 4 个指标卡；阶段数始终显示 `N / 18`，0 时显示 `0 / 18`。
- `frontend/src/components/LifecyclePanel.vue`：软件生命周期六环节面板（六段 × 3 个项目维护状态；标题旁显示 `0 / 18 已维护` 总体统计；每段列出三个项目的「已完成 / 维护中 / 未维护」状态）。
- `frontend/src/views/DashboardView.vue`：总览页（顶栏 + 生命周期面板 + 4 列卡片 + 底栏；进入页面时并行拉取三个项目的阶段明细）。
- `frontend/src/views/ProjectDetailView.vue`：独立项目详情页（`260px` 项目档案栏 + 中间六段阶段节点流/阶段维护/文档原话/内容摘要 + `360px` 截图证据）；保存阶段后写库并刷新；截图点击用页内灯箱放大，支持上一张/下一张、`1 / N`、Esc、方向键与焦点返回，不新开窗口。
- ~~`frontend/src/components/DetailDrawer.vue`~~：已删除，详情改为独立路由页。

### 新增（脚本与说明）

- `start.ps1` / `start.cmd`：一键创建环境、构建前端、启动 `http://127.0.0.1:8000` 并开浏览器。
- `dev.ps1`：开发模式（后端 8000 + Vite 5173 热更新，代理 /api 与 /media）。
- `README.md`：目录结构、启动、API 表、数据库、测试、数据口径。
- `.gitignore`：忽略 .venv、node_modules、dist、db、_temp。

### 未改动

- `pages/index.html`（原静态展示页）保持原样，旧测试 15/15 仍过。
- `data/projects.json` 仍是唯一数据源，未改一个字节。
- `assets/css/*`、`assets/js/*`、`tests/2026-11-09-showcase.test.mjs` 未改。

## 3. 怎么启动

**双击 `start.cmd`**（或 `powershell -ExecutionPolicy Bypass -File start.ps1`）：

1. 没有 `backend/.venv` 就 `uv venv` + 装依赖；
2. 没有 `frontend/dist/index.html` 就 `npm install` + `npm run build`；
3. 启动 `http://127.0.0.1:8000`，2 秒后自动开浏览器；API 文档 `/docs`。

当前已验证服务在 `http://127.0.0.1:8000` 运行；关掉窗口即停。

开发模式：`powershell -ExecutionPolicy Bypass -File dev.ps1`（前端 5173 热更新）。

## 4. REST API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/meta` | 资料统计 3/3/7 与六段阶段框架 |
| GET | `/api/projects` | 项目列表（docx 名、截图数、封面） |
| GET | `/api/projects/{id}` | 详情（源文件、截图、六段阶段） |
| POST | `/api/projects` | 新建项目 |
| PATCH | `/api/projects/{id}` | 修改项目 |
| DELETE | `/api/projects/{id}` | 删除项目 |
| PUT | `/api/projects/{id}/stages/{seq}` | 更新阶段（missing/active/done） |
| GET | `/api/stats` | 汇总统计（stage_done / stage_total） |

## 5. 数据库

- 文件：`backend/data/app.db`（45 056 B，已生成）。
- 表：`projects`、`source_files`、`screenshots`、`stage_templates`、`project_stages`（`project_id + seq` 唯一）。
- 种子：3 个项目、3 份 DOCX、7 张截图、6 个阶段模板 × 3 项目 = 18 条阶段记录，初始全部 `missing`。

## 6. 验收证据

| 项目 | 结果 | 证据 |
|---|---|---|
| 前端构建 | 596 modules transformed，退出 0 | `npm run build` |
| 后端契约测试 | 9 passed | `backend\.venv\Scripts\python.exe -m pytest -q` |
| P0+P1 UI 验收 | 22/22，含 1 条必失败反例（0% 必须不存在） | `_temp\2026-11-10-ui-polish-verify.json` |
| 全栈联调（API + DOM + 独立详情页 + 截图灯箱 + 写库 + 复位） | 25/25，含 1 条必失败反例 | `_temp\2026-11-10-route-verify.json` |
| 旧静态页测试 | 15/15 | `node --test tests/2026-11-09-showcase.test.mjs` |
| 首屏 | 1920×1080，4 卡（3 真 + 1 占位）、2 个 ECharts canvas、横向溢出 0、页面错误 0 | `previews\2026-11-10-ui-polish-dashboard.png` |
| 独立详情页 | hash `#/project/{id}`，6 段阶段、6 个下拉、3/4 张截图、三栏稳定、返回链接可用 | `previews\2026-11-10-ui-polish-detail.png` |
| 截图放大 | 点截图在页内灯箱放大（缩略 341px → 大图 1766px），不新开窗口；`1 / 3` → `2 / 3`，Esc / 关闭按钮 / 点遮罩均可退出 | `previews\2026-11-10-ui-polish-lightbox.png` |
| 阶段写库 | PUT done → `/api/stats` 的 `stage_done` 0→1；再 PUT missing 复位成功 | 同上 JSON |
| 手机 390×844 | 无横向溢出；详情页文档高可滚动，标题不再竖排 | `previews\2026-11-10-ui-polish-mobile.png` |

反例说明：脚本里故意断言「详情页仍存在 1 个抽屉」，实际为 0（详情已改独立页），该断言必须失败；结果为失败，证明校验不是自证。

## 7. 诚实清单

- 前端不复制参考页的「负责人 / 技术栈 / 完成度百分比」——本项目资料里没有这些字段，界面统一显示 `—`，不编造数字；状态为 `null` 显示 `—`，阶段为 `0` 显示 `0 / 18` 与 `0 / 6`，不出现 `0%`。
- 六段阶段初始全部「文档未提供」；独立详情页里的阶段维护是唯一写库入口，保存后刷新页面仍在（已实测）。早期测试残留的阶段值已恢复为 `missing`，备份在 `_temp\2026-11-10-app-before-stage-reset.db`。
- 详情页用 hash 路由，刷新与浏览器前进/后退都可用；分享链接形如 `/#/project/{id}`。
- 参考页用 CDN 的 ECharts；本项目已把 ECharts 打进 `frontend/dist/assets/index-*.js`（1.16 MB），离线可开。
- 当前无登录/权限，定位是本机单用户展示与维护工具；多人使用需另加认证。
- 阶段备注默认写「人工维护」或「文档未提供」，未自动从 DOCX 推断阶段。

## 8. 回退

- 全栈部分可整体删除 `backend/`、`frontend/`、`start.ps1`、`start.cmd`、`dev.ps1`，原 `pages/index.html` 与 `data/projects.json` 不受影响。
- 旧静态页历史归档见 `archive/2026-11-09-index-pre-ppt/_索引.md`。

## 9. 2026-11-10 追加：浅色柔和彩虹配色

按机主 m03092 反馈「这个太让人眼花缭乱了，改成普通的让人看起来舒服的彩虹搭配色」，采用 m03104 选择的「浅色柔和彩虹」方向。结构、布局、数据、路由、后端与测试契约均未改动，只替换视觉 token 与组件颜色。

- 改动文件：`frontend/src/styles.css`、`frontend/src/components/BarPanel.vue`、`frontend/src/components/DonutPanel.vue`、`frontend/src/components/ProjectCard.vue`。
- 旧样式备份：`_temp/2026-11-10-styles-before-rainbow.css`。
- 页面底 `#f3f5f9`，面板/卡片改为近白半透明；指标条依次为柔蓝 `#76a9f4`、柔绿 `#6fc4a4`、柔黄 `#ecc26e`、柔紫 `#ad9be6`；卡片顶边为粉/绿/黄柔和强调色；条形图蓝+珊瑚、环形图绿+黄；正文 `#2f3747`、次级文字 `#4a5668` / `#536072`，保持可读对比度。
- 验收重跑：前端 build 596 modules 退出 0；UI 22/22；路由 25/25；后端 pytest 9 条通过；旧静态页 15/15；`/api/stats` 为 `stage_done 0 / stage_total 18`。
- 最终截图：`previews/2026-11-10-rainbow-01-dashboard.png`、`-02-detail.png`、`-03-lightbox.png`、`-04-1366.png`。
- 验收证据：`_temp/2026-11-10-rainbow-final-verify.json`。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可；若服务未运行，双击 `start.cmd`。

## 10. 2026-11-10 追加：图表区改为软件生命周期环节

按 EditHere 批注（feedback-minimal-4，2 个对象）执行：左侧「资料构成」图表批注「换成别的统计数据，换成软件生命周期的环节」；右侧「截图证据分布」图表批注「这个删除掉」。结构、数据源、路由、后端与测试契约均未改动。

- 改动文件：`frontend/src/views/DashboardView.vue`、`frontend/src/components/LifecyclePanel.vue`（新增）、`frontend/src/styles.css`。
- 新版式：总览页图表区只保留一个全宽面板「软件生命周期环节」；面板标题右侧显示 `0 / 18 已维护`（来自 `/api/stats` 的真实统计）；下方六列卡片依次为 `01 需求分析`、`02 方案设计`、`03 开发实现`、`04 测试验证`、`05 部署上线`、`06 运维迭代`；每张卡列出 3 个项目及其状态（`已完成 / 维护中 / 未维护`），当前全部为「未维护」。
- 删除内容：右侧「截图证据分布」环形图不再渲染；`BarPanel.vue` / `DonutPanel.vue` 文件保留但总览页不再引用，ECharts 不参与本次页面渲染。
- 验收重跑：前端 `npm run build` 39 modules 退出 0（CSS 22.09 kB、JS 117.09 kB，产物 `index-nd53ZBbe.css` / `index-DP4qjMib.js`）；UI 22/22；路由 25/25；生命周期专项 21/21；后端 `pytest` 9 passed；旧静态页 `node --test` 15/15；`/api/stats` 仍为 `stage_done 0 / stage_total 18`。
- 生命周期面板实测：6 张 `.life-stage`、18 条项目状态行、六段名称与 18 条阶段记录一致；面板区高度 372px，卡片 303×320px，横向溢出 0，页面错误 0。
- 最终截图：`previews/2026-11-10-lifecycle-dashboard.png`（1920×1080 总览）、`previews/2026-11-10-lifecycle-detail.png`（详情页）、`previews/2026-11-10-lifecycle-mobile.png`（390×844 手机）。
- 验收证据：`_temp/2026-11-10-lifecycle-verify.json`、`_temp/2026-11-10-ui-polish-verify.json`、`_temp/2026-11-10-route-verify.json`。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可；`start.cmd` 启动时自动重建前端。

## 11. 2026-11-10 追加：项目总览与项目子页面改版（只改前端）

按机主 m04505 原话执行：「先是主页面，主页面，上展示项目，项目有多少个，具体是什么项目，项目是谁开发的，指导老师是谁。把在做和已做的项目展示出来，分块，在做的项目和已做的项目。在做的项目是安装模块来展示，展示已开发完毕的功能，和正在开发的功能，已做的项目是，现在有多少用户用，运行了多久等等。主页面，以及每个项目的子页面更详细的页面。先不要管后端，只写前端页面」。本轮只改 `frontend/`，未动 `backend/`、`data/projects.json`、`pages/` 与测试契约。

- 改动文件：`frontend/src/content/projectShowcase.ts`（新增，按项目 id 维护在做/已做、模块进度、运行数据）、`frontend/src/components/DoingProjectCard.vue`（新增）、`frontend/src/components/DoneProjectCard.vue`（新增）、`frontend/src/views/DashboardView.vue`、`frontend/src/components/TopBar.vue`、`frontend/src/views/ProjectDetailView.vue`、`frontend/src/styles.css`。
- 主页结构：顶部 6 指标「项目总数 3 / 在做项目 2 / 已做项目 1 / 开发成员 0 人 / 指导教师 0 位 / 已维护阶段 0 / 18」；「IN PROGRESS 在做项目」两张卡，每卡同时列出「已开发完毕」与「正在开发」模块及数量；「DELIVERED 已做项目」一张卡，左侧 2×2 业务数据（379 申报个人 / 48 申报单位 / 378 申报书 / 348 待线下评审），右侧 RUN TIME 显示运行时长 `—` 并注明「文档未提供上线日期与连续运行时长」，底部列出 9 项已交付模块；另保留 1 个「更多已做项目待归档」占位。
- 子页面：详情标题行增加「在做 / 已做」标识与阶段说明；在做项目详情顶部新增「模块进度」双列（已开发完毕 / 正在开发）；已做项目详情顶部新增「运行数据」四格与「已交付模块」清单；原有项目档案、六段阶段记录、阶段维护、文档原话、内容摘要、截图画廊全部保留。
- 数据诚实：开发成员与指导教师来自 `data/projects.json` 的 `developers` / `advisor`，当前均为空，页面统一显示 `—` 与「文档未提供成员名单 / 教师信息」；运行时长文档未提供，显示 `—`；页面无演示假姓名、无硬编码百分比。模块清单与 379/48/378/348 均取自三份 DOCX 正文的业务描述，不是页面编造。
- 验收（全绿）：`npm run build` 40 modules，退出 0（CSS 36.73 kB、JS 126.28 kB）；新前端专项 40/40；旧 UI 22/22；路由 25/25；后端 pytest 9 passed；旧静态页 15/15。专项覆盖 2 在做 + 1 已做 + 1 占位、模块列无裁切、379/48/378/348、运行时长缺失说明、详情 10/9 个模块、六段阶段、1366 与 390 无横向溢出、假姓名检测器负向对照。
- 最终截图：`previews/2026-11-10-showcase-dashboard.png`、`previews/2026-11-10-showcase-detail-doing.png`、`previews/2026-11-10-showcase-detail-done.png`、`previews/2026-11-10-showcase-1366.png`、`previews/2026-11-10-showcase-phone.png`。
- 验收证据：`_temp/2026-11-10-showcase-verify.json`、`_temp/2026-11-10-ui-polish-verify.json`、`_temp/2026-11-10-route-verify.json`。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可；若服务未运行，双击 `start.cmd`，启动时会自动重建前端。

## 12. 2026-11-10 追加：按参考稿复刻深色生命周期看板

按机主 m04787 原话「改成这样的，要求跟这个一模一样」执行，参考文件为 `C:\Users\31598\Documents\xwechat_files\wxid_7jwx1tvpie3522_3575\temp\RWTemp\2026-11\78d4cbfacd3bfa5b39b72440c4a1f812\软件学院项目实践聚合平台(1).html`。同时执行三张截图批注：抽屉底部「这里添加项目的图片」、删除「部署」整列、「已投产」改为「已上线」。

- 入口改动：`frontend/src/App.vue` 直接渲染 `KanbanPage`；`frontend/src/main.ts` 引入 `kanban.css`；`frontend/index.html` 根节点改 `#root`、标题改「软件学院 · 项目实践聚合平台」。旧 `DashboardView`/`ProjectDetailView`/组件与 `styles.css` 保留，但不再参与页面入口。
- 新增文件：`frontend/src/views/KanbanPage.vue`（双视图、筛选、历史版本、版本卡、详情抽屉、ECharts 总览）、`frontend/src/kanban/data.ts`（9 个演示项目、19 个版本、5 个阶段）、`frontend/src/kanban.css`（深色参考稿样式、480px 抽屉、项目图片 256px 高）。
- 看板结构：5 列依次为需求对接 / 数据库设计 / 开发 / 测试 / 已上线；当前版本卡 9 张（1/1/3/3/1）；顶部统计「版本总数 19 / 在研 12 / 已上线 7 / 超期风险 3」；「部署」列已删除；「已投产」全部改为「已上线」。
- 数据总览：5 个 KPI（项目总数 9、在研版本 12、已上线版本 7、平均阶段完成度 74%、超期风险版本 3）+ 阶段分布柱状图 / 阶段占比环图 / 近 8 周趋势 / 技术栈分布 / 近期风险列表。
- 详情抽屉：宽 480px；含生命周期进度、版本信息、版本历史、近 4 周提交次数与项目图片；项目图片根据项目 `image` 从 `/media/<filename>` 加载。
- 验收：`npm run build` 569 modules 退出 0（dist CSS 10.54 kB、JS 1,124.34 kB）；`node _temp/2026-11-10-kanban-check.mjs` 18/18（标题、默认页签、四项统计、五阶段命名、1/1/3/3/1 卡数、9 张版本卡、无「已投产/部署」文案、1920 无溢出、抽屉图片可加载、抽屉宽 480、总览 5 KPI / 3 canvas、1366 无横向溢出、无控制台错误）。
- 截图：`previews/2026-11-10-kanban-board.png`（1920×1080）、`previews/2026-11-10-kanban-drawer.png`、`previews/2026-11-10-kanban-overview.png`、`previews/2026-11-10-kanban-1366.png`。
- 验收证据：`_temp/2026-11-10-kanban-check.json`。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可；前端已构建到 `frontend/dist`，后端直接托管，无需重启。
- 数据说明：当前看板采用参考稿的 9 个演示项目与示例成员（张三/李四等）；如果要换成真实 3 个项目与真实成员/指导教师，修改 `frontend/src/kanban/data.ts` 后重新 `npm run build`。

## 13. 2026-11-10 追加：项目图片多图放大 + 左侧宠物留白

按机主截图批注执行：抽屉「项目图片」要有很多张且点击能放大；看板左侧留出宠物小人的位置，但不实现宠物层。

- 多图数据：`frontend/src/kanban/data.ts` 的 `KanbanProject.image: string` 改为 `images: string[]`，9 个演示项目各配 4 张图，全部从现有 `/media/` 素材复用。
- 抽屉画廊：`frontend/src/views/KanbanPage.vue` 在「项目图片」区渲染 `.shot-gallery` + 4 个 `.shot-thumb` 缩略图（带 `1–4` 序号）+ 「点击任意图片放大查看」；点击缩略图打开 `.lightbox` 大图，支持左右箭头切换、Esc 优先关灯箱（抽屉保持打开）、关闭按钮。
- 宠物留白：看板 `.lanes` 外新增 `.board-main` 与左侧 `.pet-stage` 空 div（宽 600px、`pointer-events:none`、无子元素）；不挂载任何宠物 DOM/逻辑，后续接入时直接使用该区域。
- 样式：`frontend/src/kanban.css` 新增 `.shot-gallery`（2 列）、`.shot-thumb`（16/10）、`.lightbox`（z-index 40）、`.board-main`、`.pet-stage`；原 `.project-shot` 保留但模板不再使用。
- 验收：`npm run build` 569 modules 退出 0（CSS 12.63 kB、JS 1,127.67 kB）；`node _temp/2026-11-10-kanban-check.mjs` 21/21，新增覆盖 4 张项目图片全部加载、灯箱打开且 caption `1 / 4`、Esc 关灯箱保留抽屉、左侧 `.pet-stage` 600px 且 0 子元素、1366 宽 `offsetWidth=600`；无 pageerror / console error。
- 截图：`previews/2026-11-10-kanban-board.png`、`previews/2026-11-10-kanban-drawer.png`、`previews/2026-11-10-kanban-lightbox.png`、`previews/2026-11-10-kanban-overview.png`、`previews/2026-11-10-kanban-1366.png`。
- 验收证据：`_temp/2026-11-10-kanban-check.json`。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可；前端已构建到 `frontend/dist`，后端直接托管，无需重启。

## 14. 2026-11-10 追加：末阶段「已上线」改为「上线」

按机主截图批注，把生命周期看板最后一列的阶段名从「已上线」改为「上线」；顶部统计「已上线 7」仍表示已上线版本数量，保留原语义。

- 改动：`frontend/src/kanban/data.ts` 的 `KANBAN_STAGES` 第五项 `{ name: '已上线' }` 改为 `{ name: '上线' }`。
- 验收：`npm run build` 569 modules 退出 0（CSS 12.63 kB、JS 1,127.66 kB）；`node _temp/2026-11-10-kanban-check.mjs` 21/21，阶段名断言为 需求对接 / 数据库设计 / 开发 / 测试 / 上线。
- 截图：`previews/2026-11-10-kanban-board.png`。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可，无需重启。

## 15. 2026-11-10 追加：「负责人」统一改为「指导老师」

按机主截图批注，把详情抽屉「版本信息」里的「负责人」改为「指导老师」；版本卡与筛选下拉同步统一。

- 改动：`frontend/src/views/KanbanPage.vue` 中版本卡文案「负责人 · {owner}」改为「指导老师 · {owner}」，抽屉字段标签「负责人」改为「指导老师」，筛选下拉「全部负责人」改为「全部指导老师」。
- 验收：`npm run build` 569 modules 退出 0（CSS 12.63 kB、JS 1,127.67 kB）；`node _temp/2026-11-10-kanban-check.mjs` 23/23，新增检查页面无「负责人」残留、筛选含「全部指导老师」、抽屉版本信息含「指导老师」。
- 截图：`previews/2026-11-10-kanban-drawer.png`。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可，无需重启。

## 16. 2026-11-10 追加：已上线项目抽屉改为使用情况图表

按机主截图批注，已上线项目的抽屉把「近 4 周提交次数」替换成「项目使用情况」，用环形图展示用户数量与已开发功能数；未上线项目保留近 4 周提交次数柱状图。

- 数据：`frontend/src/kanban/data.ts` 的 `KanbanProject` 增加 `users` / `features` 两个字段，9 个演示项目均填入演示值（如学术讲座预约平台 1,260 人 / 24 项）；真实值替换这两项即可。
- 展示：`frontend/src/views/KanbanPage.vue` 新增 `isLiveProject` 与 `usageMetrics`；已上线项目渲染两枚 `.usage-ring` 环形图（用户数量、已开发功能，满环分别 2,000 人 / 40 项），未上线项目继续使用 `.commit-bars`。
- 样式：`frontend/src/kanban.css` 新增 `.usage-charts`、`.usage-card`、`.usage-ring`、`.usage-ring-inner`、`.usage-label`、`.usage-scale`。
- 验收：`npm run build` 569 modules 退出 0（CSS 13.52 kB、JS 1,128.90 kB）；`node _temp/2026-11-10-kanban-check.mjs` 26/26，覆盖已上线项目 2 个使用情况卡片与未上线项目提交柱状图。
- 截图：`previews/2026-11-10-kanban-drawer.png`。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可，无需重启。

## 17. 2026-11-10 追加：数据修改页

按机主截图批注，在顶栏「数据总览」左侧新增「数据修改」入口；点击进入独立编辑页，可修改生命周期看板的全部本地数据，保存后立即回到看板。

- 入口：`frontend/src/App.vue` 按 hash 切换 `KanbanPage`（`#/`）与 `DataEditPage`（`#/edit`）；`KanbanPage.vue` 顶部新增 `.nav-right` 与 `a.nav-action`「数据修改」。
- 新增页面：`frontend/src/views/DataEditPage.vue` 固定 1920×1080，主区可滚动；包含阶段设置（5 个阶段名称 + 颜色）、9 个项目编辑卡（指导老师、团队成员、用户数量、已开发功能、技术栈、项目图片、版本增删改）、新增/删除项目、恢复默认、返回看板、保存并查看看板。
- 数据层：`frontend/src/kanban/data.ts` 新增 `KanbanData`、`defaultKanbanData()`、`loadKanbanData()`、`saveKanbanData()`、`resetKanbanData()`，保存写浏览器 localStorage，异常回退默认数据；原 `KANBAN_STAGES` / `KANBAN_PROJECTS` 常量保留兼容。
- 样式：`frontend/src/kanban.css` 新增 `.nav-right`、`.nav-action` 与 `#data-editor` / `.editor-main` / `.stage-grid` / `.projects-editor` / `.project-editor` / `.field-grid` / `.version-row` 等编辑页样式。
- 修复记录：编辑页初版「阶段设置」面板被 flex 收缩到 38px 且 `overflow:hidden`，阶段输入框不可见；在 `kanban.css` 增加 `.editor-panel,.project-editor{flex:none}` 后，面板高度恢复 130px，`stage-grid` 57px 正常显示。
- 验收：`npm run build` 571 modules 退出 0（dist CSS 18.14 kB、JS 1,139.45 kB）；`node _temp/2026-11-10-kanban-check.mjs` 26/26；`node _temp/2026-11-10-data-editor-check.mjs` 14/14（入口按钮、`#/edit`、5 阶段 / 9 项目 / 19 版本、保存后看板同步、刷新持久化、恢复默认、无页面错误）。
- 截图：`previews/2026-11-10-data-editor.png`（1920×1080，183,423 B）、`previews/2026-11-10-data-editor-applied.png`（1920×1080，198,056 B）。
- 验收证据：`_temp/2026-11-10-data-editor-check.json`。
- 生效方式：重新构建前端后刷新 `http://127.0.0.1:8000`，无需重启后端。

## 18. 2026-11-10 追加：删除抽屉「仓库链接」

按机主截图批注，删除详情抽屉「版本信息」里红框框住的「仓库链接 / 查看项目仓库 ↗」。

- 改动：`frontend/src/views/KanbanPage.vue` 删除 `VersionView.repo` 字段、版本数据里的 repo 赋值，以及「版本信息」中的仓库链接节点；抽屉只保留指导老师、团队成员、技术栈、开始日期、预计交付。
- 验收：`npm run build` 571 modules 退出 0（dist CSS 18.14 kB、JS 1,139.22 kB）；`node _temp/2026-11-10-kanban-check.mjs` 26/26；`node _temp/2026-11-10-data-editor-check.mjs` 14/14；抽屉截图确认无「仓库链接 / 查看项目仓库」文案。
- 截图：`previews/2026-11-10-kanban-drawer.png`（1920×1080，209,801 B）。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可，无需重启后端。

## 19. 2026-11-10 追加：仅上线项目显示「项目使用情况」

按机主截图批注，开发阶段的「实验室预约系统」不应显示「项目使用情况」，只有当前版本处于「上线」阶段的项目才展示用户数量与已开发功能。

- 改动：`frontend/src/views/KanbanPage.vue` 新增 `selectedProjectCurrentVersion`，按版本号排序取项目当前版本；`isLiveProject` 从「项目历史上出现过上线版本」改为「当前版本阶段 === 上线」。
- 结果：实验室预约系统当前 v1.2 处于开发阶段，即使历史 v1.0 上过线，也不再显示使用情况，改为「近 4 周提交次数」；学术讲座预约平台当前 v1.1 为上线阶段，仍显示两枚使用情况环形图。
- 验收：`npm run build` 571 modules 退出 0（dist CSS 18.14 kB、JS 1,139.42 kB）；`node _temp/2026-11-10-kanban-check.mjs` 28/28；新增「开发中项目不应显示项目使用情况」反例。
- 截图：`previews/2026-11-10-kanban-drawer-dev.png`（1920×1080，212,139 B）。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可，无需重启后端。

## 20. 2026-11-10 追加：项目使用情况改为水平进度条

按机主截图批注，将「项目使用情况」的两枚环形图替换为水平进度条，不再使用圆环格式。

- 模板：`frontend/src/views/KanbanPage.vue` 的 `.usage-ring` 改为 `.usage-head`（标签 + 数值）、`.usage-track` + `.usage-fill`（进度条）、`.usage-foot`（满环说明 + 百分比）。
- 样式：`frontend/src/kanban.css` 移除 `.usage-ring*` 圆环规则，新增 `.usage-head`、`.usage-value`、`.usage-track`、`.usage-fill`、`.usage-foot`；进度条高度 10px、圆角 `999px`，填充色沿用青色与绿色。
- 验收：`npm run build` 571 modules 退出 0（dist CSS 18.06 kB、JS 1,139.60 kB）；`node _temp/2026-11-10-kanban-check.mjs` 28/28，用户数量与已开发功能文本、开发中项目反例均通过。
- 截图：`previews/2026-11-10-kanban-drawer.png`（1920×1080，201,872 B）。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可，无需重启后端。

## 21. 2026-11-10 追加：数据修改页项目图片改为上传与缩略图

按机主截图批注，把数据修改页每个项目的「项目图片（每行一个地址）」textarea 改为「上传图片 + 缩略图预览 + 单张删除」。

- 数据：`frontend/src/views/DataEditPage.vue` 的 `EditorProject.imagesText: string` 改为 `images: string[]`；载入、新增项目、保存全部按数组处理，删除 `splitImages`。
- 上传：新增 `fileToDataUrl()`，用 FileReader + canvas 把图片等比压缩到最长边 `MAX_IMAGE_EDGE = 1400`，白底转 JPEG（quality 0.82）；非图片或单张 >12 MB 直接提示失败。`uploadImages()` 支持多选与拖拽，成功后即时 push 到当前项目并提示「已添加 N 张图片，点击保存后写入看板」；`removeImage()` 删除单张。
- 模板：原 textarea 替换为 `.image-field.wide`，含「项目图片 N 张」标题、`.image-upload-btn`（隐藏的 `input[type=file][multiple]`）、`.image-drop` 拖放区、`.image-grid` 缩略图（带 × 删除按钮）、无图时的 `.image-empty` 与 `.image-hint`。
- 样式：`frontend/src/kanban.css` 新增 `.image-field`（整行 4 列跨列）、`.image-field-head`、`.image-upload-btn`、`.image-drop`、`.image-grid`（6 列）、`.image-item`（16:10）、`.image-remove`、`.image-empty`、`.image-hint`。
- 验收：`npm run build` 571 modules 退出 0（dist CSS 19.52 kB、JS 1,141.82 kB）；`node _temp/2026-11-10-data-editor-check.mjs` 16/16（新增：默认 4 张预览、上传一张后变 5 张、新图 src 为 `data:image/jpeg` 且 naturalWidth>0、保存后 localStorage 含 `data:image/jpeg`、重新进入编辑页仍保留 5 张缩略图）；`node _temp/2026-11-10-kanban-check.mjs` 28/28；无 pageerror / console error。
- 截图：`previews/2026-11-10-data-editor.png`（1920×1080，243,714 B）、`previews/2026-11-10-data-editor-upload.png`（1920×1080，268,440 B）、`previews/2026-11-10-data-editor-applied.png`（1920×1080，198,063 B）。
- 验收证据：`_temp/2026-11-10-data-editor-check.json`。
- 说明：图片以 data URL 存浏览器 localStorage，受浏览器配额限制；保存失败时编辑页已有错误提示。当前未接入图床，换浏览器或清理站点数据会回到默认图片。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可，无需重启后端。

## 22. 2026-11-10 追加：项目使用情况改为数据卡

按机主截图批注「不要这样显示，不要这样，看起来项目像没做完」，取消「项目使用情况」的进度条与百分比，改为两枚完整数据卡。

- 模板：`frontend/src/views/KanbanPage.vue` 的 `.usage-charts` / `.usage-card` 改为 `.usage-stats` / `.usage-stat`；每枚数据卡展示标签、数值、单位与「当前上线版本累计/已完成」，不再出现进度轨道、满环分母或百分比。
- 指标：用户数量改为「累计用户」，已开发功能改为「上线功能」；仍取 `frontend/src/kanban/data.ts` 的 `users` / `features`。
- 样式：`frontend/src/kanban.css` 移除 `.usage-head`、`.usage-track`、`.usage-fill`、`.usage-foot`，新增 `.usage-stats`（两列）、`.usage-stat`（左侧 3px 彩色标记）、`.usage-stat-label`、`.usage-stat-value`、`.usage-stat-note`。
- 验收：`npm run build` 571 modules 退出 0（dist CSS 19.44 kB、JS 1,141.58 kB）；`node _temp/2026-11-10-kanban-check.mjs` 28/28，新增断言「已上线项目 2 枚数据卡、无 `.usage-track`/`.usage-fill`、数据卡文本无 %」；数据修改页 16/16；无 pageerror / console error。
- 截图：`previews/2026-11-10-kanban-drawer.png`（1920×1080，222,918 B）。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可，无需重启后端。

## 23. 2026-11-11 追加：移除超期风险，卡片改显示开发成员

按机主截图批注「超期风险也不要」和「不要已停留时间，改成显示是谁开发的」，移除所有超期风险展示，版本卡底部改为指导老师 + 开发成员。

- 总览：`frontend/src/views/KanbanPage.vue` 的 KPI 从 5 个减为 4 个，删除「超期风险版本数」；删除「近期风险版本」面板；总览第三行改为两栏布局。
- 看板：工具栏统计删除「超期风险」；版本卡不再显示「已停留 N 天」，改为显示 `开发成员 · {{ version.project.team }}`，指导老师保留。
- 样式：`frontend/src/kanban.css` 的 `.kpis` 改为四列、`.row-three` 改为 `1.5fr 1fr`、`.card-meta` 改为纵向排列并允许开发成员换行。
- 验收：`npm run build` 571 modules 退出 0（dist CSS 19.49 kB、JS 1,140.84 kB）；浏览器快照确认看板顶部统计为 19 / 12 / 7，9 张版本卡均显示「开发成员 · …」，无「超期风险」「已停留」文案。
- 截图：`previews/2026-11-11-kanban-no-risk-developers.png`（1920×1080，202,828 B）。
- 生效方式：刷新 `http://127.0.0.1:8000` 即可，无需重启后端。
