# 正式页替换 · 最终交付报告（2026-11-10）

机主在 2026-11-09 选择「用这版替换正式页（推荐）」：把 18 节点顶部导航重设计从 `design-variants/` 样张落地为 `pages/index.html`。本报告记录改动、生效方式与全部实测验收结果。

## 1. 改了哪些文件

| 文件 | 作用 | 状态 |
| --- | --- | --- |
| `templates/index.template.html` | 唯一页面模板（47 535 B）。含 Hallmark stamp（shape: workbench / genre: editorial / theme: Dossier Ink / hero: poster）、`:root` 23 个色板与字体 token、4px 间距刻度、`data-stage` 六段框架、`/*__PROJECTS_JSON__*/` 注入占位 | 新建并两轮真修 |
| `scripts/build-data.mjs` | 构建期读 `data/projects.json`，把 JSON 内联进模板 `<script id="projects" type="application/json">`，写出 `pages/index.html` | 已改，真 node 实跑通过 |
| `pages/index.html` | 正式页（59 007 B，SHA-256 前 16 位 `c16f5f83b00700ae`） | 已重建并替换 |
| `README.md` | 说明唯一数据源、文件清单、构建与验证命令、回退方式 | 已重写 |
| `archive/2026-11-09-index-pre-ppt/` | 旧版 10 个文件逐字节备份 + `_索引.md` | 只读归档 |
| `_temp/2026-11-09-landing-sloplint-final.json` / `.txt` | Hallmark `--render` 干净 JSON 与原始捕获 | 验收证据 |
| `_temp/2026-11-09-final-nav-verify.json` | 三种跳转 + 无 JS + 完整性实测 | 验收证据 |
| `previews/2026-11-09-final-nav-01..05-*.png` | 桌面首屏、点击 p2-s4、点击 p3、全页、390px 手机共 5 张 | 验收截图 |
| `pages/.hallmark/shots/index-*.png` | Hallmark 渲染门 5 张（1280×800 / 1440×900 / 1920×1080 折线，1440 与 375 全页） | 验收截图 |
| `docs/2026-11-10-final-delivery-report.md` | 本报告 | 新建 |

`data/projects.json`、`assets/css/*`、`assets/js/*`、`tests/2026-11-09-showcase.test.mjs` 均**未改动**：数据源保持唯一，CSS/JS 基线保持不动，测试仍为原 15 项。

## 2. 怎么生效

- **直接打开**：双击 `pages/index.html` 即可（`file://`）。正文、18 个节点、3 个项目卡、6 段阶段、7 张截图全是静态 HTML；项目数据以构建期内联 JSON 提供，运行期零 `fetch`、零外部 CDN、零联网请求。禁用 JS 时正文仍完整可见。
- **改数据后重建**：编辑 `data/projects.json`，然后在工作区执行 `node scripts/build-data.mjs`，会重新生成 `pages/index.html`。已用真实 `node.exe`（v16.13.1）实跑：`BUILD_REAL_EXIT=0`、`WROTE .../pages/index.html`、`PROJECTS 3`、`SOURCE data/projects.json`，产物 SHA 与页面逐字节一致（`BUILD_IDENTICAL=true`）。
- **无需重启任何服务**：本页是纯静态文件，无 dev server、无热更新依赖；刷新浏览器即可看到新版本。
- **回退**：按 `archive/2026-11-09-index-pre-ppt/_索引.md` 逐字节恢复 10 个文件即可回到替换前状态。

## 3. 验收实测结果

| 项目 | 实测值 |
| --- | --- |
| `node --test tests/2026-11-09-showcase.test.mjs` | 15/15 通过（`PASS_MARKS=15`、`FAIL_MARKS=0`、`NOT_OK=0`） |
| Hallmark `sloplint.mjs pages/index.html --genre editorial --scope page --stage page --render --json` | `{"fails":0,"reflex":0,"warns":0,"files":1,"render":"ran"}`，`findings: []`，5 张渲染截图落盘 |
| 初始态 | `y=0`、`active=#p1-s1`、HUD「01 高校党组织管理平台 / 需求分析」 |
| 点击节点 | `#p2-s4` → `y=8268`、HUD「02 科技成果转化平台 / 测试验证」、进度 58.58%；`#p3` → `y=11209`、HUD「03 科研项目申报系统 / 需求分析」 |
| 键盘 | `ArrowRight` → `#p3-s2`；`1` → `#p1-s1` |
| 滚轮 | `scrollBy(0,700)` → `y=2490`、进度 17.64% |
| 390px 手机 | `scrollW=390`=`innerW`（无横向溢出）、导航高 317px、`h1=38px` |
| 页面完整性 | `ERRORS []`；`badHrefs=[]`；内联 `projects=3`；`materials={projectFolders:3,docx:3,screenshots:7}`；7/7 张截图加载成功（宽度 1897/1907/1908/1920×4） |
| 无 JS | 正文 8261 字符、3 个展示名、18 个节点仍在 |
| 结构 | 18 个 `a.node`、3 个 `a.proj`、4 行导航、18 个阶段块、18 个 rail 节点、页面高 15013px（1440 宽） |

### 首轮 202 条 findings 的真修（不换体裁、不降门槛）

- gate 48（103 条）：把 23 个颜色 hex 提到 `:root` token，`font-family` 改 `var(--font-body)`/`var(--font-display)`，删内联 `style=` 颜色字面量。
- gate 24b（50 条）：所有 `padding`/`margin`/`gap` 数值对齐 4px 刻度。
- gate 67（14 条）：删全部 16 处 `letter-spacing`，把 `PROJECT 0X` / `STAGE 0X` / `FACT SHEET` 等全大写英文小标签改成中文或句首大写。
- gate 40（10 条）：浅底小字 `#78746b`/`#989184` → `#5c584e`（对比度由 4.06 升到 6.18），深底小字 `#8d867b` → `#b9b2a3`（7.35）。
- gate 63（8 条）：同一文本节点内 ` · ` 少于 2 个，删 3 个 `a.proj` 末尾的 `›`。
- gate 54/50/7a/58/44b/44c/44d/75/3/77/F3/F22/F23 等：合并 eyebrow 为长段、`.layout` 用 `minmax(0,1fr)`、纯白改 `#f7f3e9`、包 `section.hero` + CTA 紧跟 `h1`、stamp 声明 `hero: poster` 使 `freeFold=true`、`a:active` 焦点反馈、`h1{text-wrap:balance}`、去 `text-align:justify`、`text-align:left`、字号提到 ≥12px、`:focus-visible`、`overflow-x:clip`。
- 最后 2 条 REFLEX：`.hero-cta` padding `8px 16px` → `12px 16px`（控件高 40px → 48px，满足 44–52px）；`.nav-row a.node` padding `4px 8px` → `8px 8px`（文字到上边缘由 3px → 约 7px，满足 `end=3.5`）。

## 4. 诚实清单（被推翻的旧结论 / 环境限制）

- 早期用 `cp.spawnSync(process.execPath, ...)` 得到的 `BUILD_EXIT=0` / `TEST_EXIT=0` / `LINT_EXIT=0` **全部是假阳性**：`process.execPath` 是 Electron 宿主 `DeepSeek Harness.exe`，不是 Node CLI，脚本根本没执行、`stdout` 只有 2 字节。已改为在 run_code（Node v24.21.0）内 `await import(...)` 真跑，并用真实 `node.exe` 复核构建链。
- 本机 `node.exe`（v16.13.1）无 `node:test`，故 15 项测试在 v24 运行时内执行；构建脚本与三跳转验证在两处都通过。
- 本会话 SDK 未暴露 `compress` / `present` 等上下文与发布工具，交付以文件落盘 + 本报告的 Markdown 路径引用为准。
- 归档目录与 `docs/` 下 12 份历史规格文档保持只读，未改动。

## 5. 证据索引

- `_temp/2026-11-09-landing-sloplint-final.json`（0/0/0 干净 JSON）、`_temp/2026-11-09-landing-sloplint-final.txt`（含 render tier 行）
- `_temp/2026-11-09-landing-sloplint.json`（首轮 202 条 findings，修前基线）
- `_temp/2026-11-09-final-nav-verify.json`（三种跳转 + INTEGRITY）
- `previews/2026-11-09-final-nav-01-hero.png`、`-02-p2s4.png`、`-03-p3.png`、`-04-full.png`、`-05-phone.png`
- `archive/2026-11-09-index-pre-ppt/_索引.md`
