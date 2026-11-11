# PPT 式项目进度页：网上调研与效果样张（2026-11-09）

> 状态：**只调研 + 出效果样张，正式页面未改动**。等机主说「动手」再改 `pages/index.html` 等实现文件。

## 1. 机主要的是什么

- (m00622)「不是这样的，是跟 ppt 那种。滑动的，然后上面是项目到哪一步了，上面会显示很多节点，点这些节点，项目就跳转到对应的界面。」
- (m00625)「先去网上查资料，看看别人怎么写的，先让我看一下效果，我说动手再动手。」
- (m00643) 参考 `https://chenxiachan.github.io/thoughtdag/` 开头的滚轮画面。

拆解成四条：① 一屏一屏的幻灯片式滑动；② 顶部固定一条节点轨道，显示当前到哪一步；③ 节点很多且可点，点击跳到对应界面；④ 开头用参考页那种「滚轮驱动大画布平移缩放」的画面。

## 2. 别人怎么写的（实查来源）

| 做法 | 代表 | 关键机制 | 来源 |
| --- | --- | --- | --- |
| 幻灯片框架 | reveal.js | `Reveal.initialize({controls, progress, slideNumber, hash})`，横向 + 纵向两级 slide，`Reveal.slide(h,v)` 跳指定页，键盘 →/SPACE/N，导航菜单点任意 slide | [revealjs.com](https://revealjs.com/) · [config](https://revealjs.com/config/) · [Quarto 演示说明](https://quarto.org/docs/presentations/revealjs/presenting.html) |
| 整屏滚动 | fullPage.js | 每个 section 占满一屏，`anchors` + 右侧圆点导航 `navigation: true`，`menu` 绑定锚点，`moveTo(n)` 跳转，`scrollOverflow` 处理超高内容 | [项目主页](https://alvarotrigo.com/fullPage/) · [README](https://raw.githubusercontent.com/alvarotrigo/fullPage.js/master/README.md) |
| 触控轮播 | Swiper | `pagination: {clickable:true}` 可点圆点、`hashNavigation`、`keyboard`、`mousewheel` 翻页 | [swiperjs.com](https://swiperjs.com/) |
| 原生滚动吸附 | CSS scroll-snap | `scroll-snap-type: y mandatory` + 子元素 `scroll-snap-align: start`，配 `scroll-behavior: smooth` 与 `scrollIntoView()`；Baseline 2020-01 | [scroll-snap-type](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-type) · [scroll-snap-align](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-align) · [scroll-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-behavior) |
| 顶部步骤条 | CSS stepper | 12 种水平 stepper：圆点节点 + 连线 + 当前态高亮 + 已完成/未完成 | [CodeFronts](https://codefronts.com/components/css-stepper-designs/) · [8 种滚动模式](https://lovable.dev/guides/scrolling-designs-patterns-when-to-use) |
| 节点式幻灯片 | React Flow | 把节点图当画布，按当前 slide 决定显示哪些节点，点节点切到对应视图 | [React Flow 教程](https://reactflow.dev/learn/tutorials/slide-shows-with-react-flow) |
| **参考页** | **ThoughtDAG** | **sticky 舞台 + 长滚动条 + 大画布相机插值** | [页面](https://chenxiachan.github.io/thoughtdag/) |

### 参考页开头滚轮画面（实测 + 读源码）

快照落在 `_temp/2026-11-09-thoughtdag-reference.html`（79113 字节）。核心 CSS：

- `.story { height: 900vh }` → 用一条 9 屏高的滚动条当「进度条」。
- `.stage { position: sticky; top: 0; height: 100svh; overflow: hidden }` → 舞台始终占满视口、不动。
- `.world { position: absolute; width: 5200px; height: 2700px; transform-origin: 0 0; will-change: transform }` → 舞台里放一张超大画布。

核心 JS（同一文件的行号）：

- `:213` `const rawProgress = () => clamp((scrollY - storyTop) / storyDistance);`
- `:217` `visualProgress += (targetProgress - visualProgress) * (reduced ? 1 : 0.16);` → 惯性平滑，减弱动效时系数 1。
- `:138` `const interpolateCamera = (progress) => {...}` → 在关键帧之间用 smoothstep 插值相机 x/y/z。
- `:231` `world.style.transform = translate(innerWidth/2, innerHeight/2) scale(z) translate(-cam.x, -cam.y)`
- `:232` `progressEl.style.transform = scaleX(p)` → 顶部细进度条。
- `:264` 字幕按 `caption.dataset.range` 淡入淡出；`:278` 选 nearest 章节；`:283` `rail.children` 切 `active`；`:290-295` 仅移动时 `requestAnimationFrame`；`:311` 被动 scroll 监听。
- 右下角 `1 / 5` + 章节名；右侧竖排小圆点是章节导航。

实拍 6 帧（1440×900，停点 0 / .08 / .2 / .38 / .6 / .82）：`previews/2026-11-09-ref-thoughtdag-01.png` 至 `-06.png`。`PAGE_INFO`：`{"height":12218,"vh":900,"story":true,"stage":true,"world":true,"navNodes":11,"frames":3,"captions":5}`。

## 3. 效果样张

- 文件：`previews/2026-11-09-ppt-effect-demo.html`，单文件、内联 CSS/JS、无外部依赖，`file://` 双击可开。
- 6 幕、6 个顶部节点：总览 / 需求分析 / 方案设计 / 开发实现 / 界面证据 / 待补资料。
- 交互：滚轮驱动相机平移缩放；点顶部任意节点平滑跳到对应幕；← → / PageUp / PageDown / Home / End 翻幕；顶部进度条 `scaleX(p)`；右下 `n / 6` + 当前幕名。
- 版式：参考页的浅纸底 + 点阵网格 + 虚线框 + 白卡片 + 连线 + 右侧字幕卡；节点轨道放顶部（机主要求）。
- 减弱动效：系数改 1、滚动改 `auto`、提示箭头停动画。
- 数据：3 个项目名、3 条 DOCX 原话、六段阶段框架、2 张真实截图；`status/progress/updatedAt` 显示 `—`，不编造百分比。

## 4. 诚实清单

- 六段阶段是**展示框架**，文档未提供结构化阶段，样张不宣称任何项目处于某一阶段。
- 截图里的 20 项成果、379 个申报个人等数字是演示业务数据，不是软件项目开发进度。
- `fullPage.js`、`swiperjs.com`、CodeFronts 三个站点的正文抓取超时/失败，依据改用官方 README、MDN 与搜索结果摘要。
- 一次 `web_search` 报 `DeepSeek returned no web_search_tool_result blocks`，改用 `read_page` / `web_fetch` 直取页面成功。
- 样张**未跑** Hallmark `sloplint --render` 与 `node --test`；正式实现开始后再按 RED/GREEN 与渲染门禁验收。
- 正式文件（`pages/`、`data/`、`scripts/`、`assets/`、`tests/`、`README.md`）一个字未改。

## 5. 等机主拍板

看完样张后选择：按此效果动手 / 节点改成按项目分 / 更贴参考页的画面感 / 先不动手。选定后才进入实现与验收。