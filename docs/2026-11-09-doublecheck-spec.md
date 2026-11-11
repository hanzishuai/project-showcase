# 项目展示页 · Doublecheck 规格

> 记录：2026-11-09 · 共识轮次 2 · 依据两轮 ask_user_question 答案与 lead 2026-11-09 18:36/18:41 对齐消息。
> 本文件是规格记录，不是数据源；唯一数据源为 data/projects.json（README.md:10 保留说明）。

## Goal
交付静态 file:// 双击可开的单页 HTML：盘点 3 个项目文件夹、3 份 docx、7 张截图；展示名只留项目文件夹名，第二项只留「科技成果转化平台项目介绍」，省略 docx 标题「产教融合服务平台项目情况汇报」及并列展示；保留 data/projects.json 唯一源说明；status/progress/updatedAt 全为 null，links=[]；1 个汇总占位行「资料待上传」；阶段框架六段独立成段，项目阶段仅引用 docx 原话，省略 SDLC 映射；构建期内联 application/json，运行期零 fetch；少量入场动效，进度条零动画；HTML 无写死百分比、无空 href、无 onclick；CSS 首行 Hallmark stamp、:root token、overflow-x: clip、minmax(0,1fr)、overflow-wrap、:focus-visible、prefers-reduced-motion、无 JS 正文可见；JS 严格区分 progress === 0 与 progress == null。

## Scope
实现范围：pages/index.html、assets/css/*.css、assets/js/*.js、data/projects.json、scripts/build-data.mjs、assets/images 7 张；README.md 保留 data/projects.json 唯一源说明。data/projects.json 形状：meta.materials={projectFolders:3,docx:3,screenshots:7}，projects.length=3，字段 id/name/status/progress/updatedAt/links/stage/stageNote/content/dataNote/sourceFiles/screenshots；三个展示名「高校党组织管理平台项目介绍」「科技成果转化平台项目介绍」「科研项目申报系统简介」；status/progress/updatedAt 全 null，links=[]；sourceFiles 含 3 份 docx，screenshots 合计 7 张且与 SOURCE_IMAGES 一致；六段标签 需求分析、方案设计、开发实现、测试验证、部署上线、运维迭代；阶段原话至少「基于原型设计实现」「主要功能都已经做完，眼下还在边开发边修」「当前业务整体处于线下评审环节」。本子任务写入仅限 tests/2026-11-09-showcase.test.mjs、docs/2026-11-09-doublecheck-spec.md、docs/2026-11-09-doublecheck-spec-tool.md、docs/2026-11-09-project-showcase-spec.md、docs/2026-11-09-requirements-answers.md、_temp/2026-11-09-red-test-log-v2.md；其余只读，实现代码留给对应写入者。范围外：真实项目总数推断、状态/进度/日期/链接取值、百分比、SDLC 映射、后端、数据库、登录、联网字体、CDN、外部 fetch、git commit/push。

## Acceptance criteria
1) node --test tests/2026-11-09-showcase.test.mjs 在 RED 阶段 exitCode=1 且 fail>0；2) data/projects.json 可解析，meta/projects 形状与 3/3/7、3 个 null 字段、3 条记录、links=[] 一致；3) pages/index.html 静态可见文本含三展示名、data/projects.json 唯一源说明、3/3/7、恰好 1 次「资料待上传」、六段标签、三段 docx 原话、「—」；4) 页面含「科技成果转化平台项目介绍」，省略「产教融合服务平台项目情况汇报」与「并列」；5) HTML 有 <script id="projects" type="application/json"> 且与 data/projects.json 深相等，scripts/build-data.mjs 读唯一源写内联，零 fetch；6) HTML 可见文本与属性零写死百分比、零 href=""、零 href="#"、零 onclick、零 javascript:；7) CSS 首非空行 Hallmark stamp，聚合样式含 :root token、overflow-x: clip、minmax(0,1fr)、overflow-wrap、:focus-visible、prefers-reduced-motion，含 opacity 入场，零 transition: all、零 width/scaleX 进度动画；8) assets/js 含 progress === 0 与 progress == null，零 requestAnimationFrame/setInterval/fetch；9) assets/images 恰好 7 张且 HTML 引用；10) 无 JS 正文可见，6 个 data-stage 独立块，页面零 SDLC、零映射；11) null 显示 —，0 与 null 用 aria-label 区分；12) 写入后逐文件 read 回读，日志落 _temp/2026-11-09-red-test-log-v2.md。

## Failure modes
实现文件缺失即 RED；data 损坏、内联不一致、fetch、非 null 字段、0/null 混同、写死百分比、docx 标题并列、SDLC 映射、占位行多或入数组、盘点写成 2/2/7、脚本关闭正文消失、动效减弱/进度条动画、空 href/onclick、CSS 缺项、多 agent 同改、doublecheck_spec 返回 written:false/path:null 均须有对应断言或回读证据。

## Priorities
第一优先：资料真实性与 data/projects.json 唯一源、无编造指标、缺失诚实占位。第二优先：静态可读、无 JS 正文可见、file:// 双击可开。第三优先：视觉装饰与少量入场动效。冲突时取舍：真实数据 > 静态可读 > 视觉装饰 > 交互数量；质量门禁 > 速度。

## Non-goals
非目标：不推断真实项目总数；不编造 status、progress 百分比、updatedAt、links、客户墙、评价、指标磁贴；不把截图里的 8/8、15/15、4/4、9/9、3/12、21 条、20 条、8 人、420 题、60 分当软件开发进度；不把 docx 叙述日期折算百分比；不做 docx 标题并列展示、SDLC 映射；不做后台、数据库、登录、联网字体、CDN、外部 fetch；不动画 width/height/top/left、transition: all、scale(0)；不创建 git commit 或 push；本子任务不写实现代码、不写范围外文件。
