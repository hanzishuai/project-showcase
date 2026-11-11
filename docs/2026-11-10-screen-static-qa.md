# 四版 16:9 项目展示大屏 · 只读静态质量复核

- 复核对象：`design-variants/2026-11-10-screen/` 下 v1-aurora-cards.html / v2-prism-steps.html / v3-split-panels.html / v4-orbit-deck.html（四版各 332 行）
- 参照基准：`data/projects.json`（11494 B / 178 行）、`templates/index.template.html`（47988 B / 384 行，L180-331 为文案基准段）
- 复核方式：Node 逐文件解析 + 独立 Python 读 DOCX（`zipfile` → `word/document.xml`）。全程未启动浏览器，四版 HTML/CSS 零改动（sha256 见附录 A）
- 检查器：`_temp/static-qa-check-20261110014609.mjs`（18224 B，`node <script> <ROOT> [负例.html]`，单行 JSON 输出）
- 结论：**数据层与内容计数全绿（差异集合为空）；文案层有 3 条措辞级差异、2 类结构性删减；设计底线 1 项 FAIL（8 处非 token 颜色）、1 项 REFLEX 真缺；16:9 公式在 3 种视口下均正确。** 下面每条结论都带实测数字与差异集合。

---

## 0. 结论摘要

| 维度 | 结果 | 数字 |
|---|---|---|
| 1 数据深相等 | 通过 | 4/4 `equal=true`，`diff=0` |
| 2 内容完整性 | 通过 | 18 卡 / 18 行 / 3 原话 / 7 按钮 / 1 占位；百分比 0 命中、0% 0 命中 |
| 3 文案逐字 | 有差异 | 状态短语 0 差、事实 0 差、原话 0 差；图注 12/12 未落、blockquote 3/7 |
| 4 设计底线 | 1 FAIL + 1 REFLEX | 8 处非 token 色；`:active`/`:disabled` 各 0 处 |
| 5 16:9 公式 | 通过 | 3 视口舞台比例恒 1.777778，最大留白 45 px |
| 6 sloplint | 50 FAIL / 8 REFLEX / 4 WARN | v1 13/2/1、v2 13/2/1、v3 11/2/1、v4 13/2/1 |
| 7 反例分辨力 | 有效 | 29/29 变异命中；2 注入负例报出 5 条 delta |

---

## 1. 内联 JSON 与 `data/projects.json` 深相等

方法：`JSON.parse` 两侧后做稳定序列化（递归按 key 排序再 `JSON.stringify`）比对，并逐键递归求差异路径。

| 版本 | `equal` | `diff.length` | `parseErr` |
|---|---|---|---|
| v1-aurora-cards | true | 0 | 无 |
| v2-prism-steps | true | 0 | 无 |
| v3-split-panels | true | 0 | 无 |
| v4-orbit-deck | true | 0 | 无 |

数据块位置：四版均在 `L136 <script id="projects" type="application/json">` 至 `L312 </script>`。差异集合 = **∅**。

分辨力（见 §7）：`meta.screenshotCount` 7→6 后立刻报 `DEEP_EQUAL`，`diff` 给出 `meta.screenshotCount: 7 → 6`。

---

## 2. 内容完整性

四版实测计数完全一致（差异集合为空）：

| 项 | 要求 | 实测 |
|---|---|---|
| 项目名 `h2` | 3 | 3，顺序 高校党组织管理平台 / 科技成果转化平台 / 科研项目申报系统 |
| 阶段卡 `.chip` | 18 | 18（每项目 6，四版皆然） |
| 状态短语 `em` | 18 | 18 |
| 事实行 `dt/dd` | 18 | 18（每项目 6 组） |
| DOCX 原话 `blockquote` | 3 | 3 |
| 截图按钮 `button.shot` | 7 | 7（p1 3 + p2 4 + p3 0） |
| `img`（shot 内） | 7 | 7，`data-src` 7 |
| 「外部截图未提供」占位块 `.shot-empty` | 1 | 1（文本见 §2 末段） |
| `<code class="mv">—</code>` | 全部 `—` 都在此标签内 | 14 个；可见文本 `—` 共 14 个；`dashOutside = 0` |

14 个 `code.mv` 的分布：总览 `ov-foot` 1 个 + p1 事实清单 4 个（结构化阶段 1 + 状态/进度/更新时间 3）+ p2 4 个 + p3 4 个 + p3 占位块 1 个 = 14。检查口径：先整段删除 `<code class="mv">—</code>` 再数残留 `—`，残留 0 才算通过（早前把 code.mv 里的 `—` 也算进残留，该检查恒判失败，属误报，已修正）。

「外部截图未提供」出现 **3 处文本、1 个占位块**（易被误读为 3 个占位）：① p3 事实 `dd`「外部截图未提供 · 文档图注 5 条」② p3 `h3`「外部截图未提供 · 点击放大」③ `.shot-empty` 内 `b`「外部截图未提供」+ `code.mv`「—」+ `small`「文档内嵌图注 5 条 · 不配未核对图片」。

### 2.1 禁用模式扫描（四版全 0）

| 模式 | 命中 |
|---|---|
| `onclick` | 0 |
| `javascript:` | 0 |
| `href="#"` | 0 |
| 可见 DOM / 属性里的 `http(s)` | 0 |
| `fetch(` / `XMLHttpRequest` | 0 / 0 |
| `cdn.` / `unpkg` / `jsdelivr` / `fonts.googleapis` / `cdnjs` | 0 |
| `<base` | 0 |
| `<link href="http…">` / `<script src="http…">` / `@import http` | 0 / 0 / 0 |
| `<style>` 内 `url(` | 0 |

**排除集合（必须写明，否则扫描被假阳性淹没）**：
1. `<style>` 内 17 个 `%` token 全是布局/渐变（`height:100%`、`55%,var(--bg3)`、`border-radius:50%`×2、`width:100%`、`max-width:100%`、`max-height:100%`、`4%,100%`、`96%,0`、`100%)`、`78%)`、`35%,var(--card)` 等），不属「编造百分比」。
2. 数据块内 `meta.researchLinks` 有 9 条 `https://…`（Smartsheet / Tempo / Portfolio Hub / ONES / Microsoft / Wikipedia / Wingo UI / TailwindFlex），是 JSON 数据字段，不产生请求；扫描时先把整个 `<script id="projects">` 块剥离再扫 `raw`。
3. 15 个 `<a>` 的 `href` 仅 `#p1/#p2/#p3/#overview` 四个内部锚点。

### 2.2 编造百分比 / 0%

可见文本 `%` 命中 **0**，`0%` 命中 **0**，中文百分比/完成度表述命中 **0**。

数字溯源（17 个带单位 token，**orphan = 0**）：`3 个` / `3 份` / `7 张` / `3 张` / `10 月` / `27 日` / `11 月` / `13 日` / `4 张` / `20 项` / `20 条` / `9 个` / `379 人` / `48 家` / `378 条` / `348 条` / `5 条`——每个都能在模板或 `projects.json` 找到出处。四版均不含「24 张演示图片」（在模板 BQ5 与 JSON 内），属可引未引，不构成错误。

### 2.3 截图资源落地

7 个 `data-src` 全部形如 `../../assets/images/<percent-encoded>`，`decodeURIComponent` 后解析到 `assets/images/`，**7/7 文件存在**（`shotFileMiss=[]`），且与 `meta.screenshotCatalog` 的 7 个键一一对应（`shotCatalogMiss=[]`）。7 个文件（字节）：微信图片_20261109162755_36_102.jpg 145407、微信图片_20261109162756_38_102.png 180495、微信图片_20261109162757_39_102.png 122825、截图-科技成果列表.png 438321、截图-企业需求列表.png 275990、截图-管理后台统计.png 92557、截图-操作日志.png 119584。

---

## 3. 文案与 `templates/index.template.html:180-331` 逐字比对

方法：把模板可见文本抽成结构（`span.state` 18 条、`aside.facts` 3×7 行、`blockquote` 7 条、`figcaption` 7 条），与四版对应节点逐条比；`<br>` 归一为 ` · `，`code.missing-value` 与 `code.mv` 统一按 `—` 比。

| 比对项 | 条数 | 差异集合 |
|---|---|---|
| 六段状态短语（`em` vs `span.state`） | 18 / 18 | **∅**（`stateMiss=0`） |
| 事实清单（`dt/dd` vs `aside.facts`） | 18 / 21 | **∅**（`factMiss=0`；模板 21 行减去 3 行「项目展示名」= 18，该行内容已由 `h2` 承载） |
| DOCX 原话（`blockquote`） | 3 / 7 | 4 条未进（见 3.2） |
| 图注（`figcaption` + 内嵌文档图注） | 0 / 12 | **12/12 未落**（见 3.1） |

状态短语 18 条实测全文：文档未给结构化阶段 / 文档未给结构化阶段 / 原话：基于原型设计实现 / 未提供测试记录 / 未提供部署信息 / 资料待补 ／ 文档未给结构化阶段 / 文档未给结构化阶段 / 主要功能都已经做完 / 改完的都测过了 / 还没有正式上线 / 资料待补 ／ 文档未给结构化阶段 / 文档未给结构化阶段 / 文档未给开发阶段结论 / 文档未给测试结论 / 业务环节：线下评审 / 资料待补。

> 口径陷阱：用模板 `nav` 的 `small` 取状态短语只拿到 15 条，会误报 15 条差异；正确锚点是 `.state span`。

### 3.1 图注：结构性删减（12/12 未落）

模板里有两类图注文本，合计 12 条：**7 条 `<figcaption>`**（每张截图一条）+ **5 条内嵌文档图注**（写在 L316 的「文档图注：图一 … 图五 …」段落里）。四版 `figure=0`、`figcaption=0`，12 条文本**一条都没有逐字出现**在可见 DOM 里（逐条归一化后 substring 全部 `false`）。替代物是 `img alt="项目名 界面证据 N"`（7 条全部匹配 `/界面证据\s*\d+$/`，`altBad=0`）+ `h3`「N 张界面截图 · 点击放大」+ 一条 `p.shot-note`。

检查器 `captionMiss` 报的是 **8/8**，不是 12：它的正则 `/图[一二三四五]\s[^；。]+/g` 只抓「图N …」式写法，命中的是 figcaption 前三张（模板写作「图一 截图含阶段计数…」）+ 5 条文档图注；另外 4 条 figcaption 以「界面证据 · 」开头，不被该正则计入。**两个口径都记在这里：正则口径 8/8 未落，人工全量口径 12/12 未落。**

7 条 `figcaption` 原文（模板）：

1. 界面证据 · 高校党组织管理平台截图一 截图含阶段计数、党员分类与铃铛消息角标，按 OCR 逐字转录为演示业务数据。演示业务数据，不是软件项目开发进度。
2. 界面证据 · 高校党组织管理平台截图二 材料项数与提交状态为界面证据，不是软件项目开发进度。
3. 界面证据 · 高校党组织管理平台截图三 权限项数与时间戳为界面证据，不是软件项目开发进度。
4. 界面证据 · 科技成果列表 学校侧成果按领域列出，可检索；页面显示的成果条数为演示库样例。
5. 界面证据 · 企业需求列表 企业侧技术需求按领域列出，与成果侧互相可见。
6. 界面证据 · 管理后台统计 前台「20 项可转化成果」与后台「21 条成果总数」口径差异如实分列，不解释、不合并。
7. 界面证据 · 操作日志 记录后台操作条目与时间戳，用于内容把关留痕。

（2–7 条尾句均为「演示业务数据，不是软件项目开发进度。」）

5 条内嵌文档图注：图一 系统登录页 / 图二 总管理员的申请书审核页面（截图来源于本地环境）/ 图三 项目负责人的申请书填报页面（截图来源于本地环境）/ 图四 单位真实数据（开发环境）/ 图五 系统运行数据报表（截图来源于本地环境）。

**值得单独点出的一条**：第 6 条 figcaption 是模板里唯一披露「前台 20 项 vs 后台 21 条」口径差异的地方（`21 条` 只出现在模板，`data/projects.json` 与四版 DOM 都没有）。四版把这条图注整体删掉后，页面上只剩 shot-note「20 项成果 / 20 条需求 / 9 个技术领域为演示业务数据，不是开发进度。」——口径差异这层信息随之消失。这不构成编造（四版没有写出 21 这个数字，也没写出任何不存在的数），但属可核信息的净损失。

判定：整体属**删减**而非改写或杜撰，不构成事实错误；是否补回、补哪几条，交 lead 判。

### 3.2 原话：3/7

未进的 4 条（模板 `blockquote`）：BQ2（103 字，Spring Boot 3 + MySQL 8080 / Vue 3 + Vite 5173）、BQ3（83 字，「给学校和企业搭个对接的平台」）、BQ5（80 字，「平台还没有正式上线…20 条科技成果、20 条企业技术需求、按 9 个技术领域分类、24 张演示图片」）、BQ6（83 字，「集课题发布…PDF 生成与导出」）。

### 3.3 三条原话与 DOCX 逐字核验

用 `zipfile` 读 `word/document.xml` 取正文（三份 docx 去空白 664 / 540 / 291 字），7 条 probe 全部 HIT：

| 引用 | 判定 | 说明 |
|---|---|---|
| Q1「高校党组织管理平台是一套面向高校党建工作的信息化管理系统，基于原型设计实现，采用前后端分离架构。」 | HIT | 逐字 |
| Q2「主要功能都已经做完，眼下还在边开发边修」「改完的都测过了，目前没发现大问题。」 | HIT | 两段均逐字 |
| Q3「当前业务整体处于线下评审环节。」 | HIT | 逐字 |

- Q2 在 DOCX 原文中间有 84 字被「……」省略（「：后台常用选项，比如技术领域这些，正在做成自己就能维护的页面，管理员和用户的权限也在细化，顺手修了改完角色页面不刷新、身份显示不对、点「我的发布」被带错地方这几处毛病，」）。省略号标记存在，属可接受的节引，但已不是「全文引用」。
- Q3 只保留 15 字，该段后续 151 字（379 个申报个人…以下部分截图来源于本地环境 + 5 条图注）未引。
- Q3 的括注「这是业务流程环节，不是软件开发阶段」不是逐字引文（模板与 DOCX 均无此原样串），与模板 L312「这是业务流程环节，不是六段框架里的软件开发阶段」同义，属括注缩写；四版把括注放在引号外、引号内仍是 DOCX 原句，形式正确。

### 3.4 可见文本溯源（87 条叶子文本）

`tplHit=59`、`jsonOnly=1`（「课题申报与审核业务平台」）、`newOnly=27`。27 条里：

- 10 条属页面自有 UI 文案（眉标「项目展示 · 大屏演示」、交互标签「查看项目详情」「返回总览」「关闭放大」「←」「↗」、「一屏看清」、三个 `h3` 标题、导航句）。
- 3 条是模板 `<br>`/分隔符改写为「 · 」的等价串（Spring Boot 组合串、开工/交付日期串、业务数据串），朴素 substring 判 newOnly 属方法性假阳性。
- **真正措辞新造 3 条**（语义有据、措辞替换，不编造数字，交 lead 判）：

| # | 四版写法 | 模板/数据最接近的出处 | 判定 |
|---|---|---|---|
| 1 | 「学校与企业的成果对接平台」 | 模板 BQ3「这个平台就是给学校和企业搭个对接的平台」+ `projects[1].summary`「面向学校与企业技术成果、需求对接的演示平台」；两处均无「成果对接」四字 | 措辞新造，语义有据 |
| 2 | 「截图含阶段计数与业务数据，均为界面证据，不换算成软件开发进度。」 | 模板 figcaption「截图含阶段计数、党员分类与铃铛消息角标，按 OCR 逐字转录为演示业务数据。演示业务数据，不是软件项目开发进度。」 | 具体项被删、改述为泛指 |
| 3 | 「不配未核对图片」（出现在 2 处） | 模板「不配图、不补写」「只列图注原文」 | 措辞替换 |

三条 cite 与模板一致：「高校党组织管理平台项目介绍.docx · P2」「产教融合服务平台项目介绍.docx · P2 · 进度叙述」「科研项目申报系统简介.docx · P2 · 业务状态」。

---

## 4. 设计底线

四版完全一致（差异集合为空），逐项实测：

| 检查项 | 要求 | 实测 |
|---|---|---|
| `:root` token 数 | — | 15 个 |
| `font-family` 声明 | 全走 token | 2 处，全部 `var(--font-body)`，裸字体族 **0** |
| `html, body` `overflow-x` | `clip` | 有（`L10`），其它 `overflow` 声明 0 |
| 图片轨道 | `minmax(0,1fr)` | `.shots-grid` = `repeat(4,minmax(0,1fr))`；全文件 `minmax(0,1fr)` 24 处；`repeat(N,1fr)` 无 `minmax` 的 0 处 |
| `:focus-visible` | 有 | 1 条：`outline:2px solid var(--ink);outline-offset:calc(3*var(--u))` |
| `prefers-reduced-motion` | 有 | 1 条：`*{animation:none!important;transition:none!important}` |
| `transition:all` | 0 | 0（全文件唯一 `transition` 声明就是上面那条 `none!important`） |
| 几何属性过渡（width/height/top/left） | 0 | 0 |
| `@keyframes` / `will-change` | 0 | 0 / 0 |
| eyebrow / tracked caps | 0 | `letter-spacing` 仅 `0` 一处，`text-transform` 0 处，`tracked=false` |
| 编造指标 | 0 | 见 §2.2，orphan 0、% 0 |
| **颜色走 token** | 全走 token | **FAIL**：8 处非 token 颜色字面量 |

### 4.1 FAIL 明细：8 处非 token 颜色（四版同位置）

| 行 | 值 | 用途 |
|---|---|---|
| L10 | `#080b16` | `html,body` background |
| L16 | `rgba(0,0,0,.45)` | `.stage` box-shadow |
| L53 | `rgba(255,255,255,.04)` | `.chip` background |
| L54 | `rgba(255,255,255,.10)` | `.chip.on` background |
| L66 | `rgba(255,255,255,.05)` | `.shot` background |
| L68 | `rgba(0,0,0,.55)` | `.shot i` background |
| L73 | `rgba(6,9,20,.92)` | `.zoom` background |
| L116 | `rgba(255,255,255,.02)` | `.v4 .card` radial-gradient 端点 |

可修方向：把 8 个值提进 `:root`（如 `--page`、`--shadow`、`--veil-1..4`、`--zoom-bg`），改成 `var()` 引用即可清零。

### 4.2 REFLEX 真缺：无 `:active` / `:disabled`

实测 `:hover` / `:active` / `:disabled` 计数全 0。`.shot`、`.card`、`.zoomclose` 都是可点元素，按下与禁用态没有任何样式反馈。这是**真缺**（不是误报），sloplint 的 gate 26b 两条与之吻合。

---

## 5. 16:9 公式与视口推算

公式实测存在：`:root` 内 `--u:min(0.0625vw, 0.111111vh)`；`.stage{width:calc(1600*var(--u));height:calc(900*var(--u))}`。`0.0625vw` = 1600 宽满屏，`0.111111vh` = 900 高满屏，取 `min` 即「先撞到哪边就按哪边等比缩」。

| 视口 | `--u` | 受哪支约束 | 舞台 | 留白（左右 × 上下） | 覆盖率 | 比例 |
|---|---|---|---|---|---|---|
| 1600×900 | 0.999999 | 两支几乎相等（1.000000 vs 0.999999） | 1599.998 × 899.999 | 0.001 × 0 | 100.00% × 100.00% | 1.777778 |
| 1920×1080 | 1.199999 | 同上（1.200000 vs 1.199999） | 1919.998 × 1079.999 | 0.001 × 0.001 | 100.00% × 100.00% | 1.777778 |
| 1440×900 | 0.900000 | `vw` 支受限（0.900000 < 0.999999） | 1440.000 × 810.000 | 0 × 45.000 | 100.00% × 90.00% | 1.777778 |
| 2560×1440 | 1.599998 | 两支相等 | 2559.997 × 1439.999 | 0.001 × 0.001 | 100.00% × 100.00% | 1.777778 |
| 1366×768 | 0.853332 | `vh` 支受限 | 1365.332 × 767.999 | 0.334 × 0 | 99.95% × 100.00% | 1.777778 |

（另测 1280×720：u=0.799999、舞台 1279.999×719.999、留白 0.001×0。）

结论：三种指定视口下舞台都精确保持 16:9（比例恒 1.777778，误差 ≤ 0.002 px，来自 `0.111111` 的截断）。1440×900 是唯一出现可见留白的场景（上下各 45 px，垂直覆盖率 90.00%），属公式的预期行为——该视口比 16:9 更方，等比缩放必然留边；`body` 用 `flex` 居中，留白对称。

---

## 6. Hallmark sloplint 静态门禁（不带 `--render`）

命令：`node ~/.dsh/skills/hallmark/scripts/sloplint.mjs <file> --json`，四版 `exit code` 全为 **1**。原始 JSON 存 `_temp/sloplint-raw.json`（19428 B）。

| 版本 | FAIL | REFLEX | WARN |
|---|---|---|---|
| v1-aurora-cards | 13 | 2 | 1 |
| v2-prism-steps | 13 | 2 | 1 |
| v3-split-panels | 11 | 2 | 1 |
| v4-orbit-deck | 13 | 2 | 1 |
| 合计 | **50** | **8** | **4** |

### 6.1 可修项（去重后 11 类）

| # | gate | 位置 | evidence | 出现版本 |
|---|---|---|---|---|
| 1 | 2a | L16 | purple-to-blue gradient on `.stage` | v1 v2 |
| 2 | 2a | L16 | purple-to-pink gradient on `.stage` | v4 |
| 3 | 2a | L37 | purple-to-blue/pink gradient on `.dt` | v1 v2 v4（v3 青绿系无此条） |
| 4 | 48 | L10 | colour literal `#080b16` outside tokens (background on `html,body`) | 四版 |
| 5 | 48 | L16 | `rgba(0,0,0,.45)` outside tokens (box-shadow on `.stage`) | 四版 |
| 6 | 48 | L53 | `rgba(255,255,255,.04)` outside tokens (background on `.chip`) | 四版 |
| 7 | 48 | L54 | `rgba(255,255,255,.10)` outside tokens (background on `.chip.on`) | 四版 |
| 8 | 48 | L66 | `rgba(255,255,255,.05)` outside tokens (background on `.shot`) | 四版 |
| 9 | 48 | L68 | `rgba(0,0,0,.55)` outside tokens (background on `.shot i`) | 四版 |
| 10 | 48 | L73 | `rgba(6,9,20,.92)` outside tokens (background on `.zoom`) | 四版 |
| 11 | 48 | L116 | `rgba(255,255,255,.02)` outside tokens (background on `.v4 .card`) | 四版 |

另有 3 类各 1 条（四版全有）：gate 54 `L133` eyebrow「项目展示 · 大屏演示」出现在 `<h1>` 之前；gate 63 `L133` middle-dot meta string「产教融合服务平台项目介绍.docx · P2 · 进度叙述」；gate 76 `L134` 一个 `<img>` 无 source（即 `#zoomimg src=""`）。

REFLEX 2 条（四版全有，gate 26b `L1`）：「no `:active` styling anywhere」「no `:disabled` styling anywhere」——与 §4.2 实测吻合。WARN 1 条（gate 29 `L28`）：glass panel `backdrop-filter` 压在 `.card` 的半透明白上。

按派单要求未强求 0/0/0；上表 11 类即「可修项」全集，其中 #1–#3（渐变）与 #4–#11（色字面量）可在同一次改动里一起处理。

---

## 7. 反例与检查分辨力

### 7.1 负例（缺一张图 + 多一个百分比）

临时副本：`_temp/qa-negative-20261110100645b.html`（37198 B，基于当前快照，仅 2 处注入）：
1. 删掉第 1 个 `button.shot`（连带其 `img` 与 `data-src`）；
2. 在首个 `p.shot-note` 后插入 `<p class="qa-injected">开发完成度 42%</p>`。

| 量 | 基线 v1 | 负例 |
|---|---|---|
| `shots` / `imgs` / `dataSrc` | 7 / 7 / 7 | **6 / 6 / 6** |
| `pcts` | `[]` | **["42%"]** |
| `codeMv` / `dashOutside` | 14 / 0 | 14 / 0 |
| 失败码集合 | `[TOKEN_COLOR]` | `[SHOT_COUNT, IMG_COUNT, DATA_SRC_COUNT, PERCENT, TOKEN_COLOR, CAPTION_ALT]` |

**差异集合（相对基线，去掉基线已存在的 `TOKEN_COLOR`）= 5 条**：`SHOT_COUNT`、`IMG_COUNT`、`DATA_SRC_COUNT`、`PERCENT`、`CAPTION_ALT`；`onlyBase = []`（无「基线有、负例无」的消失项，说明比对集合完整）。

6 注入版 `_temp/qa-negative-20261110100645.html`（37225 B，另加裸 `—`、改状态短语、`transition:all .3s`、`0%`）报出 **9 条** delta：上述 5 条 + `STATE_PHRASE`、`DASH_LOCATION`、`ZERO_PCT`、`TRANS_ALL`。

### 7.2 变异矩阵：29 条逐一注入，29/29 命中

对当前快照逐条注入单点变异并重跑，`mutations` 数组 29 项全部 `hit=true`（`delta` 是应报码的超集，无漏报）。29 条覆盖：数据层（`DEEP_EQUAL` 改 `meta.screenshotCount`、`SHOT_FILE_EXISTS` 改 `data-src`、`SHOT_COUNT` 删按钮）、计数层（`NAME_COUNT` / `CHIP_COUNT` / `EMPTY_SLOT`）、文案层（`STATE_PHRASE` / `FACT_TEXT` / `QUOTE_VERBATIM` / `CAPTION_ALT`）、指标层（`PERCENT` 插「开发完成度 42%」、`ZERO_PCT` 插「完成率 0%」）、占位层（`DASH_LOCATION` 把 `code.mv` 的 `—` 改裸 `—`）、安全层（`ONCLICK` / `HREF_HASH` / `EXT_HTTP` / `FETCH` / `BASE`）、样式层（`TOKEN_COLOR` 加裸色 `#ff0000`、`BARE_FONT` 加 `font-family:Arial`、`TRANS_ALL` / `TRANS_GEOM`、`OVERFLOW_CLIP`、`FOCUS_VISIBLE`、`REDUCED`、`TRACKED_CAPS` 加 `letter-spacing:.08em`+`uppercase`、`MINMAX` 把 `minmax(0,1fr)`→`1fr`）、几何层（`U_FORMULA` 改 `0.0625vw`→`0.07vw`、`STAGE_SIZE` 改 `900`→`880`）。

### 7.3 「命中 0 次」的分辨力说明

本报告里报 0 的项（`onclick`/`javascript:`/`href="#"`/外链/`fetch`/`transition:all`/几何过渡/`tracked`/百分比/`0%`/`dashOutside`/`stateMiss`/`factMiss`/`quoteBad`/`altBad`/`shotFileMiss`/`shotCatalogMiss`/`diff` 各 0）**不是「没检查」，而是「检查过且能报出」**——29 条变异每一条都让对应码从「不出现」变成「出现」，负例给出完整差异集合。需提醒 `DASH_LOCATION`：早前把 `code.mv` 内的 `—` 计入残留、恒判失败；改为「先剥离 `<code class="mv">—</code>` 再数残留」后基线 0、负例 1，才有分辨力。

**门禁记录（red → green）**：`node _temp/static-qa-assert-20261110104440.mjs . <2注入负例> <6注入负例>` → **86 条断言全过、`exit 0`**；两个负例参数换成未注入的 `v1-aurora-cards.html` → **6 条失败、`exit 1`**（delta 空、shots 7/7/7、`dashOutside 0`）。先红后绿，断言覆盖 §1–§6 全部数字与禁词表。

---

## 8. 附：文件指纹与临时件

### A. sha256 前 16 位（当前快照）

| 文件 | 字节 | 行 | sha256[:16] |
|---|---|---|---|
| v1-aurora-cards.html | 37442 | 332 | 880c025abb156ea5 |
| v2-prism-steps.html | 37441 | 332 | c016de3a0bbcb241 |
| v3-split-panels.html | 37442 | 332 | 1a844f45b642b93b |
| v4-orbit-deck.html | 37440 | 332 | e611d7a48fcd07ac |
| index.html（导航页，不计入四版） | 3246 | 1 | ef7861f25bda9a13 |
| data/projects.json | 11494 | 178 | 9d035a362ab1125b |
| templates/index.template.html | 47988 | 384 | f7ff804da3a1b166 |

四版把 `:root` 块、`<title>`、`/* Hallmark … */` 注释、`<body class="vN">` 归一后**完全同源**：归一长度 29384，四版 identical。也就是说本节 §1–§4 的结论对四版是同一份实现，差异只在配色 token、标题与 body class。

### B. 临时件（`_temp/`，均带时间戳）

| 文件 | 用途 |
|---|---|
| `static-qa-check-20261110014609.mjs`（18224 B） | 检查器本体，可复现全部计数与差异集合 |
| `qa-negative-20261110100645b.html`（37198 B） | 2 注入负例（§7.1） |
| `qa-negative-20261110100645.html`（37225 B） | 6 注入负例（§7.1） |
| `static-qa-assert-20261110104440.mjs`（5697 B） | 断言门禁：86 条（§7.3） |
| `sloplint-raw.json`（19428 B） | 四版 sloplint 原始 JSON |
| `docx-dump-20261110014609.py` / `.json` | DOCX 抽取脚本与 UTF-8 结果（§3.3 依据） |

### C. 方法学备忘（复现时避免踩坑）

1. `run_code` 内检查函数必须声明 `async` 并逐个 `await`，否则 `fs.stat` 触发 `SyntaxError: Unexpected reserved word`。
2. Python 读 DOCX 须落成 UTF-8 JSON 再读，直接打印 stdout 会按 GBK 解码成乱码。
3. `img` 计数只在 `button.shot` 内取，否则 `#zoomimg`（`src=""`）被算进截图数。
4. 扫禁用模式前先剥离整个 `<script id="projects">` 数据块，否则 9 条 `researchLinks` 与数据里的 `—` 造成假阳性。
5. 四版 mtime 2026-11-10T01:56:48Z（`.dt-main` `margin-top` 26→22、`gap` 18→14）；旧快照负例已不同源，须重建重跑。
