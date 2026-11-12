# 2026-11-11 PP7 后端移植 + 管理后台集成

## 结论

PP7 的 RAG 数字人后端已经**并进本项目后端（同一个 FastAPI 进程、同一个 8000 端口）**，
数字人的问答、语音识别（ASR）、语音合成（TTS）、知识库管理全部由本站自己的后端提供；
PP7 的管理后台（工作概览 / 对话记录 / 知识库管理）也集成进前端，入口 `#/admin`。

- 数字人：`/api/v1/rag/ask`，真实 RAG（Chroma 检索 + DeepSeek 生成），提问实测 2.2s 出答案。
- 语音：`/api/v1/rag/asr`、`/api/v1/rag/tts`、`/api/v1/rag/tts/stream`，DashScope Qwen3 ASR/TTS。
- 流式：`WS /api/v1/rag/stream`（token + PCM 单连接）与 `WS /api/v1/rag/asr/stream`（边说边识别）。
- 管理后台：`#/admin`，数据来自 `/api/admin/*`（映射到 SQLite 问答日志，不引入 MySQL）。

## 移植了哪些东西

源：`E:\zm\pp\pp7\backend\app`（PP7）。目标：`backend/pp7rag/`。

| 内容 | 文件 |
|---|---|
| 配置 | `pp7rag/config.py`（pydantic-settings，读 `backend/.env`） |
| 日志 | `pp7rag/logging_setup.py` |
| 检索 | `pp7rag/engine/{retriever,keyword_index,prompts}.py` |
| 知识库 | `pp7rag/knowledge/{loader,indexer,revision}.py` |
| RAG API | `pp7rag/ragapi/**`（orchestrator / service / providers / segmenter / qa_log / suggestions / knowledge_import / routes） |

共 26 个 .py 文件。移植时只做了一件事：把 `from app.xxx` 批量改成 `from pp7rag.xxx`（16 个文件有改动），
逻辑一行没改。

数据：

| 数据 | 位置 | 说明 |
|---|---|---|
| 知识库文档 | `backend/data/docs/产教融合服务平台.md` | 来源文档（1.6 KB，7 个 chunk） |
| 向量库 | `backend/data/chroma_storage/` | 已 gitignore，可用后台「重建索引」重建 |
| 问答日志 | `backend/data/qa_log.sqlite3` | 已 gitignore，管理后台的数据源 |

> PP7 自带的那份 `chroma.sqlite3` 是更新版 chromadb 写的，0.5.23 读不了（`KeyError: '_type'`），
> 所以按文档重建了索引（7 个 chunk），原文件仍在 PP7 仓库里未动。

## 依赖

装进 `backend/.venv`（阿里云 PyPI 镜像）：

| 包 | 版本 | 备注 |
|---|---|---|
| torch | 2.15.0+cpu | CPU 版，126 MB；**必须**用 CPU 源/镜像，否则会拉 CUDA 版 |
| chromadb | 0.5.23 | 锁版本以匹配 PP7 |
| chroma-hnswlib | 0.7.6 | 无 cp312 轮子，本机用 MSVC Build Tools 源码编译通过 |
| sentence-transformers | 3.3.1 | 嵌入模型 `BAAI/bge-small-zh-v1.5` |
| aiohttp / jieba / structlog / pydantic-settings / python-docx / pypdf / python-multipart | 最新 | RAG 与语音的运行时依赖 |

嵌入模型通过 `HF_ENDPOINT=https://hf-mirror.com` 下载（HuggingFace 直连在本机不通）。

## 配置（backend/.env，已 gitignore）

```ini
DASHSCOPE_API_KEY=...        # TTS / ASR（百炼）
LLM_API_KEY=...              # DeepSeek
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-flash
TTS_MODEL=qwen3-tts-flash
TTS_VOICE=Cherry
ASR_MODEL=qwen3-asr-flash-realtime
RAG_ASSISTANT_NAME=软件学院项目实践聚合平台助手
HF_ENDPOINT=https://hf-mirror.com
```

未配置密钥时：`/health` 会返回 `tts/asr/llm = false`，前端不显示语音入口，文字问答仍可用。

## 管理后台

- 前端：`frontend/src/admin/`（`AdminPage.vue` + `AdminShell.vue` + 3 个页面 + `admin.css`）。
  PP7 的管理后台用 vue-router `createWebHistory('/admin')`，与本项目的 hash 路由冲突，
  这里改成**受控页签**（`AdminShell` 的 `active` + `<component :is>`），去掉 router-link / router-view。
- 样式：PP7 的全局样式（`.toolbar` / `.surface` 等）与看板冲突，全部限定到 `.admin-root` 下。
- 依赖：`@arco-design/web-vue`（+ 其 CSS），没有用 pinia（PP7 里其实没用到）。
- 后端：`backend/app/admin_compat.py` 提供 `/api/admin/stats|sessions|sessions/{id}/messages|sessions/search`，
  从 `qa_log.sqlite3` 聚合（PP7 原来是 MySQL），字段结构与前端一致。
- 入口：看板右上角「管理后台」，后台左上角「返回看板」。

## 验收（2026-11-11 本机实测）

后端（httpx 直连）：

| 检查 | 结果 |
|---|---|
| `GET /api/v1/rag/health` | `{"status":"ok","llm":true,"chroma":true,"asr":true,"tts":true,"hybrid":true,"qa_log":true}` |
| `GET /api/v1/rag/suggestions?limit=3` | 返回 3 条由知识库生成的问题 |
| `POST /api/v1/rag/ask` | 200 / text/event-stream，事件 `meta → sources → token… → done`，60 个 token / 107 字 / 2.2s，`timings_ms.retrieval≈1303` |
| `POST /api/v1/rag/tts` | 200，149,804 B WAV（24 kHz 单声道 16 bit），0.9s |
| `POST /api/v1/rag/asr` | 200，把 TTS 合成的 16 kHz WAV 识别回文本 |
| `GET /api/admin/stats` | `total_sessions/total_turns/total_documents/recent_sessions` 正常 |
| `GET /api/v1/rag/knowledge/documents` | 1 篇文档 |

浏览器（Chrome headless + CDP）：

- 看板：9 张版本卡正常，数字人推荐问题来自真实后端，麦克风按钮出现；
- 文字提问「这个平台是干什么的？」→ 真实 RAG 答案 + 来源卡片（命中片段与匹配度）；
- 语音：用 `--use-file-for-fake-audio-capture` 喂一段合成语音 → 录音条显示流式 partial（「识别中：你好，我是项目实践。」）→ 自动转写 → 触发提问 → 自动播报（状态「正在播报…」）；
- 管理后台：`#/admin` 渲染出侧边栏、统计卡（2 个会话 / 1 篇文档）与最近会话表格，数据与 SQLite 日志一致。

截图：`previews/2026-11-11-rag-board.png`、`-admin.png`、`-voice.png`。

## 诚实清单 / 已知限制

- 知识库只有一篇《产教融合服务平台.md》，所以数字人的回答范围就是这篇文档；换成看板 9 个项目的数据需要往知识库里加文档（后台「知识库管理」可上传 docx/pdf/md）。
- 嵌入模型首次加载约需数秒（已缓存到本机 HF 缓存），冷启动第一条问答会慢一些。
- 管理后台**没有登录鉴权**（PP7 原设计即如此：身份由宿主系统负责）。本项目在本机 127.0.0.1 运行；如果要对外暴露，必须先加鉴权。
- 会话的「用户」列显示 `-`：本项目没有用户体系，日志里只有 session_id。
- `chroma_storage` 与 `qa_log.sqlite3` 不入库；换机器重新部署时需要重建索引（或提交这两份数据）。
- PP7 的主应用（MySQL/Redis/WS 网关/Omni 实时）没有移植，本项目的语音与问答走的是 `ragapi` 这套精简链路。

## 2026-11-12 追加：参考资料改成一行「来源：文档名」

反馈：组件默认的参考资料卡片（标题 + 匹配度 + 命中片段 + 展开原文）太抢眼。

改法（展示层，不影响回答质量）：

1. 后端 `pp7rag/ragapi/retrieval.py` 的 `build_sources` 按文档标题去重：同一篇文档的多个检索分块合并成一条来源，
   引用编号重新连续编号。提示词用的是原始 `documents`，不经过 `sources`，所以检索与生成完全不受影响。
2. 前端 `kanban.css` 把 `.pp7-chat-sources` 压成一行淡色小字：`::before` 加「来源：」前缀，
   隐藏 caption / 匹配度 / 摘要 / 展开原文 / 收起原文 / 全文，卡片去掉背景与边框，多个文档横向排列。

验收：同一个问题原来出 2 张卡片（都指向《产教融合服务平台》），现在只剩一行 116×15 px 的「来源：产教融合服务平台」，
摘要与「展开原文」均为 `display:none`，无控制台报错。截图 `previews/2026-11-12-compact-sources.png`。
