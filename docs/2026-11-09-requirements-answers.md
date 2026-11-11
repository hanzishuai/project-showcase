# 项目展示页 · 需求确认答案

> 记录时间：2026-11-09  
> 触发：机主要求先问清需求再继续（m00101）。  
> 本文件是需求确认记录，不是数据源。

## 六个问题

1. goal_audience：这页主要给谁看、用来做什么？
2. scope_materials：资料不全时，页面覆盖到哪一步？
3. progress_definition：「项目进度」按哪个口径展示？
4. visual_direction：页面偏哪种视觉方向？
5. required_content：哪些内容必须保留在页面上？（可多选）
6. delivery_motion：交付形态与动效怎么定？

## 答案

- goal_audience: 作品集展示
- scope_materials: 为未上传项目留占位
- progress_definition: 按文档叙述的软件阶段定性标注，无百分比
- visual_direction: 墨线台账/编辑式档案（Recommended）
- required_content: docx 正文/要点 / 需求分析/生命周期阶段 / 资料完整性声明 / 7 张截图与来源
- delivery_motion: 允许少量入场动效，进度条零动画

## 第二轮共识确认

问题：用途与视觉合并、占位方式、阶段口径、交付形态、补充内容、共识确认。
共识轮次：2

- 第 1 轮：[{"id":"style_merge","selected":["作品集展示为用途/语气，墨线台账为视觉结构（Recommended）"]},{"id":"placeholder_policy","selected":["1 个汇总占位行「资料待上传」（Recommended）"]},{"id":"stage_source","selected":["仅引用 docx 原话，不映射 SDLC（Recommended）"]},{"id":"delivery_form","selected":["单页 HTML + 本地 assets，双击可开（Recommended）"]},{"id":"content_extras","selected":[],"custom":"只留科技成果转化平台"},{"id":"consensus","selected":["达成共识，记录规格后继续（Recommended）"]}]

## 两轮共识修正（lead 2026-11-09 对齐）

- 资料盘点修正为 3 个项目文件夹、3 份 docx、7 张截图；旧稿 2/2/7 作废。
- 展示名只留项目文件夹名；第二项只留「科技成果转化平台项目介绍」。
- 省略 docx 标题「产教融合服务平台项目情况汇报」，不做并列展示。
- 保留 data/projects.json 唯一源说明；status/progress/updatedAt 全为 null，links=[]。
- 1 个汇总占位行「资料待上传」，不进入 projects 数组。
- 阶段框架六段独立成段；项目阶段仅引用 docx 原话，省略 SDLC 映射。
- 静态 file:// 双击可开；构建期内联 application/json，运行期零 fetch。
- 少量入场动效，进度条零动画；HTML 无写死百分比、无空 href、无 onclick。
- CSS 首行 Hallmark stamp、:root token、overflow-x: clip、minmax(0,1fr)、overflow-wrap、:focus-visible、prefers-reduced-motion；无 JS 正文可见。
- JS 严格区分 progress === 0 与 progress == null。
- data/projects.json 字段：id/name/status/progress/updatedAt/links/stage/stageNote/content/dataNote/sourceFiles/screenshots；meta.materials 为 3/3/7。

## 原始工具结果

```json
{
  "answers": [
    {
      "id": "goal_audience",
      "selected": [
        "作品集展示"
      ]
    },
    {
      "id": "scope_materials",
      "selected": [
        "为未上传项目留占位"
      ]
    },
    {
      "id": "progress_definition",
      "selected": [
        "按文档叙述的软件阶段定性标注，无百分比"
      ]
    },
    {
      "id": "visual_direction",
      "selected": [
        "墨线台账/编辑式档案（Recommended）"
      ]
    },
    {
      "id": "required_content",
      "selected": [
        "docx 正文/要点",
        "需求分析/生命周期阶段",
        "资料完整性声明",
        "7 张截图与来源"
      ]
    },
    {
      "id": "delivery_motion",
      "selected": [
        "允许少量入场动效，进度条零动画"
      ]
    }
  ]
}
```