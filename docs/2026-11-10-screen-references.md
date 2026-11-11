# 16:9 大屏 / 项目作品集 / 彩色交互演示 —— 参考案例与四版改稿建议

日期：2026-11-10 · 截图目录：`C:\Users\31598\Desktop\AIArea\DSHWork\project-showcase\previews\references-2026-11-10\`
适用对象：`design-variants/2026-11-10-screen/` 下 v1-aurora-cards / v2-prism-steps / v3-split-panels / v4-orbit-deck

## 0. 取证方法与诚实边界

- **搜索通道在本会话全部不可用**：`tools.web_search` 返回 "DeepSeek returned no web_search_tool_result blocks"；`mcp__magpie-web-search__web_search` 返回 "SearXNG found nothing"；`html.duckduckgo.com` 报 "web fetch failed: TypeError: fetch failed"。因此本文**没有二手摘要**，每条可借鉴点都来自：① `web_fetch` 直取页面（HTTP 200）；② 本机 Chrome headless + puppeteer-core 25.16.0 实访截图 1600×900 后逐像素/逐元素量取。
- 下表 12 条网址**全部当场复验 HTTP 200**（2026-11-10 10:12–10:16），截图文件字节数见 §5。
- 截图失败的站（Awwwards 详情页正文 Forbidden、CodePen Cloudflare、Behance 根域 fetch failed、Dribbble HTTP 202）**不列入主表**，只在 §4 作为检索入口列出，**不据此摘录做法**。
- §3 的每条改法都做过 A/B 注入实测（puppeteer `addStyleTag` 注入 → 重新量取），文中"实测"后的数字是**改前 → 改后**的真实值；**没有任何一条建议是未实测的推算**。另有 §3.9 记录三条实测会坏的改法，请先看那一节再动手。

## 1. 参考案例表

| 案例名 | 网址 | 本地截图 | 可借鉴点（实测） | 与本项目关系 |
|---|---|---|---|---|
| Stripe 首页 | https://stripe.com/ | `previews/references-2026-11-10/03-stripe-home.png` | 右半屏一整条**斜向彩色渐变光带**，与左侧黑字形成对角线构图；h1 实测 48px / 行高 55.2px。渐变是品牌资产，不是装饰光斑 | 本项目 `.card::after`（第 29 行）是圆形径向光斑，可换成整卡斜向渐变带（见 P4） |
| Linear 客户案例页 | https://linear.app/customers | `previews/references-2026-11-10/02-linear-customers.png` | 3 栏等宽卡片，卡内缩略图实测 **386×218（1.77 ≈ 16:9）**；标题 2 行 + 单一入口「Read story →」；分类 chip 横排；整页 48 个卡片链接 | v1 三列卡实测 468×390（1.2:1）无图位，最值得照抄的一条（见 v1 建议） |
| Vercel 首页 | https://vercel.com/ | `previews/references-2026-11-10/04-vercel-home.png` | 纯黑底 + **中央单点光源**（白三角 + 光晕），左右各一组极简文字；靠明暗对比而非色彩堆叠 | 详情页 `.dt` 现在 3 个 orb 平铺，可收敛为单光源（见 P4 说明） |
| Framer 首页 | https://www.framer.com/ | `previews/references-2026-11-10/05-framer-home.png` | 深黑底 + 蓝色**发光玻璃面板**（内发光描边 + 轻微外溢光），产品截图作 hero，标题 2 行 + 双按钮 | `.card`（第 28 行）已有 backdrop-filter blur 14u，缺 1px 内发光描边 |
| Lusion | https://lusion.co/ | `previews/references-2026-11-10/08-lusion.png` | 白底 + 顶部大标题 + **16:9 深色圆角画布**（3D 内容被圆角容器裁进固定画幅）+ 底部 SCROLL TO EXPLORE | 本项目详情页 `.dt` 已由 `.stage` 第 16 行裁进 16:9；本条证明「裁切边界本身就是版式」 |
| Rauno 作品集 | https://rauno.me/ | `previews/references-2026-11-10/06-rauno-portfolio.png` | 浅灰底 + **明黄大圆压在大字上**做视觉锚点；右侧露出下一张卡的切片，暗示横向轮播 | v4 的圆形卡可加「露出下一张切片 / 三张错落」，见 v4 建议 |
| Bruno Simon | https://bruno-simon.com/ | `previews/references-2026-11-10/10-bruno-simon.png` | 暗紫底 + 细网格斜线 + **单条发光圆弧**；极少的图形元素造空间感，全屏只有一个光源 | 本项目一屏 6 处 blur（3 orb + 3 卡光斑），可减到 2 处（见 P4） |
| AntV 首页 | https://antv.antgroup.com/ | `previews/references-2026-11-10/14-antv.png` | 淡紫粉插画 hero + 中央搜索框 + 底部 **3 张等宽 387×150 卡片**（三段式：主张 / 入口 / 卡片区） | 中文大屏语境下结构最接近本项目，卡片比例可直接参考 |
| DataEase | https://dataease.io/ | `previews/references-2026-11-10/13-dataease.png` | 深蓝**曲线分层渐变波浪** hero（不是径向光斑）+ 白底公告卡 + 蓝色 CTA | 中文 BI/大屏站配色与层级样本；波浪比圆斑更贴「数据」语义 |
| Apple MacBook Pro | https://www.apple.com/macbook-pro/ | `previews/references-2026-11-10/16-apple-macbook-pro.png` | 纯黑满屏 + 双产品并排 + 极小灰字参数；留白与产品渲染图承担全部视觉 | 详情页「大标题 / 极小说明」的字号对比可参照（h2 62u 对 .box-t 14u） |
| 站酷「数据大屏」检索 | https://www.zcool.com.cn/search/content?word=%E6%95%B0%E6%8D%AE%E5%A4%A7%E5%B1%8F | `previews/references-2026-11-10/18-zcool-datav-search.png` | 密集缩略图网格，缩略图统一为 16:9 深色大屏预览，标题压在图下 | `.shots-grid`（第 65 行）应统一画幅，而不是现在的 4 列小方条 |
| Codrops gradient 标签页 | https://tympanus.net/codrops/tag/gradient/ | `previews/references-2026-11-10/19-codrops-gradient.png` | 编辑式列表 + 右侧深色专题卡；渐变/光效 demo 的合集入口 | 换渐变实现时的技术参考源（非视觉范本） |

## 2. 横向规律（12 条里重复出现的 5 点）

1. **大面积低频渐变 > 多个小圆斑**。Stripe 是整条斜带、DataEase 是曲线波浪、Bruno 是单条圆弧——没有一个站把 3 个以上径向 blur 平铺在同一屏。
2. **总览→详情是「同画幅替换」**，不是跳新页：Lusion 用圆角画布把内容裁进 16:9，Linear 是卡片原地进 story。本项目用 `.dt:target`（第 38 行）做同画幅替换，方向是对的。
3. **卡片必有 16:9 图位**：Linear 386×218、AntV 387×150、站酷统一大屏预览。纯文字卡在作品集语境里信息量不足。
4. **同屏只允许一档大字**：产品站 h1 上限 48px/1600（3%）；大屏演示可到 84/900（9.3%），但不能同时出现 84 与 70 两档。
5. **每屏只有一个「可点的视觉承诺」**：Linear「Read story →」、Lusion「SCROLL TO EXPLORE」、Framer 双按钮。入口不重复。

## 3. 对四版改稿的具体建议

四份文件同源骨架，**共用选择器行号完全一致**（:root 第 7 行 / `.stage` 第 16 行 / `.screen` 第 17 行 / `.orb` 第 19 行 / `.o1`–`.o3` 第 20–22 行 / `.kicker` 第 24 行 / `.ov-head h1` 第 25 行 / `.ov-grid` 第 27 行 / `.card` 第 28 行 / `.card::after` 第 29 行 / `.c-no` 第 31 行 / `.c-name` 第 32 行 / `.c-lead` 第 33 行 / `.c-short` 第 34 行 / `.c-go` 第 35 行 / `.ov-foot` 第 36 行 / `.dt` 第 37 行 / `.dt:target` 第 38 行 / `.dt-main` 第 48 行 / `.box` 第 49 行 / `.shots-grid` 第 65 行 / `.shot` 第 66 行 / `@media (prefers-reduced-motion)` 第 129 行）。

基线实测（1600×900，file:// 直开）：四版 `document.scrollWidth` 均 1600、`scrollHeight` 均 900、控制台 0 错误；`.stage.scrollHeight` 四版都是 **1320**（成因见 P1）。

### P1 `.dt` 第 37 行 scrollHeight = 1320 —— 是记账，不是可见缺陷（原判断已修正）

早期判断「详情页底部被硬切一条边」**已被实测推翻**。证据：向 `.dt` 注入 `overflow:hidden` 后整页截图逐像素比对，**changedPixels = 0 / 1440000、maxDelta = 0**，画面完全一致；注入前后 `.stage.scrollHeight` 都是 1320。原因是 `.stage`（第 16 行）本身 `overflow:hidden`，已把 `.o3`（第 22 行 `bottom:-420u`、700u 高）裁在画幅外，用户看不到任何切线。

结论：**不需要改**。若想让代码自证干净（避免后续维护者误判），可选加一行，纯记账用途、无视觉变化：

```css
.dt{overflow:hidden}   /* 第 37 行，可选：只为让 scrollHeight 收敛，实测画面零变化 */
```

### P2 `.kicker` 第 24 行 + 第 133 行文案「项目展示 · 大屏演示」

中点连接的 meta 标签是 Hallmark Floor 明令禁止的 AI 味写法。改文案（样式不动）：

```html
<div class="kicker">2026 年 11 月 10 日更新，三个在办项目</div>
```

想更极简就整行删掉。实测 `.kicker{display:none}`：kicker 高 22 → 0，h1 top 88 → 52，首卡 top 384 → 366，版面自动上收，无溢出。

### P3 `.c-go` 第 35 行：箭头紧贴文字（实测间距 0px）

markup 是 `查看项目详情 <span aria-hidden="true">↗</span>`。实测 `.c-go` 为 `display:block`、宽 398、文字节点宽 107、箭头 left = 107 —— **箭头与文字间距 0px**，读作「详情↗」一个词。按版本分别改：

```css
/* v1 / v3：把箭头推到行尾，形成「文字 ←—— ↗」的独立入口 */
.c-go{display:flex;align-items:center;justify-content:space-between}   /* 第 35 行 */
```
实测（v1）：箭头 left 107 → 381，与文字间距 0 → 290px。（v3 同法，箭头 left 107 → 392，间距 0 → 290px。）

```css
/* v4：圆形卡内文字窄，只加呼吸间距，不推两端 */
.v4 .c-go{display:inline-flex;align-items:center;gap:calc(8*var(--u))}   /* 覆盖第 122 行 */
```
实测：间距 0 → 8px，`.c-go` 宽 102 → 106，仍在 392 圆内。

```css
/* v2：横向色带里的 .c-go 已是 nowrap 短链（宽 124），实测加 flex 无效，保持原样即可 */
```

### P4 `.card::after` 第 29 行：光斑过大过亮

实测（v1）：光斑 **259.98×259.98**，占卡片矩形面积 **37%**（按圆面积算 29%），opacity **0.5**，blur **70px**；卡片 468×390。叠加 `.orb` 三个（blur 90u、opacity .42），一屏 6 处大 blur。改：

```css
.card::after{width:calc(200*var(--u));height:calc(200*var(--u));opacity:.28;filter:blur(calc(56*var(--u)))}  /* 第 29 行 */
.card:nth-child(2)::after{inset:auto calc(-60*var(--u)) calc(-70*var(--u)) auto}   /* 三张不同角，避免同角重复 */
.card:nth-child(3)::after{inset:calc(-80*var(--u)) calc(-60*var(--u)) auto auto}
```
实测：光斑 259.98 → 199.98，面积占比 37% → 22%，opacity .5 → .28，blur 70 → 56；第 2 张 computed inset `217.98px 296.02px -90px -90px` → `197.98px -60px -70px 266.02px`，第 3 张 → `-80px -60px 207.98px 266.02px`。卡片内容底 355 不变（光斑是伪元素，不占位）。
依据：Bruno Simon 全屏只有一条圆弧（10-bruno-simon.png），Stripe 用整条渐变带替代光点。

### P5 标题只有一档大字

现在 84u（`.ov-head h1` 第 25 行，v1/v3）与 70u（`.v2 .ov-head h1` 第 84 行、`.v4 .ov-head h1` 第 113 行）两档并存。统一到 84u：

```css
.v2 .ov-head h1,.v4 .ov-head h1{font-size:calc(84*var(--u))}   /* 覆盖第 84 / 113 行 */
```
实测无溢出：v2 `.ov-head` 底 275 → 305、首卡 top 333 → 348、卡底 781 → 796、`.ov-foot` top 819 不变（余量 23px）；v4 卡底 749 → 764（余量 55px）。两版 `document.scrollHeight` 均仍 900。

### v1-aurora-cards（玻璃卡 · 等宽三列）

- 实测卡片 **468×390**、gap 26、radius 28、h1 84px；首卡 top 384、卡底 774、`.ov-foot` top 819 —— 卡底到页脚只剩 **45px**，且卡片无图位（1.2:1）。给卡片顶部加一条 16:9 视觉带（**必须绝对定位**，见下方警告）：
  ```css
  .v1 .c-thumb{position:absolute;inset:0 0 auto 0;height:calc(130*var(--u));border-radius:calc(28*var(--u)) calc(28*var(--u)) 0 0;margin:0}
  .v1 .card{padding-top:calc(156*var(--u))}          /* 覆盖第 28 行 padding 34u */
  .v1 .c-no{font-size:calc(52*var(--u))}             /* 第 31 行 74u */
  .v1 .c-name{font-size:calc(26*var(--u))}           /* 第 32 行 38u */
  .v1 .c-lead{font-size:calc(15*var(--u))}           /* 第 33 行 20u */
  .v1 .c-short{font-size:calc(13*var(--u))}          /* 第 34 行 17u */
  ```
  实测：卡 468×400、卡底 779、与页脚间距 40px、内容底 365 ≤ 400（不溢出），与 P3/P4 叠加后 `docH` 仍 900、`docW` 1600。缩略图实际画幅 398×130（3.06:1），是「顶部视觉带」而非严格 16:9 —— 要严格 16:9 必须用 398×224，会撑破版面（见 §3.9）。
- 若不加图位，只想让卡片别顶到页脚：`.v1 .card{min-height:calc(340*var(--u))}`。实测卡 468×340、卡底 749、间距 45 → 70px、内容底 305 ≤ 340。
- `.v1 .dt-main` 第 79 行已是 `'chips chips' / 'facts quote' / 'shots shots'` 三行区；实测四块 box 为 chips 1456×140 / facts 829×198 / quote 533×166 / shots 1456×235。若嫌 shots 太矮，把行比例调成 `minmax(0,.62fr)`：
  ```css
  .v1 .dt-main{grid-template-rows:auto minmax(0,.62fr) minmax(0,1fr)}   /* 第 79 行 */
  ```
  实测：facts 198 → 166、quote 166 → 134、shots 235 → 267，总高 601 不变、无溢出。

### v2-prism-steps（错位色带 · 横向阶梯）

- 实测卡 **1366 / 1286 / 1206 × 140**、gap 14、h1 70、radius 18；左缘 162 / 242 / 322、右缘均 1528（第 87 行 `margin-left` 吃掉了宽度）。收窄错位让第三张别太窄：
  ```css
  .v2 .card:nth-child(3){margin-left:calc(120*var(--u))}   /* 第 87 行，160u → 120u */
  ```
  实测：第三张 1206 → 1246 宽，左缘 322 → 282，右缘仍 1528，无溢出。
- `.v2 .c-go` 第 91 行 `margin-left:auto` 把入口推到最右，与 `.c-name`（min-width 330u）之间空出 **726px**，读起来断成两截。实测改成 40u 间距：
  ```css
  .v2 .c-go{margin:0 0 0 calc(40*var(--u))}   /* 第 91 行 */
  ```
  实测：name→go 间隙 726 → 436px。
- `.v2 .dt-main` 第 92 行三列 `'facts quote shots'`，实测 shots 列 476×447 里只排 2 列 88u 小图，下半截空 199px。加高图位：
  ```css
  .v2 .shot{height:calc(120*var(--u))}   /* 第 97 行，88u → 120u */
  ```
  实测：`.shot` 88 → 120，`.shots-grid` 184 → 248，`.shot-note` 底 248 → 312，box 仍 447 且**不溢出**（余量 −135px）。

### v3-split-panels（斜切色板 · 左右分栏）

- `.v3 .c-no` 第 102 行 130u，实测卡片 477×490 —— 数字占卡高 **27%**，把 `.c-name`（40u）压成配角。降一档：
  ```css
  .v3 .c-no{font-size:calc(104*var(--u))}   /* 第 102 行 */
  ```
  实测：数字高 130 → 104，占卡高 27% → 21%。
- `.v3 .ov-grid` 第 100 行 gap 12 + `.v3 .card` 第 101 行 `clip-path:polygon(0 4%,100% 0,100% 96%,0 100%)`：12px 间距下三张斜边几乎相接成锯齿。拉开并减斜度：
  ```css
  .v3 .ov-grid{gap:calc(22*var(--u))}                        /* 第 100 行 */
  .v3 .card{clip-path:polygon(0 2%,100% 0,100% 98%,0 100%)}  /* 第 101 行 */
  ```
  实测：gap 12 → 22，三卡横向 72–543 / 565–1035 / 1057–1528（原 72–549 / 561–1039 / 1051–1528），仍在画幅内。
- `.v3 .dt-main` 第 106 行 `.85fr 1.15fr`，实测 facts 829×396 过宽、chips 613×217 过矮。改等分：
  ```css
  .v3 .dt-main{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}   /* 第 106 行 */
  ```
  实测：chips 829 → 721、facts 613 → 721、quote 533 → 641，shots 仍 1456，总高 601 不变。
- 详情页图位可以加高，但**有天花板**：`.v3 .shots` box 高 191。实测 `.v3 .shot{height:calc(124*var(--u))}` 时内容底 188（余量 −3px，刚好）；130u 就溢出 +3px。建议取安全值：
  ```css
  .v3 .shot{height:calc(120*var(--u))}   /* 共用 .shot 第 66 行（v3 未覆盖）；v3 专属只有 .shots-grid 第 110 行 */
  ```
  实测 120u：内容底 184 ≤ box 191（余量 −7px），不溢出。

### v4-orbit-deck（圆形轨道 · 三列资料甲板）

- `.v4 .c-short` 第 121 行 `display:none` 直接删信息 —— 实测 overview 正文字符 v4 只有 253，其他三版 289。圆形卡内部其实放得下（392×392，radius 50%）。恢复：
  ```css
  .v4 .c-short{display:block;font-size:calc(14*var(--u));max-width:calc(240*var(--u));margin-top:calc(4*var(--u))}   /* 第 121 行 */
  ```
  实测：内容底 277.78 → 289.27，子元素 c-short 落在 237–256，全部在 392 卡高内。（注：`.card` 的 `scrollHeight` 480 / `clientHeight` 390 的 90px 差值是 `.card::after` 的 `-90u` 偏移造成，四版一致，且被 `overflow:hidden` 裁掉，与 c-short 无关。）
- `.v4 .ov-grid` 第 115 行 gap 60u + `padding:0 80u`，实测卡 392×392、gap 60 —— 间距比圆本身还宽，读作三个孤立点。收：
  ```css
  .v4 .ov-grid{gap:calc(44*var(--u))}   /* 第 115 行 */
  ```
  实测：gap 60 → 44，卡左缘 152 / 604 / 1056 → 152 / 599 / 1045，宽 392 → 403。
- `.v4 .card:nth-child(2)` 第 117 行只把中间一张 `translateY(-46u)`，两侧齐平，弧线不成立。补两侧下沉（参考 Rauno 的错落）：
  ```css
  .v4 .card:nth-child(1),.v4 .card:nth-child(3){transform:translateY(calc(18*var(--u)))}   /* 18u 比 26u 更安全 */
  ```
  实测：卡底 749 → 767，与 `.ov-foot`（top 819）余量 70 → **52px**；用 26u 则余量只剩 44px。`docH` 仍 900。
- `.v4 .dt-main` 第 123 行 3 列 × 2 行，实测 chips 515×601、shots 468×601 双撑满，而 `.v4 .shot`（第 127 行）只有 96u，图位空一大截：
  ```css
  .v4 .shot{height:calc(140*var(--u))}   /* 第 127 行，96u → 140u */
  ```
  实测：`.shot` 96 → 140，`.shots-grid` 200 → 288，`.shot-note` 底 264 → 352，box 601 内余量 −249px，不溢出。

### 3.9 实测会坏的三件事（别做）

1. **v1 卡片里用 `aspect-ratio:16/9` 做流内图位**：实测卡高 390 → **563**，卡底 774 → **902**，把 `.ov-foot` 顶到 902、页脚底 943 > 900，16:9 画幅被撑破。要图位必须 `position:absolute` 或直接缩字号（见 v1 第一条）。
2. **`.dt{overflow:hidden}` 想「修切线」**：实测逐像素零变化（changedPixels 0 / 1440000），没有切线可修；它只改 `scrollHeight` 记账。
3. **v2 的 `.c-go` 加 `display:flex`**：实测 `.v2 .c-go` 宽 124（`white-space:nowrap` 的短链），`justify-content:space-between` 无空间可推，箭头间距仍 0px —— 该版只需保留 `margin-left:auto` 或改 40u。

## 4. 检索入口（可点开，但正文被反爬拦截，未据此摘录做法）

| 入口 | 网址 | 状态 |
|---|---|---|
| Awwwards · Gradient | https://www.awwwards.com/websites/gradient/ | web_fetch 200；截图时正文返回 Forbidden，无截图 |
| Awwwards · Data Visualization | https://www.awwwards.com/websites/data-visualization/ | web_fetch 200；同上 |
| Awwwards · Portfolio | https://www.awwwards.com/websites/portfolio/ | web_fetch 200 |
| Awwwards · Interactive | https://www.awwwards.com/websites/interactive/ | web_fetch 200 |
| Behance · interactive showcase 检索 | https://www.behance.net/search/projects?search=interactive%20showcase | 复验 fetch failed；已有实访截图 `21-behance-interactive.png`（5 列缩略图网格） |
| Dribbble · Popular | https://dribbble.com/shots/popular | 复验 HTTP 202（反爬）；已有实访截图 `22-dribbble-popular.png`（4 列瀑布卡） |
| DataV.GeoAtlas | https://datav.aliyun.com/portal/school/atlas/area_selector | 200 但仅 3250 字符，JS 应用空壳，无可摘录文本 |

## 5. 截图清单（1600×900 PNG，本机 Chrome headless 实访，共 24 个文件）

| 文件 | 字节 | 来源 |
|---|---|---|
| 01-linear-home.png | 164785 | linear.app |
| 02-linear-customers.png | 290359 | linear.app/customers |
| 03-stripe-home.png | 672437 | stripe.com |
| 04-vercel-home.png | 262693 | vercel.com |
| 05-framer-home.png | 215795 | framer.com |
| 06-rauno-portfolio.png | 76459 | rauno.me |
| 08-lusion.png | 736003 | lusion.co |
| 10-bruno-simon.png | 257723 | bruno-simon.com |
| 13-dataease.png | 448391 | dataease.io |
| 14-antv.png | 308380 | antv.antgroup.com |
| 15-zcool.png | 1134777 | zcool.com.cn |
| 16-apple-macbook-pro.png | 146517 | apple.com/macbook-pro |
| 18-zcool-datav-search.png | 740149 | zcool 检索「数据大屏」 |
| 19-codrops-gradient.png | 628698 | tympanus.net/codrops/tag/gradient |
| 21-behance-interactive.png | 1006895 | behance 检索页 |
| 22-dribbble-popular.png | 557891 | dribbble.com/shots/popular |
| local-v1-aurora-cards.png | 616181 | 本地 v1 总览 |
| local-v2-prism-steps.png | 613051 | 本地 v2 总览 |
| local-v3-split-panels.png | 756556 | 本地 v3 总览 |
| local-v4-orbit-deck.png | 766865 | 本地 v4 总览 |
| local-detail-p2-v1.png | 698733 | 本地 v1 详情 #p2 |
| local-detail-p2-v2.png | 804333 | 本地 v2 详情 #p2 |
| local-detail-p2-v3.png | 757773 | 本地 v3 详情 #p2 |
| local-detail-p2-v4.png | 824390 | 本地 v4 详情 #p2 |

无效截图（页面为 Forbidden / 浏览器不支持 / 空白 7KB 级）已删除，未列入本表：activetheory、immersive-garden、awwwards-gradient、codepen-trending、awwwards-data-visualization、resn。
