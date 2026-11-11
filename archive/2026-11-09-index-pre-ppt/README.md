# 项目展示 · 进度与内容

> 用途：写一套美观、自包含的 HTML 介绍界面，把**所有项目的进度**和**每个项目的内容**放在一页里讲清楚。数据与页面分离，进度只从 `data/` 读，页面禁止手写百分比。
> 建：2026-11-09 · workspaceId `4c5ed08a-6dfd-43c8-8c8b-e421e690919c` · 已收录 3 个项目文件夹、3 份 docx、7 张截图。

## 目录

| 目录 | 放什么 |
|---|---|
| `data/` | 唯一数据源 `projects.json`：meta + projects 数组，包含资料盘点、阶段框架、调研来源与 7 张截图元数据 |
| `pages/` | HTML 成品：`index.html` 总览页；静态可双击打开 |
| `assets/` | CSS / JS / 图片，按类型分子目录 |
| `design/` | 视觉规范：`:root` token、栅格、组件清单、评审记录 |
| `previews/` | 截图、导出图，命名 `YYYY-MM-DD-<页面>.png` |
| `archive/` | 旧版页面与被推翻的设计，保留留痕 |

## 数据契约（`data/projects.json`）

```json
{
  "meta": { "materials": { "projectFolders": 3, "docx": 3, "screenshots": 7 }, "stageFramework": ["需求分析", "方案设计", "开发实现", "测试验证", "部署上线", "运维迭代"] },
  "projects": [
    { "id": "<kebab-case>", "name": "项目名", "status": null, "progress": null,
      "updatedAt": null, "stage": "文档未提供结构化阶段", "summary": "一句话讲清它是什么",
      "content": "正文，多段用空行分隔", "links": [], "sourceFiles": ["../project/<目录>/<文件>.docx"],
      "screenshots": ["<文件名>.png"] }
  ]
}
```

- `progress` 只填 0–100 的数字或 `null`；`null` 表示文档未提供，进度轨道留空，缺失符号由 CSS 生成。
- 状态只允许三个枚举值或 `null`；`null` 表示文档未提供；新增状态先改这份契约再改页面。
- 每个项目一个 `id`，一项目一条记录，汇总占位行由构建脚本生成。
- `sourceFiles` 与 `screenshots` 使用字符串路径或文件名；截图尺寸、图注与口径在 `meta.screenshotCatalog` 中维护。

## 三条规则

1. **一子目录只放一类东西**，混了再拆一层；页面不写数据，数据不写样式。
2. **文件名带日期与对象**：`YYYY-MM-DD-<项目>-<用途>.md` / `.png`；改设计规范要写清「从什么值到什么值、为什么」。
3. **保留旧版**，被推翻的视觉方案移进 `archive/`，新文档写清依据。

## 美观判据（真开始写页面时）

> **触发句：要产出或改 `pages/*.html` 之前，先加载 `hallmark` 技能并跑一次 `sloplint.mjs`。**

底线摘要（完整 16 条在技能正文的 `## The Floor`）：颜色与字体全部走 `:root` token、禁 `transition: all` 与动宽高、`:focus-visible` 全覆盖、必带 `prefers-reduced-motion` 回退、`html`/`body` 用 `overflow-x: clip`、首屏 1280×800 内看得见标题一句话与主操作、容器定宽居中、零编造指标与客户墙、CSS 首行留 Hallmark stamp。
交付前用 `node <skill-dir>/scripts/sloplint.mjs <output> --render` 扫一遍，`FAIL` 全修、`REFLEX` 修或在记录里豁免。

## 状态

- 项目 3 条 · 页面 1 个 · 预览 3 张 · 截图 7 张；未上传项目以 1 行「资料待上传」汇总占位。
- 运行 `node scripts/build-data.mjs` 从 `data/projects.json` 生成 `pages/index.html`；静态 `file://` 双击可开，运行期无 `fetch`。
- 体量红线：单份文档 ≤ 25 KB，超了拆卷保留内容。
