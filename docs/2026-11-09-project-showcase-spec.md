# 项目展示页 · 交付规格（2026-11-09 两轮共识）

> 状态：规格已定，实现待 RED→GREEN。
> 唯一数据源：data/projects.json（README.md:10 保留说明，本子任务只读不改写）。
> 依据：docs/2026-11-09-requirements-answers.md、docs/2026-11-09-doublecheck-spec.md、lead 2026-11-09 对齐消息。

## 1. 资料盘点
- 3 个项目文件夹、3 份 docx、7 张截图。
- 三个展示名：「高校党组织管理平台项目介绍」「科技成果转化平台项目介绍」「科研项目申报系统简介」。
- 第二项展示名只留「科技成果转化平台项目介绍」；省略 docx 标题「产教融合服务平台项目情况汇报」，不做并列展示、不写「并列」。
- 资料完整性声明写明 3/3/7，并保留 data/projects.json 唯一源说明。

## 2. 数据契约
- data/projects.json 是唯一数据源；data/ 下只允许 projects.json 一个 JSON 数据源，不回退 data/projects.js。
- meta.materials = { projectFolders: 3, docx: 3, screenshots: 7 }。
- projects 恰好 3 条；字段 id/name/status/progress/updatedAt/links/stage/stageNote/content/dataNote/sourceFiles/screenshots。
- status/progress/updatedAt 全为 null；links=[]；不得编造状态、百分比、日期、外链。
- 1 个汇总占位行「资料待上传」只在页面汇总出现，不进入 projects 数组。
- sourceFiles 含 3 份 docx；screenshots 合计 7 张，文件名与 SOURCE_IMAGES 一致。
- stage/stageNote 仅引用 docx 原话，不出现 SDLC、映射、并列。

## 3. 阶段框架
- 六段独立成段：需求分析、方案设计、开发实现、测试验证、部署上线、运维迭代。
- 页面使用 6 个独立 data-stage 块承载框架。
- 项目阶段只引用 docx 原话，至少包含：
  ~~~text
  基于原型设计实现
  主要功能都已经做完，眼下还在边开发边修
  当前业务整体处于线下评审环节
  ~~~
- 省略 SDLC 映射；页面不出现 SDLC、映射。

## 4. 静态交付与内联数据
- 静态 file:// 双击可开；单页 pages/index.html + 本地 assets，无外网、无 CDN、无联网字体。
- 构建期由 scripts/build-data.mjs 读取 data/projects.json，把同一份 JSON 内联进 pages/index.html 的 <script id="projects" type="application/json">。
- 运行期零 fetch；HTML、JS、构建脚本均不得出现 fetch(。
- 无 JS 时正文、三展示名、阶段框架、资料声明、— 仍可见。

## 5. 视觉、动效与可访问性
- CSS 首个非空行为 Hallmark stamp；所有颜色/字体走 :root token。
- 聚合 CSS 含 overflow-x: clip、minmax(0,1fr)、overflow-wrap、:focus-visible、prefers-reduced-motion。
- 允许少量 opacity 入场动效；进度条零动画。
- 禁止 transition: all、width/scaleX/transform 进度动画、动画 width/height/top/left、scale(0)。
- 缺失值显示 —；真实 0 与 null 用 aria-label 严格区分；不得出现 0% 假象。

## 6. HTML/JS 约束
- HTML 可见文本与属性零写死百分比；零 href=""、零 href="#"、零 onclick、零 javascript:。
- JS 严格区分 progress === 0 与 progress == null；零 requestAnimationFrame、零 setInterval、零 fetch。
- 链接/按钮可用或隐藏，不留空 href、不写 onclick。
- 7 张截图复制到 assets/images 且 HTML 引用。

## 7. 验收门禁
- 先重写 tests/2026-11-09-showcase.test.mjs，使其对当前缺失实现真实失败。
- 用 load_workspace_dependencies 返回的 node 跑 node --test tests/2026-11-09-showcase.test.mjs，实测 exitCode 1 且 fail>0。
- RED 日志写 _temp/2026-11-09-red-test-log-v2.md。
- 写入文件逐份 read 回读自证；最后 send_message 给 lead。
