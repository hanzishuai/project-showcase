# 详情页 1250px 双栏改造 — 测试与验收报告

日期：2026-11-15 · 工作区：`project-showcase` · 分支：`main`
用户指令（m00534）：「ok，测试吧，这次仔细点」（此前「不要测试」的豁免已作废）。

## 1. 本次改动范围（只 3 个源文件）

| 文件 | 改动 |
|---|---|
| `frontend/src/views/KanbanPage.vue` | 抽屉内 5 个 `<section>` 装进 2 个 `.drawer-col`：左 3（生命周期进度 / 版本信息 / 版本历史），右 2（近 4 周提交次数 或 项目使用情况 / 项目图片）。绑定与事件未改 |
| `frontend/src/kanban.css` | 末尾追加两块：①`--detail-scale:1.5` 的同比放大；②`--detail-width:1250px` + `.drawer-body` 两栏 grid。所有新增选择器均以 `.drawer` 前缀限定 |
| `README.md:162` | 文档同步为 1250px 双栏 |

构建产物：`frontend/dist/assets/index-DRySUZ56.css`（466.56 kB）、`index-BNKG8p76.js`（2,163.00 kB）。

## 2. 测试矩阵（逐项如实记录）

| # | 测试 | 命令 / 前置 | 结果 |
|---|---|---|---|
| 1 | 前端构建 | `npm run build`（cwd `frontend`） | **EXIT 0**，vite v6.4.6，1244 modules，7.70s；仅既有 `chunks > 500 kB` 警告 |
| 2 | 纯单元：TTS 断句 | `npm run test:agent:tts` → `node ../scripts/tts-segment-selftest.mjs`，无需服务 | **通过 8 / 8** EXIT 0（短回答整句 / 多句按句切 / 不切词中 / 长清单 / 标点断句 / 超长无标点兜底≤120 / 每段完整断句 / 无 2 字碎片） |
| 3 | 后端 pytest（带前置） | `pytest -v`，先设 `$env:LLM_API_KEY` / `$env:DASHSCOPE_API_KEY` 为 dummy 值 | **13 passed, 3 warnings in 3.17s** EXIT 0（`test_api.py` 9 + `test_security.py` 4） |
| 4 | 后端 pytest（裸环境） | `pytest -q`，不设任何 env | **12 passed / 1 failed** EXIT 1。精确错误 `tests/test_security.py:24: AssertionError` / `E       assert ([])` / `FAILED tests/test_security.py::test_admin_settings_requires_token_when_enabled` |
| 5 | 两栏 CDP 回归（含必失败反例） | `node _temp/2026-11-15-drawer-2col-regression.mjs`，自有静态服务 8766 + headless Chrome 9424 | **verdict PASS**，7 个 gate 全 true，EXIT 0 |
| 6 | `test:agent` / `test:agent:ui` / `test:agent:voice` | 需 8000 真后端 + 有效 LLM/TTS/embedding 凭据 | **未跑**（有界探测证实必失败，见 §5）；按用户决定「有界探测并记录原因」，不硬跑 |

`frontend/package.json` 没有通用 `test` 脚本；项目自带测试仅上述 4 个 npm 脚本 + 后端 pytest。

## 3. 裸环境那 1 个失败的根因（已实证，非本次回归）

`backend/tests/test_security.py:24` 逐字为 `assert secrets and all(value == "****" for value in secrets)`，要求「至少一个已配置密钥」。`backend/app/settings_api.py:139-152` 的 `_item()` 用 `"configured": bool(value)`；`:40-59` 只有 `llm_api_key`、`dashscope_api_key` 两个 `secret:True` 字段。本机无 `backend/data/settings.json`，两个 env 均未设；`backend/pp7rag/config.py:33` `llm_api_key: str = ""`、`:80` `dashscope_api_key: str = ""` → 两个 secret 都空 → 列表空 → `assert ([])`。401/401/200 三步全过，仅前置不满足。

**用户决定（弹窗）：「只如实报告，不改它」** → 未修改测试、未弱化断言。设 dummy env 后 13/13 通过，证明失败源是环境而非代码；本次改动只涉及 `frontend/src/kanban.css`、`frontend/src/views/KanbanPage.vue`、`README.md`，与后端测试无共享路径。

## 4. 两栏回归：PASS → 必失败反例 → 恢复 PASS

脚本 `_temp/2026-11-15-drawer-2col-regression.mjs`（保留作可复现证据）；证据 `_temp/2026-11-15-drawer-2col-regression.json` + 5 张 PNG（pass / live / counterexample / restored / 1366）。

- **基线 22 断言全 true**：`width1250, detailWidthVar, scaleVar15, twoColumnGrid, sections3and2, fiveSections, expectedTitles, noVerticalScroll, noHorizontalOverflow, noDocHorizontalOverflow, allSectionsOnOnePage, titleNotClipped, galleryVisible, galleryImageLoaded, galleryCounter, dots4, cardBadgeUnchanged, maskUnchanged, lightboxOutsideDrawer, boardUntouched`
- 实测：`drawerWidth "1250px"`、`scaleVar "1.5"`、`gridTemplateColumns "570.5px 570.5px"`、`sectionsPerColumn [3,2]`、`bodyScrollHeight 896 == bodyClientHeight 896`（无纵向滚动）、`sectionsBelowFold 0`、`docScrollWidth 1920 == innerWidth 1920`、`h2Font 42px`、`sectionTitleFont 24px`、`infoGridFont 21px`、`slide 571×321`、图片 `naturalWidth 1920` 已加载、`1 / 4`、4 个圆点
- **交互 9 项全 true**：右箭头 `2 / 4`、左箭头回 `1 / 4`、第 3 圆点 `3 / 4`、灯箱打开且图已加载且位于抽屉外、`Esc` 只关灯箱、遮罩关抽屉、`Enter` 开抽屉、`Esc` 关抽屉
- **live 分支 8 项全 true**（点「学术讲座预约平台」）：走 `项目使用情况`，`usageValueFont "42px"`、`statNoOverflow true`、仍无纵向滚动
- **必失败反例**：注入 `--detail-width:720px !important; .drawer-body{display:block !important}; .drawer-col{display:contents !important}` → 同一组断言必须 FAIL，实测 6 项转 false。`width "720px"`、`bodyScrollHeight 1341 > 896`、`sectionsBelowFold 1`、图片区不在视口内
- **差异集合（非空，证伪「永远绿」）**：`width1250, detailWidthVar, twoColumnGrid, noVerticalScroll, allSectionsOnOnePage, galleryVisible`
- **移除注入后恢复**：`restoredFalses []`、22 项全绿；`passFalses []`
- **1366×768**：`stageTransform "matrix(0.711111, 0, 0, 0.711111, 0, 0)"`、仍是 1250px 双栏、`noVerticalScroll true`、`docScrollWidth 1366 == innerWidth 1366`、6 项全 true
- 7 个 gate：`passAllGreen / interactionsAllGreen / liveAllGreen / counterExampleMustFail / differenceSetNonEmpty / restoredAllGreen / viewport1366AllGreen` 全 true

诚实说明：反例是**运行时注入式撤销**（`!important` 覆盖 CSS），不是把源码文件改回去再重建；它证明的是「这组断言能抓到两栏修复缺失」，Vue 模板的 `.drawer-col` 包裹未在该反例中移除。

## 5. 真后端有界探测（为什么 3 个 agent 套件没跑）

临时起 `uvicorn app.main:app --host 127.0.0.1 --port 8011`（job `pwsh-7b548281155c42f1`，探测后已 kill，8011 已释放）。带 dummy key 的实测：

- `GET /api/ready` → 200 `{"status":"ok","db":true}`
- `GET /api/health` → 200 `{"status":"ok","service":"project-showcase-api"}`
- `GET /api/meta` → 200，返回 `data/projects.json` 元信息
- `POST /api/v1/agent/ask` → 200 但 SSE 为 `event: error` / `{"message":"操作助手暂时不可用，请稍后再试。"}`
- 后端日志：`POST https://api.deepseek.com/chat/completions "HTTP/1.1 401 Authorization Required"`、`Authentication Fails, Your api key: ****test is invalid`；`POST https://dashscope.aliyuncs.com/... "HTTP/1.1 401 Unauthorized"` / `invalid_api_key`；`tts_warmup_failed: HTTP 401 {"code":"InvalidApiKey"...}`；`rag_warmup_encoder_failed: We couldn't connect to 'https://hf-mirror.com' ... BAAI/bge-small-zh-v1.5`、`huggingface_hub.errors.LocalEntryNotFoundError`、`knowledge_index_bootstrap_failed`

结论：真后端本身能起、基础接口正常，但 LLM / TTS / embedding 三个外部依赖全部 401 或离线不可达。`backend/app/agent.py:348-358` `_llm_targets()` 无有效 key 时 → `:376` `RuntimeError("没有可用的 LLM 通道")`；`scripts/agent-selftest.mjs:8`、`scripts/agent-ui-selftest.mjs:13` 都指向 `127.0.0.1:8000`，`agent-ui-selftest.mjs:22` 还硬编码 URL 过滤。故 `test:agent`（~60 用例）、`test:agent:ui`（~28 条）、`test:agent:voice`（ASR）无有效凭据必然失败 —— **按用户决定不硬跑，如实记录原因**。

## 6. 诚实清单 / 未解决项

1. `test:agent`、`test:agent:ui`、`test:agent:voice` 未跑：缺有效 LLM/TTS/embedding 凭据（非代码缺陷）。要跑通需配置真实 `LLM_API_KEY` / `DASHSCOPE_API_KEY` 且能访问 `hf-mirror.com` 下载 `BAAI/bge-small-zh-v1.5`。
2. 裸环境 `pytest -q` 有 1 个失败（`test_security.py:24` 前置缺失），按用户决定不改测试。设 dummy env 后 13/13 通过。
3. 8000 端口当前是**纯静态预览服务**（`_temp/2026-11-15-preview-server.mjs`，后台 job `pwsh-1f2dc239df16467d`），无 `/api`，AI 助手不可用；全功能需 `start.ps1` 起真后端。
4. 工作区在本会话前就已 dirty（17 个 tracked 修改 + 多个 untracked），本会话的改动只有上表 3 个源文件 + 重建的 `frontend/dist`。
5. 动效按用户「动效另开一轮，这次先不做」明确延后。

## 7. 生效方式

`npm run build` 已跑完，`frontend/dist` 已是最新产物。预览服务带 `Cache-Control: no-store`，**刷新 `http://127.0.0.1:8000/` 即生效**，无需重启；用 `start.ps1` 的完整服务同样是刷新页面（index.html 不缓存）。改源码后若用 Vite dev（`npm run dev`）则 HMR 自动生效。
