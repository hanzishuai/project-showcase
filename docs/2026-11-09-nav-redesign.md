# 顶部项目节点导航重设计（2026-11-09）

## 机主原话

m00802：「先继续重新设计，快速出结果，这次要先把最开始的导航加上（导航不同项目的）」

## 本轮范围

只做样张与真跑验证。`pages/`、`data/`、`scripts/`、`assets/`、`tests/`、`README.md` 一个字未改。
沿用 m00793 选版结果：C 阶段时间轴为主，融合 A 杂志专题档案质感。

## 导航结构

- 顶部 sticky 黑底「项目节点地图」：3 行 × 6 阶段 = 18 个可点节点，每行左侧一个项目链接。
- 第 4 行「04 待补资料」汇总占位，不编造节点与字段。
- 顶部细线随阅读位置推进，右上角 HUD 显示「当前项目 / 当前阶段」。
- 点节点跳到该项目对应阶段画面；方向键顺序翻节点；数字键 1 / 2 / 3 直接切项目；滚轮自然滚动，滚动时六段轨道与顶部地图同步高亮。

## 内容骨架

- 每项目 6 段 STAGE 长文，3 项目共 18 段；正文 8132 字（去空白计数），页面高 14459px。
- 米白纸底 `#f2efe8`、砖红 `#9a3b25`、宋体大标题、首字下沉、三列布局（172px 轨道 / 长文 / 246px 粘性事实清单）。
- 7 张真实截图全部加载并穿插在对应阶段；项目 3 无外部截图，只列 5 条文档图注原文。
- 阶段只引用 DOCX 原话，空阶段写「文档未提供结构化阶段」并置灰；`status` / `progress` / `updatedAt` / `links` 显示 —。

## 真跑实测（复跑，本机 Chrome 1440×900，file://）

命令：`node _temp/2026-11-09-redesign-nav-shots.mjs`，`CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`；EXIT=0、TIMEDOUT=false、STDERR 空、ERRORS []。

| 项 | 实测 |
|---|---|
| 节点 / 项目链接 / 行 / 阶段 / 轨道 | 18 / 3 / 4 / 18 / 18 |
| 7 张图片 | 全部 `ok=true`，自然宽 1897 / 1907 / 1908 / 1920×4 |
| 初始 | `y=0`、`hash=""`、`active=#p1-s1`、HUD「01 高校党组织管理平台 / 需求分析」 |
| 点 `#p2-s4` | `y=7971`、`hash=#p2-s4`、`active=#p2-s4`、HUD「02 科技成果转化平台 / 测试验证」、进度线 58.79% |
| 点项目 3 链接 | `y=10805`、`hash=#p3`、HUD「03 科研项目申报系统 / 需求分析」 |
| 方向键右 | `hash=#p3-s2`、`active=#p3-s2` |
| 数字键 1 | `hash=#p1-s1`、`active=#p1-s1`、HUD 回项目 1 |
| 滚轮 | `y=2342`、进度线 17.27% |
| 390×844 | `navH=309`、`scrollW=390=innerW`、`h1=38px`、无横向溢出 |

5 张截图：`previews/2026-11-09-redesign-nav-01-hero.png`、`-02-p2s4.png`、`-03-p3.png`、`-04-full.png`、`-05-phone.png`；验证 JSON：`_temp/2026-11-09-redesign-nav-verify.json`。

## 修复链（首跑 3 个偏差）

1. 点 `#p2-s4` 后 `active` 落在 `#p2-s3`、HUD 显示「开发实现」：IntersectionObserver 在平滑滚动途中覆盖点击激活。加 `var lockUntil=0`，`function activate(hash,lock){ if(lock) lockUntil=Date.now()+1200; ... }`，点击与键盘传 `true`，`obs` / `pobs` 回调开头 `if(Date.now()<lockUntil)return`。
2. 点项目链接后 HUD 落到「运维迭代」：`a.proj` 点击改为 `activate("#"+pid+"-s1",true)`，直接点亮该项目第一段并锁住。
3. 手机 `navH=734` 占满 844 高屏：`@media(max-width:760px)` 加 `.nav-grid{max-height:190px;overflow:auto}`，复跑 `navH=309`。
共 11 处 `tools.edit`，读回文件尾部确认全部在盘。

## 诚实清单

- 六段是导航分组名，不是项目真实开发阶段；项目 3「当前业务整体处于线下评审环节」显式标注「业务流程环节，非软件开发阶段」。
- 前台 20 项成果与后台 21 条总数（含已下架）口径差异如实并列，不解释。
- 379 人 / 48 家 / 378 条 / 348 条待线下评审、420 题、60 分、8/15/4/9 项材料均为业务演示数据，统一标注「不是软件项目开发进度」。
- 展示名按目录名；项目 2 的 DOCX 标题「产教融合服务平台项目情况汇报」与目录名不一致，事实清单里两者并列。
- 样张未跑 `node --test` 与 Hallmark `--render`，正式页落地时才补。
- 零外部 CDN、零 fetch、零自动轮播；`file://` 双击可开。

## 怎么生效

样张是单文件内联 CSS/JS，双击 `previews/2026-11-09-redesign-nav.html` 即看，无需重启或构建。正式页未动；确认铺到正式页后才归档旧版、改 `scripts/build-data.mjs`、重建 `pages/index.html` 并跑测试与渲染门。

## 待决

等机主确认：是否用这一版替换正式页；18 节点是否保留全置灰可点；是否补跑 Hallmark 渲染门。