# 项目展示页 · 交付与对抗复核报告（2026-11-09）

> 结论：交付通过。页面、数据、样式、脚本、7 张截图、3 张预览与验收记录均已落盘；静态 `file://` 双击可开，改数据后重建即可生效，无需重启服务。

## 1. 交付物

| 文件 | 作用 |
|---|---|
| `pages/index.html` | 单页成品，274 行左右，3 个项目 + 1 行「资料待上传」占位，6 段阶段框架，7 张界面截图 |
| `data/projects.json` | 唯一数据源；meta + projects[3]，status/progress/updatedAt 全为 null，links 为空 |
| `scripts/build-data.mjs` | 构建期读取唯一数据源，内联 application/json 后生成 pages/index.html |
| `assets/css/tokens.css`、`assets/css/base.css`、`assets/css/showcase.css` | Wayfind「墨线台账」样式，3 个首行 Hallmark stamp，token 化颜色/字体 |
| `assets/js/showcase.js` | 只读内联 JSON，严格区分 progress === 0 与 progress == null |
| `assets/images/` | 7 张原图按同名复制，源/目标字节逐一相等 |
| `design/2026-11-09-picks.md` | Deal 1/3 Wayfind、Draw f6a7b8、Workbench/Ledge、57 类契约与验证记录 |
| `docs/2026-11-09-requirements-answers.md`、`docs/2026-11-09-doublecheck-spec.md`、`docs/2026-11-09-project-showcase-spec.md` | 两轮需求共识与六维规格 |
| `previews/2026-11-09-showcase-hero.png`、`previews/2026-11-09-showcase-desktop.png`、`previews/2026-11-09-showcase-phone.png` | 1280×800 首屏、1440×7867 桌面全页、390×11120 手机全页 |
| `tests/2026-11-09-showcase.test.mjs` | 15 项回归测试 |

## 2. 验证时间线（真跑实测）

1. RED：`node --test` 首次 11 项失败，全部为实现产物缺失，日志 `_temp/2026-11-09-red-test-log.md`。
2. RED v2：更新 3 项目契约后 15 项中 4 pass / 11 fail；CSS 修复后 5 pass / 10 fail。
3. GREEN：`node --test --test-reporter=tap tests\2026-11-09-showcase.test.mjs` → `# tests 15 | # pass 15 | # fail 0 | # duration_ms 126.153`。
4. Hallmark 静态门：0 FAIL / 0 REFLEX / 0 WARN。
5. Hallmark 渲染门首跑：3 FAIL + 8 REFLEX + 1 WARN，根因是 `file://` 下 CSS @import 被拦导致样式全失效；改 3 个独立 link、修正 CSS 首 3 行非法注释后复跑 2 FAIL + 2 REFLEX；再修墨底对比度、h4 默认 margin、figure 内边距后复跑：`{"fails":0,"reflex":0,"warns":0,"files":4,"render":"ran"}`。
6. 浏览器真跑：`_temp/2026-11-09-final-runtime-check.json` 记录 desktop 1440、phone 375、禁用 JS 三组。三组均为 overflow=0、占位行 1 次、— 可见、6 个 data-stage、7 个 figure、3 个项目名、本地链接全部存在；8 张 img（含首屏复用 1 张）全部 complete 且 naturalWidth>0。懒加载曾导致首轮预览缺图，已把图注 loading 改 eager 后复测全绿。
7. 预览：capture.mjs 重生成 3 张，人工查看首屏与全页图，版式、截图、墨底图注与手机单列均正常。

## 3. 对抗复核（按六维规格找反例）

| 反对意见 | 核对证据 | 结论 |
|---|---|---|
| 「所有项目」被写成 3 个，漏了未上传项目 | 共识答案为「为未上传项目留占位」；页面有且仅有 1 行「资料待上传」，不进入 projects 数组 | 通过 |
| 把截图中的 20 条、8/8、3/12、379 条等业务数字当进度 | `data/projects.json` 的 status/progress/updatedAt 全 null；每个截图 note 标注演示业务数据；测试禁止写死百分比 | 通过 |
| 目录名「科技成果转化平台项目介绍」与 docx 标题冲突 | 按共识只用目录名展示，页面不出现「产教融合服务平台项目情况汇报」与「并列」 | 通过 |
| file:// 双击打不开或样式丢失 | 3 个独立 stylesheet link；实测 h1=84px、h2=52px、btn=44px、gutter=64px；无 fetch、无外部 href/src | 通过 |
| 禁用 JS 后正文不可见 | 禁用 JS 实测 textLength=4449、— 可见、6 阶段、3 项目名、全部图片加载 | 通过 |
| 进度条把缺失值画成 0% | JS 的 `if (progress === 0)` 与 `else if (progress == null)` 分开；null 时轨道留空、aria-label「进度未提供」 | 通过 |
| 动效违反 animate 约束 | 仅 `@keyframes wayfind-settle` 纯 opacity 入场，reduced-motion 全停，进度条零动画 | 通过 |
| 外部调研来源被删 | 9 条标题与 URL 以文本列在「数据与调研来源」，测试禁止外链属性但来源信息保留 | 通过 |
| 第三项目没有截图却留空区 | 显示「外部截图未提供。」，诚实且不虚构 | 通过 |
| 预览仍是旧样式 | 删除旧 6 张同名前缀图，最终只剩 3 张按最终 CSS 生成 | 通过 |

## 4. 诚实清单

- `doublecheck_spec` 与 `doublecheck_report` 工具返回 `written:false / path:null / verdict:grill`（工具台账未落盘），故本报告由 Lead 手工写盘并以上述真跑证据自证；六维规格另见 `docs/2026-11-09-doublecheck-spec.md`。
- 3 份 docx 未提供 status、progress 百分比、updatedAt、links；页面显示 — 并留空进度轨道，不折算 10 月 27 日、11 月 13 日等叙述日期。
- 科研项目申报系统简介的 docx 提到 5 张内嵌截图，项目目录未附外部截图文件，页面标注「外部截图未提供。」
- 视觉服务对 4 张 PNG 曾两次超时，最终用 read_image 原图像素 + modlens_read_image OCR 完成，逐字转录见 `_temp/2026-11-09-screenshots-ocr.md`。
- 未执行 git commit / push。

## 5. 生效方式

- 直接双击 `pages/index.html`，静态文件刷新即生效，无服务、无重启。
- 修改 `data/projects.json` 后运行 `node scripts/build-data.mjs` 重建 `pages/index.html`；`data/projects.js` 已删除，不再回退。

## 6. 交付后最终 Green Gate 复跑（2026-11-09 20:24 后）

- `node --test --test-reporter=tap tests\2026-11-09-showcase.test.mjs`：`TEST_EXIT=0`、`# tests 15 | # pass 15 | # fail 0 | # duration_ms 133.3163`、`FAILING_LINES=0`；原始输出 `_temp/2026-11-09-green-gate-final.txt`。
- `sloplint.mjs ... --render --json`：`LINT_EXIT=0`、`{"fails":0,"reflex":0,"warns":0,"files":4,"render":"ran"}`；原始输出 `_temp/2026-11-09-sloplint-green-gate.json`。
- 浏览器运行时三组（desktop 1440 / phone 375 / 禁用 JS）：`overflow=0`、图片全部加载、本地链接全部存在、占位行 1 次、`data-stage` 6 个；原始输出 `_temp/2026-11-09-runtime-green-gate.json`。
