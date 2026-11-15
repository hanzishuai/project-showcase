# Doublecheck spec — 详情页 1250px 双栏改造

记录时间：2026-11-15 · 会话：`lead` · 工作区：`C:\Users\31598\Desktop\AIArea\DSHWork\project-showcase`

> 本文件是 `doublecheck_spec` 会话规格的落盘副本（工具只记录到会话、不写盘，故手工同步）。

## Goal
把项目版本详情抽屉改成宽 1250px、内部左右两栏同页铺开：5 个板块全部在一页内可见、不需要下滑，左侧数字人/AI 助手与看板其余部分保持不动；并对此做完整仔细的测试与如实验收。

## Scope
最终交付改动：`frontend/src/views/KanbanPage.vue`（5 个 section 包进 2 个 `.drawer-col`）、`frontend/src/kanban.css`（末尾两个追加块：`--detail-scale:1.5` 同比放大 + `--detail-width:1250px` 两栏 grid）、`README.md:162`（文档同步）、重建 `frontend/dist/**`。测试与验收产物：`docs/2026-11-15-drawer-2col-test-report.md`、`_temp/2026-11-15-drawer-2col-regression.mjs`、`.json` 与 5 张 PNG。用户已允许改 Vue 模板（弹窗「允许改 Vue 模板，做更精细的分区」）。约束：`.drawer-body` 基础规则仍为 `overflow-y:auto;flex:1`，靠内容同页放下而非强制隐藏滚动条；`.mask`/`.lightbox` 是 `</aside>` 外的兄弟节点，不参与缩放。

## Acceptance criteria
1) `npm run build` EXIT 0（已实测：1244 modules，CSS 466.56 kB，JS 2,163.00 kB）。
2) 1920×1080 下 `getComputedStyle('.drawer').width === '1250px'`、`--detail-width === '1250px'`、`--detail-scale === '1.5'`。
3) `.drawer-body` 为两栏 grid，两个 `.drawer-col` 分得 [3,2] 个 section，5 个板块标题逐字为 `['生命周期进度','版本信息','版本历史','近 4 周提交次数','项目图片4 张']`（live 分支第 4 个为「项目使用情况 当前上线版本」）。
4) `bodyScrollHeight === bodyClientHeight`（无纵向滚动）、`sectionsBelowFold === 0`、`docScrollWidth === innerWidth`（无横向溢出）。
5) 交互不退化：幻灯片右/左箭头、圆点、灯箱、Esc、遮罩关闭、Enter 打开；live 分支 usage 卡片无溢出。
6) 不破坏既有：`cardBadgeFont '12px'`、`cardWidth 197`、`maskZ '10'`、`maskBg rgba(0,0,0,0.5)`、`petStageWidth 600`、`.lightbox` 在 `</aside>` 之外。
7) 1366×768 下 1920 舞台整体缩放 0.7111，抽屉仍 1250px 双栏且不溢出。
8) 回归必须含「必失败反例」：撤掉两栏修复后同一组断言必须 FAIL 且差异集合非空，恢复后必须全绿。
9) 项目自带测试：`npm run test:agent:tts` 8/8；后端 pytest 在带 dummy env 时 13 passed。
10) 所有结果落盘可复核并如实披露未跑项。

## Failure modes
- 裸环境 `pytest -q` 出现 `tests/test_security.py:24: AssertionError` / `E       assert ([])`：根因是 `backend/app/settings_api.py` 的 secret 字段依赖 `LLM_API_KEY`/`DASHSCOPE_API_KEY`，本机未配置；按用户决定「只如实报告，不改它」，不改测试、不弱化断言，带前置条件重跑得到 13 passed。
- `test:agent` / `test:agent:ui` / `test:agent:voice` 需要有效 LLM/TTS/embedding 凭据：起真后端 8011 有界探测，`/api/ready` 200 但 `/api/v1/agent/ask` 返回 SSE `event: error` / 「操作助手暂时不可用，请稍后再试。」，日志为 DeepSeek 401 / DashScope 401 / TTS InvalidApiKey / hf-mirror 离线；如实记录不可跑原因，不硬跑、不伪造通过。
- 反例注入若未让断言变红 ⇒ 判测试无效，需修正断言而非放过。
- 构建失败或截图服务起不来 ⇒ 停止并报告完整错误，不宣称完成。
- 纵向滚动重新出现 ⇒ 收紧两栏间距/字号，重测全部门禁。

## Priorities
1) 不破坏现有页面与既有交互（`.version-card`、`.mask`、灯箱、看板卡片计算样式不变）。
2) 「都展示在一页上，不要下滑」是硬指标，优先于视觉精致度。
3) 高内聚低耦合：单一 `--detail-width` + 单一 `--detail-scale` 旋钮，新增选择器全部 `.drawer` 前缀，Vue 模板只加包装容器。
4) 测试证据可复核、必失败反例能证伪、未跑项如实披露。
5) 最快让用户看到效果。

## Non-goals
- 不动效（用户明确「动效另开一轮，这次先不做」）。
- 不改 `frontend/src/kanban/data.ts`、构建配置、`.mask`、`.lightbox`、数字人/AI 助手、独立详情页 `ProjectDetailView.vue` / `frontend/src/styles.css:362-412`、1920×1080 舞台缩放逻辑。
- 不新增依赖 / 预处理器 / CSS `zoom`；不改图片内容。
- 不弱化或删除既有测试来换绿；不伪造 agent 套件通过。
- 不再缩小抽屉或恢复单栏。
