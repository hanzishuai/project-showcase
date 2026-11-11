# 项目实践聚合平台（Vue 3 + FastAPI + SQLite）

把原先的单页展示升级为可运行的全栈项目：Vue 3 前端采用「软件学院 · 项目实践聚合平台」深色大屏版式，默认展示五阶段生命周期看板（需求对接 / 数据库设计 / 开发 / 测试 / 上线），可切换数据总览；FastAPI 提供 REST API，SQLite 落库；数据以 `data/projects.json` 为种子，可在线增删改查。

## 目录结构

```
project-showcase/
├─ backend/                 FastAPI 后端
│  ├─ app/
│  │  ├─ main.py            入口：API + 静态托管
│  │  ├─ config.py          配置（环境变量可覆盖）
│  │  ├─ db.py              SQLAlchemy 引擎/会话
│  │  ├─ models.py          项目、源文件、截图、阶段模板、项目阶段
│  │  ├─ schemas.py         Pydantic 出入参
│  │  ├─ seed.py            从 data/projects.json 灌种子
│  │  └─ routers/api.py     REST 路由
│  ├─ tests/                pytest 契约测试（9 条）
│  ├─ data/app.db           SQLite 数据库（首次启动自动生成）
│  └─ requirements.txt
├─ frontend/                Vue 3 + Vite
│  ├─ src/App.vue           直接渲染 KanbanPage
│  ├─ src/views/KanbanPage.vue  数据总览 + 生命周期看板双视图
│  ├─ src/kanban/data.ts    看板数据（9 个演示项目 / 19 个版本）
│  ├─ src/kanban.css        深色看板样式（1920×1080 等比缩放）
│  ├─ src/views/            旧 DashboardView / ProjectDetailView 保留未挂入口
│  ├─ src/components/       旧顶栏、在做项目卡、已做项目卡（保留未挂入口）
│  └─ src/api.ts            API 客户端（旧页面使用，看板当前为本地演示数据）
├─ data/projects.json       唯一数据源（种子）
├─ start.ps1 / start.cmd    一键启动
└─ dev.ps1                  开发模式（Vite 热更新）
```

## 一键启动

双击 `start.cmd`（或运行 `powershell -ExecutionPolicy Bypass -File start.ps1`）：

1. 首次会自动 `uv venv` + 安装后端依赖；
2. 首次会自动 `npm install` + `npm run build`；
3. 启动 `http://127.0.0.1:8000`，浏览器自动打开；API 文档在 `/docs`。

> 需要本机有 `uv` 与 `npm`。前端构建完成后由后端直接托管，离线可用，无 CDN。

## 页面

- `http://127.0.0.1:8000/`：默认「生命周期看板」，五个阶段列展示当前版本卡；点卡片打开右侧详情抽屉。
- 顶部「数据修改」：进入 `#/edit` 数据编辑页，可改阶段名称与颜色、项目信息、成员、用户数、功能数、技术栈、项目图片和版本列表；保存后写浏览器 localStorage 并立即回看板。
- 顶部「数据总览」：5 个 KPI + 阶段分布柱状图 / 阶段占比环图 / 近 8 周趋势 / 技术栈分布 / 近期风险版本。
- 抽屉内含生命周期进度、版本信息、版本历史、近 4 周提交次数与「项目图片」。
- 看板顶部的项目筛选、负责人筛选、显示历史版本开关均可交互。

> 当前看板使用 `frontend/src/kanban/data.ts` 的本地演示数据（9 个项目、19 个版本）；真实项目与成员名单替换该文件即可。数据修改页保存的内容优先存于浏览器 localStorage，换浏览器或清理站点数据会回到默认演示值。

## 2026-11-10 深色生命周期看板（最新）

按机主参考稿「软件学院项目实践聚合平台(1).html」复刻，并执行批注：删除「部署」阶段列、把「已投产」改为「上线」、详情抽屉底部增加多张「项目图片」并支持点击放大；看板左侧预留 600px 空白区，供后续接入宠物小人。

- 入口：`frontend/src/App.vue` 按 hash 渲染 `KanbanPage.vue`（`#/`）或 `DataEditPage.vue`（`#/edit`）；样式在 `frontend/src/kanban.css`；演示数据在 `frontend/src/kanban/data.ts`。
- 舞台：固定 1920×1080，按 `min(innerWidth/1920, innerHeight/1080)` 等比缩放；深色 token（`#0B0F19` / `#121826` / `#E6EDF7`）与参考稿一致。
- 生命周期看板：5 列（需求对接 / 数据库设计 / 开发 / 测试 / 上线），9 张当前版本卡；顶部统计 19 / 12 / 7；卡片底部显示指导老师与开发成员（不再显示已停留天数），超期风险指标已移除；筛选与历史版本开关可用。
- 数据总览：5 个 KPI + 5 个图表区（阶段分布、阶段占比、近 8 周趋势、技术栈、近期风险）。
- 详情抽屉：宽 480px，含生命周期进度、版本信息、版本历史、项目图片；项目图片为 2×2 四张缩略图（`/media/<filename>`），点击任意一张打开大图灯箱，支持前后切换与 Esc 关闭。
- 仅当前版本处于「上线」阶段的项目，抽屉显示「项目使用情况」：累计用户、上线功能两枚数据卡（大数字，无进度条与百分比）；开发中项目即使历史版本上过线，也只显示「近 4 周提交次数」柱状图。当前用户数/功能数为演示数据，真实值改 `frontend/src/kanban/data.ts` 的 `users` / `features`。
- 字段命名：「负责人」统一改为「指导老师」，覆盖版本卡、详情抽屉「版本信息」与筛选下拉「全部指导老师」。
- 抽屉「版本信息」已删除「仓库链接 / 查看项目仓库」入口，只保留指导老师、团队成员、技术栈、开始日期、预计交付。
- 布局留白：看板左侧固定 `600px` 空白区（`.pet-stage`），不渲染宠物内容；`pointer-events: none`，后续可直接把宠物层挂到该区域。
- 数据修改页：`frontend/src/views/DataEditPage.vue` 固定 1920×1080，主区可滚动；阶段设置 5 组名称+颜色，9 个项目卡可编辑指导老师/团队/用户数/功能数/技术栈/图片，版本可增删改；支持恢复默认、返回看板、保存并查看看板。项目图片改为文件上传：支持多选与拖拽，上传后自动压缩为最长边 1400px 的 JPEG，即时显示缩略图并可单张删除，保存后写入浏览器 localStorage。
- 持久化：`frontend/src/kanban/data.ts` 提供 `loadKanbanData` / `saveKanbanData` / `resetKanbanData`，保存写浏览器 localStorage；无存储时回退默认 9 项目 / 19 版本。
- 验收：`npm run build` 571 modules 退出 0（CSS 19.44 kB、JS 1,141.58 kB）；`node _temp/2026-11-10-kanban-check.mjs` 28/28（含已上线项目 2 枚使用数据卡、页面无 `.usage-track` / `.usage-fill`、卡片文本无百分比）；`node _temp/2026-11-10-data-editor-check.mjs` 16/16（含图片上传：上传后缩略图由 4 增至 5、`data:image/jpeg` 可读、保存后 localStorage 含 data URL）；无 pageerror / console error；1920 与 1366 均无横向溢出；4 张项目图片全部加载；灯箱 caption `1 / 4`；Esc 关灯箱但保留抽屉；左侧 600px 且 0 子元素；指导老师文案无「负责人」残留；数据修改页阶段设置 5 项可见、修改项目名与版本天数保存后看板同步。
- 截图：`previews/2026-11-10-kanban-board.png`、`-drawer.png`、`-lightbox.png`、`-overview.png`、`-1366.png`、`previews/2026-11-10-data-editor.png`、`previews/2026-11-10-data-editor-upload.png`、`previews/2026-11-10-data-editor-applied.png`。
- 验收证据：`_temp/2026-11-10-kanban-check.json`、`_temp/2026-11-10-data-editor-check.json`。

## 2026-11-10 UI 改造

- P0 诚实性：status 缺失显示 `—`；阶段为 0 时显示 `0 / 18` 与 `0 / 6`；任何地方不出现 `0%`；卡片资料计数与详情一致。
- P1 视觉：三色语义（青蓝 `#2ad6ff` 表示有资料/正常、琥珀 `#ff9f45` 表示缺口、灰蓝 `#5d7595` 表示占位/未知）；项目卡减密并补充 DOCX/源文件/截图计数；详情页改为 `260px` 档案栏 + 内容 + `360px` 截图证据三栏；六段阶段节点流；灯箱支持上一张/下一张与 `1 / N` 计数器。
- 验收：`_temp/2026-11-10-ui-polish-verify.json` 22/22、`_temp/2026-11-10-route-verify.json` 25/25、`npm run build` 39 modules、后端 `pytest` 9 passed、旧静态页 `node --test` 15/15。
- 2026-11-10 后续按 EditHere 批注把总览页双图表改为「软件生命周期环节」面板（六段 × 3 个项目维护状态），右侧环形图删除；证据见 `_temp/2026-11-10-lifecycle-verify.json`。

## REST API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/meta` | 平台元信息、资料统计、六段阶段框架 |
| GET | `/api/projects` | 项目列表（含 docx/截图计数） |
| GET | `/api/projects/{id}` | 项目详情（源文件、截图、六段阶段） |
| POST | `/api/projects` | 新建项目 |
| PATCH | `/api/projects/{id}` | 修改项目 |
| DELETE | `/api/projects/{id}` | 删除项目 |
| PUT | `/api/projects/{id}/stages/{seq}` | 更新某段阶段状态（missing/active/done） |
| GET | `/api/stats` | 汇总统计 |

## 数据库

默认 SQLite：`backend/data/app.db`（首次启动 `create_all` + 种子灌入，已有数据不覆盖）。
换库只需设环境变量 `DATABASE_URL`，例如 `postgresql+psycopg://user:pass@localhost:5432/showcase`。

表：`projects` / `source_files` / `screenshots` / `stage_templates` / `project_stages`。

## 测试

```powershell
cd backend
.venv\Scripts\python.exe -m pytest -q
```

覆盖：种子数据 3 项目 / 3 docx / 7 截图、六段阶段、404、CRUD 往返、阶段更新与越界、统计、禁止写死百分比、媒体文件可访问。

## 数据口径

- 缺失值一律显示 `—`，不写死百分比，不编造进度；
- 截图里的业务计数（如 20 条成果、379 个申报人）是演示业务数据，不是开发进度；
- 三份 DOCX 均未提供结构化阶段，所以六段阶段全部为「文档未提供」。

## 交付报告

- `docs/2026-11-10-fullstack-delivery.md`：改动清单、启动方式、验收证据、诚实清单与回退。