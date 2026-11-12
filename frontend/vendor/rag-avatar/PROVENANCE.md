# @pp7/rag-avatar 0.4.0（vendored 构建产物）

本目录是 PP7 「可嵌入 Vue 的 RAG 数字人」组件包的构建产物副本，供看板左侧留白区直接使用，
不引入 npm 依赖、不依赖任何后端服务。

| 项 | 值 |
|---|---|
| 来源 | `pp7/packages/rag-avatar`（本地 PP7 仓库）`dist/` |
| 版本 | 0.4.0 |
| 上游构建时间 | 2026-11-11 11:52 |
| vendor 时间 | 2026-11-11 |
| 许可 | MIT（见上游 README） |

## 文件

| 文件 | 说明 |
|---|---|
| `rag-avatar.js` | ESM 组件包（未压缩，约 254 KB），只依赖 `vue` |
| `style.css` | 组件样式（约 29 KB），全部限定在 `.pp7-*` 命名空间，不污染宿主 |

## 本地补丁（相对上游 0.4.0）

1. **修复用户气泡为空**：`ChatPanel` 的 `richNodesByMessage` 只为 `role === 'assistant'` 的消息生成
   富文本节点，用户提问气泡因此渲染成空白。补丁把过滤条件
   `if (message.role !== "assistant" || !message.content) continue;`
   改成 `if (!message.content) continue;`（该行在 `rag-avatar.js` 中唯一，已确认只替换 1 处）。
   > 建议上游同步修：`packages/rag-avatar/src/components/ChatPanel.vue` 第 253 行。

2. **TTS 切句改为整句级**：`extractSpeakableSegments` 原实现第一段强制 10 字切、后续 24 字切、
   逗号/顿号累计 14 字就切，短回答会被切成「这个问题我从资料里没」+「找到能直接操作的入口，…」，
   甚至出现「…一千二百六十名用」+「户；」这种 2 字碎片；每段单独请求 TTS，拼接后语气很怪。
   补丁改为：按 `。！？；` 等句末标点整句切分；只有 ≥110 字的超长句才在逗号/顿号/冒号处断；
   最短 6 字，避免碎片；完全没有标点时最多 120 字兜底（优先切在句中标点，避免切在词中间）。
   配套自测：`scripts/tts-segment-selftest.mjs`。
   > 建议上游把切句阈值做成配置项（minLength / softMin / maxLength）。

## 升级方式

从 PP7 仓库重新构建（`npm run build`）后覆盖本目录两个文件即可；覆盖后需重新应用上面的补丁。
