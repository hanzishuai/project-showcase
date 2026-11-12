# 2026-11-12 实验：能操控系统的数字人 Agent

分支：`feat/agent-ui-control`（实验性，不影响 main）

## 结论

**能做到。** 数字人现在可以听懂「打开/切到/筛选/看看某个项目」这类话，自己操作界面：
切页面、切看板视图、设筛选、开详情抽屉、开图片灯箱、切后台页签。
一句话链路：**LLM function calling → SSE action 事件 → 前端动作总线 → 页面处理函数**。

实测 4 个指令全部生效（见下方「验收」）。

## 架构

```
用户说话
  ↓
<RagAvatar>（数字人组件，stream-mode=sse）
  ↓ 自定义 fetch（src/agent/fetch.ts）
POST /api/v1/agent/ask  ← 带上当前界面状态 ui
  ↓
后端 app/agent.py
  ├─ 检索参考资料（事实类问题用）
  ├─ 调 DeepSeek（tools + tool_choice=auto）
  └─ SSE：meta → action…（白名单动作）→ token…（话术）→ done
  ↓
fetch 把响应流 tee 成两路
  ├─ 一路原样给组件做流式显示（SDK 忽略未知的 action 事件）
  └─ 一路自己解析 → dispatchAction()
       ↓
   动作总线（src/agent/bus.ts）：按工具名找处理函数，找不到就排队重试 3 秒
       ↓
   App.vue（navigate_page / open_admin_tab）
   KanbanPage.vue（set_board_view / filter_board / open_project / close_drawer / open_gallery / close_gallery）
   AdminPage.vue（跟随 uiState.adminTab）
```

## 动作白名单（8 个，全部只读；不执行任何写操作）

| 动作 | 作用 |
|---|---|
| `navigate_page(page)` | board / edit / admin |
| `set_board_view(view)` | board / overview |
| `filter_board(project?, advisor?, show_history?)` | 看板筛选 |
| `open_project(project, version?)` | 打开详情抽屉（按项目名，带模糊匹配） |
| `close_drawer()` | 关抽屉 |
| `open_gallery(index?)` | 打开图片灯箱 |
| `close_gallery()` | 关灯箱 |
| `open_admin_tab(tab)` | dashboard / conversations / knowledge（自带跳转，不叠加 navigate_page） |

模型同时拿到一份**系统地图**（`SYSTEM_MAP`：每个页面有什么、能做什么），所以它既知道去哪，也知道去了之后讲什么。

## 改了哪些文件

| 文件 | 内容 |
|---|---|
| `backend/app/agent.py`（新） | 系统地图、工具定义、`/api/v1/agent/ask` SSE 端点、`/api/v1/agent/map` 自检端点、LLM 重试 |
| `backend/app/main.py` | 挂载 agent 路由 |
| `frontend/src/agent/bus.ts`（新） | 动作总线：注册/分发/排队重试 |
| `frontend/src/agent/uiState.ts`（新） | 当前界面状态（页面/视图/筛选/打开的项目/后台页签） |
| `frontend/src/agent/fetch.ts`（新） | 自定义 fetch：改写 /ask → /agent/ask，tee 响应流并执行 action |
| `frontend/src/App.vue` | 注册 navigate_page / open_admin_tab；同步 uiState.page |
| `frontend/src/views/KanbanPage.vue` | 注册 6 个看板动作；同步看板状态；`:fetch` + `stream-mode="sse"` |
| `frontend/src/admin/AdminPage.vue` | 页签与 uiState.adminTab 双向同步 |

## 验收（Chrome headless + CDP 实测）

| 指令 | 结果 |
|---|---|
| 把看板切到数据总览 | `main.overview` 可见、`main.board-view` 隐藏 |
| 切回生命周期看板，只看张三指导的项目 | 视图切回 board，指导老师筛选=张三，卡片 9 → 1 |
| 打开实验室预约系统的详情 | 右侧抽屉 `drawer.open` |
| 打开管理后台的知识库页面 | `location.hash=#/admin`，左侧页签高亮「知识库管理」 |
| 平台现在正式上线了吗 | 无动作，走资料回答（不误触发） |

网络证据：这些轮次的问答请求是 `POST /api/v1/agent/ask`，播放走 `POST /api/v1/rag/tts/stream`；
无 `pageerror` / `console.error`。截图 `previews/2026-11-12-agent-admin.png`。

## 踩过的坑

1. **组件默认优先 WebSocket**（`streamMode: auto`），而自定义 fetch 只拦 HTTP —— 请求直接走 WS，
   包装完全失效（表现：数字人答「我不能切换页面」）。改成 `stream-mode="sse"` 后正常。
   > 如果以后要用回 WS 单连接流，需要在 WS 层也加 action 通道。
2. **工具语义要写清楚**：「打开后台知识库页面」最初只触发了 `navigate_page(admin)`，落在工作概览。
   把 `open_admin_tab` 描述成「已包含进入后台，不要叠加 navigate_page」后才稳定。
3. **模型偶发空返回**：单次调用大约 1/10 概率返回空 content，已加一次重试 + 兜底话术。

## 2026-11-12 追加：数字人改成全局浮层（跨页面常驻）

原来组件挂在 `KanbanPage` 的 `.pet-stage` 里，一跳去编辑页/后台就卸载，对话中断。
现已抽成 `frontend/src/components/AgentDock.vue`，由 `App.vue` 在所有路由外层常驻：

- **看板页**：实时量取 `.pet-stage` 的 `getBoundingClientRect()`，用 `translate + scale` 精确贴合
  （与页面 1920×1080 等比缩放同一系数），视觉和改造前完全一致；
- **数据修改 / 管理后台**：自动缩成右下角 380×620 浮层，继续可对话、可下指令；
- **全屏灯箱**：`uiState.modalOpen` 为真时隐藏，避免压在遮罩上；
- `.pet-stage` 保留为 600px 布局占位，看板排版不变。

实测（Chrome headless + CDP）：

| 步骤 | 结果 |
|---|---|
| 打开看板 | 浮层 rect = 留白区 rect（105,167,546,786），完全重合 |
| 「打开管理后台的知识库页面」 | 跳到 #/admin，浮层变 380×620 停在 (1494,338)，页签=知识库管理 |
| 「切换到对话记录」（已在后台） | 页签切成对话记录，说明浮层未卸载 |
| 「返回到看板」 | 回到 #/，浮层重新贴合留白区；对话历史保留 |

截图：`previews/2026-11-12-agent-dock.png`。

## 2026-11-12 追加：真实数据上下文 + 失败反馈 + 带确认的写操作

### 1. 让模型知道「真实存在什么」

原来模型只知道系统地图，不知道看板上有哪些项目，容易编名字。现在前端每轮把 `uiState.projects`
（9 个看板项目名）放进请求的 `ui` 字段，后端拼进「当前界面」上下文。

实测：

- 「打开一个不存在的项目：火星基地管理系统」→ **不动作**，回答「看板上没有「火星基地管理系统」这个项目…现有的是实验室预约系统、科研成果管理平台这些，你要看哪个？」

### 2. 动作失败有反馈

动作总线里对处理函数返回 `false`（或抛错）的情况做了兜底：用 Arco `Message` 弹一句人话
（如「没找到这个项目，看看名字对不对？」），不再静默失败。

### 3. 写操作：已按产品定位移除

**数字人只负责介绍和带路，不代劳写操作。** `rebuild_knowledge_index` 已从工具白名单删除，
前端对应处理函数与确认弹窗一并移除；系统提示词新增一条硬规则：

> 你只负责介绍和带路，不替用户执行任何写操作（保存、删除、上传文档、重建索引、修改数据）。
> 用户要求这类操作时，告诉他去哪个页面的哪个按钮自己做，不要调用动作、也不要假装已经做了。

实测：

| 用户说 | 结果 |
|---|---|
| 重建知识库索引 | 无动作；回答「这是写操作，我不能替你做。你到管理后台的知识库管理页，点「重建索引」按钮就行。」 |
| 把知识库里的文档删掉 | 无动作；回答「删除文档需要你自己操作一下。进管理后台的知识库管理，在文档列表里点删除就行。」 |
| 打开管理后台的知识库页面 | 正常 `open_admin_tab(knowledge)`，跳转并切页签 |

写操作仍然在管理后台里由用户自己点按钮完成，Agent 只做导航。

## 已知限制（下一步）

1. ~~数字人只在看板页存在~~ → 已改成全局浮层（见上）。
   后续可加「最小化按钮」：后台页面的浮层会挡住右下角一块表格区域。
2. ~~只开放了只读动作~~ → 已加 `rebuild_knowledge_index` 作为带确认的写操作模板；改数据/上传/删除等可照此扩展。
3. **动作失败没有回话**：比如 `open_project` 传了不存在的项目名，前端返回 false，但用户看不到提示。应在总线里加失败回调，让数字人补一句。
4. **没有做动作结果回灌**：当前是单轮规划，模型看不到动作执行结果（比如筛选后还剩几条）。后续可以加一轮「执行结果」回填后再生成话术。
5. SSE 模式牺牲了 WS 单连接的「token+PCM 同连接」，TTS 改为逐句 `/tts/stream`，首声略慢。

## 怎么扩展一个新动作（三步）

1. `backend/app/agent.py`：在 `SYSTEM_MAP` 加一句说明，`TOOLS` 加一个 function 定义；
2. 前端对应页面：`registerAction('工具名', handler)`；
3. 需要的话在 `uiState` 加字段，让模型知道上下文。

写操作建议走：模型先返回 `propose_action` → 前端弹确认 → 用户确认后再发一次执行请求。
