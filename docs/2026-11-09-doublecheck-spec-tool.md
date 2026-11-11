# doublecheck_spec 工具回显 · 手工落盘

> 调用：doublecheck_spec({ filePath: "docs/2026-11-09-doublecheck-spec-tool.md", goal: ..., scope: ..., acceptanceCriteria: ..., failureModes: ..., priorities: ..., nonGoals: ... })
> 返回：written:false，path:null
> 处理：按派单规则手工写盘，并用 read 回读自证。

## Goal
静态 file:// 双击可开的单页 HTML；3 个项目文件夹、3 份 docx、7 张截图；展示名只留「科技成果转化平台项目介绍」并省略 docx 标题「产教融合服务平台项目情况汇报」及并列展示；保留 data/projects.json 唯一源说明；status/progress/updatedAt 全 null，links=[]；1 个汇总占位行「资料待上传」；六段阶段框架独立成段，项目阶段仅引用 docx 原话，省略 SDLC 映射；构建期内联 application/json，运行期零 fetch；少量入场动效，进度条零动画；HTML 无写死百分比、无空 href、无 onclick；CSS 首行 Hallmark stamp、:root token、overflow-x: clip、minmax(0,1fr)、overflow-wrap、:focus-visible、prefers-reduced-motion、无 JS 正文可见；JS 严格区分 progress === 0 与 progress == null。

## Scope
实现范围 pages/index.html、assets/css/*.css、assets/js/*.js、data/projects.json、scripts/build-data.mjs、assets/images 7 张；README.md 保留唯一源说明；meta.materials 为 3/3/7；projects 3 条；字段 id/name/status/progress/updatedAt/links/stage/stageNote/content/dataNote/sourceFiles/screenshots；三个展示名；六段标签；三段 docx 原话。本子任务写入仅限 6 个文件，其余只读，不写实现代码。范围外为真实项目总数推断、状态/进度/日期/链接取值、百分比、SDLC 映射、后端、数据库、登录、联网字体、CDN、外部 fetch、git commit/push。

## Acceptance criteria
node --test RED exitCode=1/fail>0；data/projects.json 可解析且形状与 3/3/7、3 个 null 字段、3 条记录一致；pages/index.html 静态可见文本含三展示名、唯一源说明、3/3/7、恰好 1 次「资料待上传」、六段标签、三段 docx 原话、「—」；含「科技成果转化平台项目介绍」并省略「产教融合服务平台项目情况汇报」与「并列」；HTML 有 <script id="projects" type="application/json"> 且与 data/projects.json 深相等，scripts/build-data.mjs 读唯一源写内联，零 fetch；HTML 可见文本与属性零写死百分比、零 href=""、零 href="#"、零 onclick、零 javascript:；CSS 首非空行 Hallmark stamp，聚合样式含 :root token、overflow-x: clip、minmax(0,1fr)、overflow-wrap、:focus-visible、prefers-reduced-motion，含 opacity 入场，零 transition: all、零 width/scaleX 进度动画；assets/js 含 progress === 0 与 progress == null，零 requestAnimationFrame/setInterval/fetch；assets/images 恰好 7 张且 HTML 引用；无 JS 正文可见；6 个 data-stage 独立块，页面零 SDLC、零映射；null 显示 —，0 与 null 用 aria-label 区分；写入后逐文件 read 回读，日志落 _temp/2026-11-09-red-test-log-v2.md。

## Failure modes
实现文件缺失即 RED；data 损坏、内联不一致、fetch、非 null 字段、0/null 混同、写死百分比、docx 标题并列、SDLC 映射、占位行多或入数组、盘点写成 2/2/7、脚本关闭正文消失、动效减弱/进度条动画、空 href/onclick、CSS 缺项、多 agent 同改、written:false/path:null 均须有对应断言或回读证据。

## Priorities
真实数据 > 静态可读 > 视觉装饰 > 交互数量；质量门禁 > 速度。

## Non-goals
不推断真实项目总数；不编造 status、progress 百分比、updatedAt、links、业务数字折算；不做 docx 标题并列、SDLC 映射；不做联网依赖、进度条动画、空 href/onclick；本子任务不写实现代码、不写范围外文件、不创建 git commit/push。
