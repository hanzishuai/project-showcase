# 配色与顶部导航改版 · 交付报告（2026-11-10）

机主反馈（2026-11-10）：「这个结构挺好的，就是页面颜色搭配不是很好，还有顶部的导航也不是很好」。经弹窗确认三项并全部采用推荐：冷墨蓝 × 纸白 / 顶部单行节点条 + 项目切换 / 备注收进悬停提示。正文结构（三个项目、六段阶段、粘性事实清单、带图注证据、DOCX 原话）一字未动，只改色板、顶部导航与描述导航的文案。

## 1. 改了哪些文件

| 文件 | 作用 | 状态 |
| --- | --- | --- |
| `templates/index.template.html` | 唯一页面模板（47 988 B）。Hallmark stamp 改 `theme: Blueprint Ink / seed nav-color-2026-11-10 / draw: c1d8ee`；`:root` 23 个色板 token 全换成冷墨蓝系；导航 HTML 由 3 行 18 格改为 3 个项目按钮 + 每行 6 节点且仅当前项目显示；节点备注进 `title`；新增 `.proj-switch` / `.nav-bar` / `.nav-row.on` 样式与项目切换 JS | 已改 |
| `pages/index.html` | 正式页（59 460 B，SHA-256 `8ba1c81cc0c5343726289a8cfb5fb45b656791f828ad84690bccda354a2820cf`） | 已重建 |
| `README.md` | 首段与验证脚本路径同步为单行节点条与本轮脚本 | 已改 |
| `_temp/2026-11-10-nav-color-verify.mjs` | 32 项无头 Chrome 实测脚本（含切项目后点节点） | 新建 |
| `_temp/2026-11-10-nav-color-negative-control.mjs` / `.html` / `.json` | 应失败反例（由正式页故意破坏 3 处色板/导航规则） | 新建 |
| `_temp/2026-11-10-nav-color-sloplint-final.json` / `.txt`、`.json`（r2、初版） | Hallmark 渲染门三轮证据 | 新建 |
| `_temp/2026-11-10-nav-color-test-tap-final.txt` | 15/15 测试 TAP 捕获 | 新建 |
| `previews/2026-11-10-nav-color-01..07-*.png` | 桌面首屏、切换态、点节点、点项目、全页、390px 手机、1920 共 7 张 | 新建 |
| `pages/.hallmark/shots/index-*.png` | 渲染门 5 张（1280×800 / 1440×900 / 1920×1080 折线，1440 与 375 全页） | 已刷新 |
| `docs/2026-11-10-nav-color-delivery-report.md` | 本报告 | 新建 |

`data/projects.json`、`assets/css/*`、`assets/js/*`、`scripts/build-data.mjs`、`tests/2026-11-09-showcase.test.mjs`、`archive/` 全部**未改动**：唯一数据源与 15 项回归契约保持原样；`archive/2026-11-09-index-pre-ppt/` 仍可用于回退。

## 2. 配色改了什么

- 旧：Dossier Ink，深棕 `#1c1b18` + 砖红 `#9a3b25` + 土橙 `#e8a06a`，暖色互相打架，浅灰小字对比度偏低。
- 新：Blueprint Ink。导航底 `--c2:#16233a`（冷墨蓝），正文纸白 `--c1:#f7f6f2`，主墨 `--c3:#2f5d8c`（靛蓝），琥珀 `--c7:#e8b877` **只**用于当前项目按钮、当前节点、HUD 与进度线（唯一强调色）。边框/次级文字换成蓝灰梯度 `#47536b / #aebbd0 / #c9d3e2`。
- 焦点环按底色分区：正文 `:focus-visible` 用靛蓝（纸白上 6.34:1），导航内 `.topnav :focus-visible` 用琥珀（墨蓝上 8.65:1），避免旧版琥珀在纸白上仅 1.68:1 的 26a 失败。

## 3. 顶部导航改了什么

- 旧：3 行 × (项目名 + 6 个节点)，每格两行小字，桌面高 273px（近首屏 1/3），手机 317px，信息密度过高。
- 新：单行节点条。左侧 3 个短项目按钮（`01 党组织 / 02 成果转化 / 03 项目申报`，`white-space:nowrap`），右侧只显示当前项目 6 个阶段节点，非当前行 `display:none`。桌面高 **102px**（降 171px，−63%），手机 **234px**（3 列 × 2 行）。
- 每个节点的备注（「文档未给结构化阶段」「原话：基于原型设计实现」等）从可见第二行移进 `title`，悬停可见，禁用 JS 时仍是静态锚点。18 个节点、`a.proj` 3 个、`.nav-row` 4 个、`.rail a` 18 个全部保留。
- HUD、方向键（←/→ 跨项目顺序翻节点）、数字键 1/2/3 切项目、滚轮进度线、滚动高亮、`scroll-margin-top` 随 `--navh` 自适应，全部沿用并在实测中逐项复验。
- 文案同步：kicker、dek、3 处 node-note、footer、README 里的「顶部 3 行分组」「顶部 3 行项目节点地图」改为「顶部单行节点条与项目切换」，footer 注明 2026-11-10 更新配色与导航。

## 4. 怎么生效

- **直接生效**：双击 `pages/index.html`（`file://`）。纯静态 HTML，内联 JSON，运行期零 `fetch`、零 CDN、零联网请求；禁用 JS 正文与 18 个节点仍完整可见。刷新浏览器即见新配色，无需重启任何服务或热更新。
- **改数据后重建**：编辑 `data/projects.json` → `node scripts/build-data.mjs` → 刷新。本轮已真跑 3 次，最后一次输出 `WROTE .../pages/index.html`、`PROJECTS 3`、`SOURCE data/projects.json`。
- **回退**：按 `archive/2026-11-09-index-pre-ppt/_索引.md` 逐字节复制回 10 个文件。

## 5. 验收实测（全部在最终 59 460 B 页面上复跑）

| 检查 | 结果 |
| --- | --- |
| 15 项回归 `node --test` | `✔=15 ✖=0 NOT_OK=0` |
| Hallmark `--genre editorial --scope page --stage page --render --json` | `{"fails":0,"reflex":0,"warns":0,"waived":0,"files":1,"render":"ran"}`、`findings: []` |
| 32 项浏览器实测 `_temp/2026-11-10-nav-color-verify.mjs` | `VERIFY_EXIT=0`、`CHECKS 32 FAILED 0`、`ERRORS []` |
| 导航尺寸 | 桌面 `navH=102`、手机 `234`；1280/1440/1920/390 四档 `scrollW===innerW` 无横向溢出 |
| 跳转链路 | 切 02 → 点 `#p2-s4` → `y=8384`、HUD「02 科技成果转化平台 / 测试验证」、进度 60.13%；点 03 → `#p3`；`ArrowRight` → `#p3-s2`；`1` → `#p1-s1` 且仅 p1 行显示；滚轮 `y=2449`、进度 17.57% |
| 视觉与资源 | 导航底色实测 `rgb(22, 35, 58)`、节点高亮 `rgb(232, 184, 119)`；7/7 张截图加载成功（1897/1907/1908/1920×4）；`badHrefs=[]`；内联 JSON 3 项目；素材 `3 / 3 / 7` |
| 无 JS 与禁用态 | `chars=8115`、3 展示名、18 节点齐全；禁用 JS 无页面错误 |
| 应失败反例 | 由正式页故意改 3 处（`--c2` 回棕、`.nav-row` 全显示、焦点环回琥珀）→ 3 条「应失败」断言全部命中：`navBg=rgb(28, 27, 24)`、`visibleRows=3`、`navH=190`，证明检查有分辨力 |

## 6. 诚实清单

- 首轮渲染门有 10 条 FAIL（7 条 26a 焦点环对比度、3 条 49a 768px 项目按钮折行），已按源码真修：焦点环分底色、`.proj-switch a` 加 `nowrap`、1100px 断点列宽 212→248px；复跑 0/0/0。不是降门槛或换体裁。
- 文案同步后第一次复跑出现 1 条 54 FAIL（kicker 由 33 字缩到 30 字，落进 eyebrow 长度窗口），把 kicker 补到 58 字后复跑 0/0/0；属于真修，不是 waive。
- 早期用 `process.execPath` 跑子进程拿到过全绿假阳性（实为 Electron 宿主），本轮所有构建/测试/lint 均在 `run_code` 的 Node v24 内 `await import` 真跑，输出经 stdout 捕获后解析。
- lint JSON 前有 `render tier: 5 screenshots ...` 文本行，解析时须从首个 `{` 起切片，否则 `Unexpected token`；本轮已按此处理并保存干净 JSON。
- 截图 `previews/2026-11-10-nav-color-02-switch.png` 是切项目瞬间的平滑滚动中间态（`html{scroll-behavior:smooth}`），不是缺陷；落位后的 `03-p2s4.png` 为最终态。
- 本机 `process.env` 在 `run_code` 内起始为空，puppeteer 首次报 `mkdtemp 'undefined\temp\...'`，补 `TEMP/TMP/USERPROFILE/LOCALAPPDATA/APPDATA/SystemRoot` 后正常。

## 7. 证据索引

- `_temp/2026-11-10-nav-color-sloplint-final.json`（0/0/0）、`-final.txt`（原始捕获）、`-r2.json`（修 26a/49a 后）、`.json`（初版 10 条 FAIL）
- `_temp/2026-11-10-nav-color-verify.json`（32 项逐条 ok）、`-test-tap-final.txt`（15 行 ✔）
- `_temp/2026-11-10-nav-color-negative-control.json`（反例 3/3 命中）
- `previews/2026-11-10-nav-color-01-hero.png`（1440×900 首屏）、`-06-phone.png`（390×844）、`-02-switch.png`、`-03-p2s4.png`、`-04-p3.png`、`-05-full.png`、`-07-1920.png`
- `pages/.hallmark/shots/index-1280x800.png` / `index-1440x900.png` / `index-1920x1080.png` / `index-1440-full.png` / `index-375.png`