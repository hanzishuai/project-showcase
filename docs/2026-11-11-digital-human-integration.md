> **注意：本文记录的是第一版做法（浏览器内本地问答），已被 `docs/2026-11-11-backend-port-and-admin.md` 取代。**
> 现状：问答、ASR、TTS 均由移植进来的 `backend/pp7rag` 提供，页面不再使用浏览器内本地回答。

# 2026-11-11 数字人接入（看板左侧 600px 留白区）

## 结论

看板左侧原本留给「宠物小人」的 600px 空位，现在接入 PP7 的可嵌入数字人组件：
**上半部分是人物立绘（半身），下半部分是对话面板**，打开页面即可直接提问。
问答默认走**浏览器内本地数据**，不依赖 PP7 的 RAG 后端、不依赖 MySQL/Redis，也不发任何网络请求。

## 接入的是什么

| 项 | 值 |
|---|---|
| 组件 | `@pp7/rag-avatar` 0.4.0（PP7「可嵌入 Vue 的 RAG 数字人」，本地仓库 `pp7/packages/rag-avatar`） |
| 形态 | 静态立绘（内置 webp 讲解员，1024×1536）+ 程序化动画（呼吸 / 摇摆 / 说话振幅 / 倾听 / 思考）+ 聊天面板 |
| 位置 | `frontend/vendor/rag-avatar/`（构建产物副本，见同目录 `PROVENANCE.md`） |
| 挂载点 | `frontend/src/views/KanbanPage.vue` 的 `.pet-stage` |

## 改了哪些文件

| 文件 | 改动 |
|---|---|
| `frontend/vendor/rag-avatar/rag-avatar.js`、`style.css` | 新增：组件构建产物（含 1 处本地补丁） |
| `frontend/vendor/rag-avatar/PROVENANCE.md` | 新增：来源、版本、补丁说明 |
| `frontend/src/kanban/localRag.ts` | 新增：浏览器内本地问答（实现 SDK 的后端契约） |
| `frontend/src/views/KanbanPage.vue` | `.pet-stage` 内挂载 `<RagAvatar>`，传 `:fetch` + 文案 |
| `frontend/src/main.ts` | 引入组件样式（在 `kanban.css` 之前，便于覆盖主题变量） |
| `frontend/src/kanban.css` | `.pet-stage` 改为定位宿主；组件铺满 600px；半身裁切；主题色对齐看板 token |

## 工作方式

`@pp7/rag-avatar` 支持注入自定义 `fetch`（`RagAvatarConfig.fetch`），
于是本地问答直接复用组件的完整链路（流式 token、状态机、推荐问题、打断、清空），只把网络层换成本地实现：

| 接口 | 本地行为 |
|---|---|
| `GET /api/v1/rag/health` | 返回本地能力标记（llm=true，tts/asr/chroma=false） |
| `GET /api/v1/rag/suggestions?limit=3` | 从看板数据生成 3 条推荐问题 |
| `POST /api/v1/rag/ask` | 生成回答后用 SSE `meta → token… → done` 逐字推流（每片 2–4 字、16–34ms） |
| `POST /api/v1/rag/feedback` | 返回 ok，不落库 |

回答完全来自 `frontend/src/kanban/data.ts` 的看板数据（9 个项目 / 19 个版本 / 5 个阶段），
支持：项目进展、阶段分布、上线项目、指导老师、技术栈、停留最久的版本、整体统计。
没有接大模型，**不是 RAG 检索**，回答是规则匹配 + 数据拼装，不会编造数据里没有的字段。

## 验收证据（本机实测，2026-11-11）

- `npm run build`：574 modules，退出 0；CSS 19.49 → 45.42 kB，JS 1,140.84 → 1,303.46 kB。
- Chrome（headless，1920×1080，CDP 驱动）实测：
  - 页面无 `pageerror`、无 `console.error`；
  - 立绘 `img` 加载成功（`data:image/webp`，natural 1024×1536），`.pet-stage` = 600×864（未缩放口径）；
  - 3 条推荐问题渲染，输入框存在，9 张版本卡不受影响；
  - 点「平台现在有多少个项目？」→ 用户气泡显示问题，回答流式输出（0.4s 47 字 → 0.8s 91 字 → 1.2s 131 字完成，状态回到「就绪」），内容为「9 个项目、19 个版本、阶段分布 1/1/3/3/1」，与看板列头计数一致；
  - 手输「实验室预约系统做到哪一步了？」→ 正确回答 v1.2 / 开发阶段 / 19 天 / 张三 / Vue 3 / Spring Boot / MySQL；
  - 点版本卡开抽屉：抽屉 z-index 11 > 组件 2，抽屉可正常点击与滚动。
- 截图：`previews/2026-11-11-digital-human-board.png`、`-chat.png`、`-drawer.png`。

## 已发现并修复的上游 bug

`@pp7/rag-avatar` 0.4.0 的 `ChatPanel` 在 `richNodesByMessage` 里只给 `role === 'assistant'` 的消息生成富文本节点，
导致**用户提问气泡渲染为空白**。已在 vendored 副本里打补丁（详见 `PROVENANCE.md`），
建议同步修上游 `packages/rag-avatar/src/components/ChatPanel.vue` 第 253 行。

## 如何切换到真实 PP7 RAG 后端

1. 起 PP7 后端（默认 8000，与本项目冲突时用 8010）；
2. 把 `KanbanPage.vue` 里 `<RagAvatar>` 的 `:fetch="ragFetch"` 去掉，改为 `:api-base-url="'http://127.0.0.1:8010'"`；
3. 需要语音时把 `:enable-voice` / `:auto-speak` 打开。

## 诚实清单

- **没有**接 PP7 的 RAG/大模型/TTS/ASR：本机 PP7 后端的 `.venv` 是空的、`data/models` 无嵌入模型缓存，
  拉起真实后端需要装 torch/chromadb 并下载模型，本次未做。
- **没有**实现语音输入与播报（面板麦克风按钮已隐藏）；本地模式下 `/asr`、`/tts` 返回 501。
- 回答是规则匹配，问法与数据字段不相关时会回退到整体概览，不会瞎编。
- 组件是静态立绘 + CSS 动画，不是 Live2D（PP7 的 Live2D 资源在桌面客户端 `frontend/desktop/nw/`，SDK 预留了 `AvatarRenderer` 接口但未接入）。
