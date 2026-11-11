# PPT 式整屏项目进度页 · 需求澄清草案（2026-11-09）

> 状态：**待机主拍板**。正式实现文件保持原样；`previews/2026-11-09-ppt-effect-demo.html` 仅作效果预览，与正式实现解耦。

## 一、已确认（机主原话）

- (m00622)「不是这样的，是跟ppt那种。滑动的，然后上面是项目到哪一步了，上面会显示很多节点，点这些节点，项目就跳转到对应的界面。」
- (m00625)「先去网上查资料，看看别人怎么写的，先让我看一下效果，我说动手再动手。」
- (m00643)「https://chenxiachan.github.io/thoughtdag/ 参考这个网页开头的滚轮画面」
- (m00700) 弹窗选择「按这个效果动手（推荐）」；随后 (m00701)「怎么不用superpowers先把我想要的搞清楚？」

## 二、流程纠正（本轮补做）

上一轮加载了 `brainstorming` 与 `self-improving-agent`，却先产出样张、后置了需求澄清。加载技能不等于执行澄清。本轮按 `using-superpowers` → `brainstorming` → `grill-requirements` 的顺序补前置：用结构化弹窗逐批问清六维，达成共识后把规格定稿，再进入实现。

动手顺序改为：**需求澄清 → 共识规格定稿 → 实施计划 → RED/GREEN → Hallmark `--render` → 交付证明**。

## 三、六维规格（☐ 为待确认）

| 维度 | 当前内容 |
| --- | --- |
| Goal | 一页 PPT 式整屏滑动，顶部节点轨道显示「项目到哪一步」，点节点跳到对应界面；画面参考 ThoughtDAG 开头滚轮叙事。☐ 侧重待选 |
| Scope | ☐ 替换 `pages/index.html` 或新增独立页；数据仍以 `data/projects.json` 为唯一源；构建链、测试、README 是否同步待选 |
| Acceptance criteria | ☐ 验收清单待选；已固定：静态 `file://` 可开、零外部依赖、缺失值显示「—」 |
| Failure modes | 文档无结构化阶段、无 status/progress/updatedAt，截图数字为演示业务数据；☐ 资料不齐时的呈现方式待选 |
| Priorities | 交互与诚实数据 > 视觉动效 > 动画丰富度；速度靠并行子代理与构建期内联 |
| Non-goals | ☐ 待选；已固定：零编造百分比、零外部 CDN、零自动轮播 |

## 四、已固定事实（无需重复询问）

- 参考页机制：`.story { height: 900vh }` + `.stage { position: sticky; height: 100svh }` + `.world { width: 5200px; height: 2700px }`；`rawProgress = clamp((scrollY - storyTop) / storyDistance)`；`visualProgress += (target - visual) * (reduced ? 1 : 0.16)`；相机关键帧 smoothstep 插值后 `world.style.transform = translate(innerWidth/2, innerHeight/2) scale(z) translate(-cam.x, -cam.y)`；字幕按 `data-range` 淡入淡出；章节节点 `classList.toggle("active", index === nearest)`；顶部进度条 `scaleX(p)`；右下 `1 / 5`。
- 数据现状：3 个项目（高校党组织管理平台项目介绍 / 科技成果转化平台项目介绍 / 科研项目申报系统简介）、3 份 DOCX、7 张截图；六段阶段框架 `["需求分析","方案设计","开发实现","测试验证","部署上线","运维迭代"]` 来自调研，仅作展示框架；3 条 DOCX 原话「基于原型设计实现」「主要功能都已经做完，眼下还在边开发边修」「当前业务整体处于线下评审环节」。
- 样张实测：`previews/2026-11-09-ppt-effect-demo.html` 6 节点 / 17 卡片 / 6 字幕 / 2 张真实截图全加载，`scrollH 5400`；点第 4 节点 `scrollY 0 → 2700`、`1 / 6 → 4 / 6`；控制台 `ERRORS []`；手机 390×844 `scrollWidth == innerWidth == 390`。
- 调研落盘：`docs/2026-11-09-ppt-effect-research.md`；参考页源码 `_temp/2026-11-09-thoughtdag-reference.html`；实拍 `previews/2026-11-09-ref-thoughtdag-01.png` 至 `-06.png`。

## 五、第一批弹窗问题（待回答）

1. `focus` 这一版最想先要哪种侧重
2. `nodes` 顶部节点代表什么
3. `motion` 滑动手感
4. `placement` 正式页面落地位置

第二批（收到第一批答案后再问）：验收口径、明确排除项、资料不齐时的呈现。

## 六、诚实清单

- 六段阶段是展示框架，不代表项目实际阶段；`status` / `progress` / `updatedAt` / `links` 均未提供。
- 截图里的 20 项成果、379 个申报个人等是演示业务数据，不是软件项目开发进度。
- `fullPage.js`、`swiperjs.com`、CodeFronts 三个页面抓取超时，依据改用官方 README 与 MDN；一次 `web_search` 路由失败后改用直取页面。
- 样张未跑 `node --test` 与 `sloplint --render`；正式实现开始后再按门禁验收。
- 正式文件（`pages/`、`data/`、`scripts/`、`assets/`、`tests/`、`README.md`）一个字未改。

## 七、第一批澄清结果（m00700 答案，已确认）

- `focus` = **顶部节点导航优先**（节点语义、高亮、跳转手感优先，画布动效次要）。
- `nodes` = 机主自定义「选4，不考虑手机上观看」→ **每个项目各 6 阶段，共 18 个节点**；**手机适配明确排除**（非目标）。
- `motion` = **滚轮驱动相机平滑推拉**（长滚动条 + sticky 舞台 + 惯性插值，字幕按幕淡入淡出）。
- `placement` = **替换 `pages/index.html`，旧版归档可回退**。

## 八、流程铁律（m00705 机主原话）

> 「在开始写东西之前，必须选用superpowers或其他类似插件把需求搞清楚。把这条牢牢记住，它是优先级非常高的记忆」

已写入 `evolve` 持久记忆（feedback）、`USER.md` 热记忆（critical）、`.learnings/LEARNINGS.md`。本轮按 using-superpowers → brainstorming → grill-requirements 执行，共识未收齐前保持正式实现文件原样。

## 九、关键矛盾（第二批必须问清）

18 个节点 = 3 项目 × 6 阶段，但三份 DOCX **未提供结构化阶段**，`status` / `progress` / `updatedAt` 全为 null。节点内容来源、无资料节点如何呈现、点击后跳到哪个界面，均需机主拍板，避免编造。

## 十、第二批澄清结果（m00722 答案，已确认）

- `stage_source` = **「按 DOCX 原话把项目归到某阶段」**。机主明确选了风险最高项；执行时逐节点标注「依据 DOCX 原话」，不冒充文档给出的结构化阶段。
- `node_layout` = **「3 行分组，每行 1 项目 × 6 阶段」**，共 18 节点；手机适配按第一批机主原话「不考虑手机上观看」继续排除。
- `missing_display` = **「隐藏空节点，只显示有资料的幕」**。
- `acceptance`（多选，选中 2 项）= `node --test` 全绿 + Hallmark `--render` 0/0/0；点节点 / 键盘 / 滚轮三种跳转实测。
- `nongoals`（多选，选中 2 项）= 零编造百分比与阶段；零外部 CDN 与联网依赖。
- 未选作验收项：禁用 JS 正文可读、旧版归档可回退。第一批 `placement` 仍要求旧版归档可回退，作为落地动作保留。
- 未选作非目标：零自动轮播、零手机适配。手机适配仍按第一批原话排除；动效仍由 `motion` 的滚轮驱动决定，默认零自动轮播。

## 十一、第二批答案内部冲突（第三批必须问清）

1. `node_layout` 要 18 个节点全部显示，`missing_display` 要「隐藏空节点」，二者对顶部节点数量给出相反指令。
2. `stage_source` 要「按 DOCX 原话把项目归到某阶段」，但项目 3 原话「当前业务整体处于线下评审环节」是业务流程环节，不是六段 SDLC 阶段；旧诚实清单写「六段阶段是展示框架，不代表项目实际阶段」，归类口径需机主确认。

## 十二、六维状态（共识收齐后用 doublecheck_spec 定稿）

| 维度 | 状态 | 已定内容 |
| --- | --- | --- |
| 目标 | ☑ | PPT 式整屏滑动 + 顶部节点跳对应界面 |
| 范围 | ☐ | 18 节点数量、冲突口径待第三批 |
| 验收判据 | ☑ | 全绿测试 + render 0/0/0 + 三种跳转实测 |
| 失败模式 | ☐ | 节点无资料、归类冲突的降级行为待第三批 |
| 优先级 | ☑ | 顶部节点导航优先；画布动效次要 |
| 非目标 | ☑ | 零编造百分比与阶段、零外部 CDN、手机适配排除 |

## 十三、本轮纪律

按 m00705 铁律，本轮仍只做需求澄清与规格落盘；`pages\`、`data\`、`scripts\`、`assets\`、`tests\`、`README.md` 保持原样，等机主说「动手」。

阶段证据逐字表、冲突分析、旧版归档回退清单见 `docs/2026-11-09-ppt-slide-stage-evidence.md`。第三批 2 问（callId chatcmpl-tool-bd04b002153dc2bc:ptc:5）已答，共识收齐，六维定稿见 `docs/2026-11-09-ppt-slide-spec-final.md`。
## 十四、方向修订（m00757，机主原话）

> 「内容太少了，页面上没多少文字说明。不要这种格式了，你看看别的。先迅速搓几版不同的，我来选，搓的时候先搓一个项目就行，我看看合适不合适」

- 推翻：ThoughtDAG 式整屏画布滚轮叙事作为最终形态；样张内容偏少、文字说明不足。
- 新验收：迅速产出**多版不同版式**的单项目样张供机主选择；只用 1 个项目；每版文字说明充足；零外部依赖、file:// 可开。
- 本轮仍只做样张（`previews/`）与截图，正式实现文件保持原样，机主选版后才谈落地。
- 素材：科技成果转化平台项目介绍（DOCX 原话 4 段 + 4 张界面截图 + 演示数据口径），逐字引用，不编造阶段与百分比。
