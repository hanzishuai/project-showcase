/* Build static showcase artifacts from data/projects.json. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = resolve(root, "data/projects.json");
const htmlPath = resolve(root, "pages/index.html");

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function missingDash() {
  return "<code class='missing-value'>—</code>";
}

function renderHtml(data, json) {
  const meta = data.meta;
  const projects = data.projects;
  const catalog = meta.screenshotCatalog || {};

  function shotInfo(file) {
    const info = catalog[file] || {};
    return {
      file,
      width: info.width || 1920,
      height: info.height || 932,
      caption: info.caption || "项目界面截图",
      note: info.note || "界面截图，演示业务数据不是软件项目开发进度。"
    };
  }

  function figureMarkup(file) {
    const shot = shotInfo(file);
    const src = "../assets/images/" + shot.file;
    return "<figure class='figure'>"
      + "<img class='figure-image' src='" + esc(src) + "' width='" + esc(shot.width) + "' height='" + esc(shot.height) + "' alt='" + esc(shot.caption) + "' loading='eager' decoding='async'>"
      + "<figcaption class='figure-caption'>" + esc(shot.caption) + "</figcaption>"
      + "<p class='figure-note'>" + esc(shot.note) + "</p>"
      + "<a class='source-link' href='" + esc(src) + "'>查看原图</a>"
      + "</figure>";
  }

  const heroShot = shotInfo("截图-管理后台统计.png");
  const ledgerRows = projects.map((project) => {
    return "<tr class='ledger-row reveal' data-project-id='" + esc(project.id) + "'>"
      + "<td class='cell-name'><a class='source-link' href='#project-" + esc(project.id) + "'>" + esc(project.name) + "</a></td>"
      + "<td class='cell-stage'>" + esc(project.stageNote) + "</td>"
      + "<td class='cell-status' aria-label='状态未提供'>" + missingDash() + "</td>"
      + "<td class='cell-progress' data-project-id='" + esc(project.id) + "' aria-label='进度未提供'>"
      + "<span class='progress-empty'></span>"
      + "<span class='progress-track' aria-hidden='true'><span class='progress-fill' hidden></span></span>"
      + "</td>"
      + "<td class='cell-updated' aria-label='更新时间未提供'>" + missingDash() + "</td>"
      + "</tr>";
  }).join("\n");

  const projectSections = projects.map((project, index) => {
    const number = String(index + 1).padStart(2, "0");
    const contentBlocks = String(project.content).split(/\n{2,}/u).map((text) => "<p>" + esc(text) + "</p>").join("\n");
    const sourceItems = project.sourceFiles.map((source) => {
      const label = String(source).split(/[\\/]/u).pop();
      return "<li><a class='source-link' href='" + esc(source) + "'>" + esc(label) + "</a></li>";
    }).join("\n");
    const figureBlocks = project.screenshots.length
      ? "<div class='figure-grid'>" + project.screenshots.map(figureMarkup).join("\n") + "</div>"
      : "<p class='data-note'>外部截图未提供。</p>";
    return "<article class='project reveal' id='project-" + esc(project.id) + "'>"
      + "<header class='project-header'>"
      + "<p class='project-index'>项目 " + number + "</p>"
      + "<h3 class='project-title'>" + esc(project.name) + "</h3>"
      + "<p class='project-meta'>阶段叙述：" + esc(project.stageNote) + "；状态：未提供；进度：未提供；更新：未提供</p>"
      + "<p class='project-summary'>" + esc(project.summary) + "</p>"
      + "</header>"
      + "<div class='project-body'>"
      + "<div class='project-content'><h4>项目要点</h4>" + contentBlocks + "<p class='data-note'>" + esc(project.dataNote) + "</p></div>"
      + "<div class='project-sources'><h4>资料来源</h4><ul class='source-list'>" + sourceItems + "</ul><h4>截图</h4>" + figureBlocks + "</div>"
      + "</div>"
      + "</article>";
  }).join("\n");

  const stageItems = meta.stageFramework.map((stage) => "<li data-stage='" + esc(stage) + "'>" + esc(stage) + "</li>").join("\n");
  const researchItems = meta.researchLinks.map((link) => "<li><span class='source-link'>" + esc(link.title) + "</span><span class='figure-note'>" + esc(link.url) + "</span></li>").join("\n");
  const jsonSafe = json.replace(/</g, "\\u003c");

  const parts = [];
  parts.push("<!doctype html>");
  parts.push("<html lang='zh-CN'>");
  parts.push("<head>");
  parts.push("<meta charset='utf-8'>");
  parts.push("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  parts.push("<meta name='description' content='" + esc(meta.subtitle) + "'>");
  parts.push("<title>" + esc(meta.title) + "</title>");
  parts.push("<link rel='stylesheet' href='../assets/css/tokens.css'>");
  parts.push("<link rel='stylesheet' href='../assets/css/base.css'>");
  parts.push("<link rel='stylesheet' href='../assets/css/showcase.css'>");
  parts.push("</head>");
  parts.push("<body class='page'>");
  parts.push("<a class='skip-link' href='#main'>跳到主要内容</a>");
  parts.push("<header class='site-header'><div class='container'><nav class='site-nav' aria-label='页内导航'>");
  parts.push("<a class='nav-link' href='#overview'>总览</a>");
  parts.push("<a class='nav-link' href='#ledger'>进度台账</a>");
  parts.push("<a class='nav-link' href='#projects'>项目内容</a>");
  parts.push("<a class='nav-link' href='#stages'>阶段框架</a>");
  parts.push("<a class='nav-link' href='#sources'>资料来源</a>");
  parts.push("</nav></div></header>");
  parts.push("<main id='main' class='container'>");
  parts.push("<section class='hero' id='overview'>");
  parts.push("<div><h1 class='hero-title'>所有项目，都在这一页</h1>");
  parts.push("<p class='hero-lede'>已上传资料的项目进度与内容同页呈现，缺失字段保留占位符。</p>");
  parts.push("<div class='hero-actions'><a class='btn btn-primary' href='#projects'>阅读项目内容</a><a class='btn btn-secondary' href='#ledger'>查看进度台账</a></div></div>");
  parts.push("<figure class='hero-figure'>");
  parts.push("<img class='figure-image' src='../assets/images/" + esc(heroShot.file) + "' width='" + esc(heroShot.width) + "' height='" + esc(heroShot.height) + "' alt='" + esc(heroShot.caption) + "' loading='eager' decoding='async'>");
  parts.push("<figcaption class='figure-caption'>界面截图：" + esc(heroShot.caption) + "</figcaption>");
  parts.push("<p class='figure-note'>" + esc(heroShot.note) + "</p>");
  parts.push("</figure>");
  parts.push("</section>");
  parts.push("<section class='section notice' id='notice'>");
  parts.push("<h2 class='notice-title'>资料完整性声明</h2>");
  parts.push("<p class='notice-body'>本页收录 " + esc(meta.materials.projectFolders) + " 个项目文件夹、" + esc(meta.materials.docx) + " 份 docx、" + esc(meta.materials.screenshots) + " 张截图；未上传项目以 1 个汇总占位行呈现。status、progress、updatedAt、links 在已提交文档中均未提供，页面保留占位符，进度轨道留空。展示名按共识采用目录名「科技成果转化平台项目介绍」。</p>");
  parts.push("</section>");
  parts.push("<section class='section' id='ledger'>");
  parts.push("<div class='section-head'><h2 class='section-title'>进度台账</h2><p class='section-lede'>状态、进度与更新时间取自 data/projects.json；文档未提供时留空。</p></div>");
  parts.push("<div class='ledger'><table class='ledger-table'>");
  parts.push("<caption class='ledger-caption'>已上传项目与待补资料汇总占位</caption>");
  parts.push("<thead><tr><th scope='col'>项目</th><th scope='col'>阶段叙述</th><th scope='col'>状态</th><th scope='col'>进度</th><th scope='col'>更新</th></tr></thead>");
  parts.push("<tbody>");
  parts.push(ledgerRows);
  parts.push("<tr class='ledger-row ledger-row--placeholder'><td class='cell-name'>资料待上传</td><td class='cell-stage'>文档待补</td><td class='cell-status'>" + missingDash() + "</td><td class='cell-progress' aria-label='进度未提供'><span class='progress-empty'></span><span class='progress-track' aria-hidden='true'><span class='progress-fill' hidden></span></span></td><td class='cell-updated'>" + missingDash() + "</td></tr>");
  parts.push("</tbody></table></div>");
  parts.push("</section>");
  parts.push("<section class='section' id='projects'>");
  parts.push("<div class='section-head'><h2 class='section-title'>项目内容</h2><p class='section-lede'>正文来自三份 DOCX，7 张截图与来源逐项陈列；截图数字均为界面证据或演示业务数据。</p></div>");
  parts.push(projectSections);
  parts.push("</section>");
  parts.push("<section class='section' id='stages'>");
  parts.push("<div class='section-head'><h2 class='section-title'>需求分析与阶段框架</h2><p class='section-lede'>外部调研用于解释项目进度阶段，当前项目阶段另按 DOCX 原话呈现。</p></div>");
  parts.push("<div class='stage-framework'><ol class='stage-list'>" + stageItems + "</ol>");
  parts.push("<p class='data-note'>六段框架来自项目组合看板调研；本页保留项目到阶段的换算为空，避免把文档叙述日期折算成完成度。</p>");
  parts.push("<p class='data-note'>用途：作品集展示；范围：已上传资料与一行待补资料占位；进度口径：仅引用 DOCX 阶段叙述，百分比留空；交付：单页 HTML 与本地 assets；动效：少量入场，进度条零动画。</p>");
  parts.push("</div></section>");
  parts.push("<section class='section' id='sources'>");
  parts.push("<div class='section-head'><h2 class='section-title'>数据与调研来源</h2><p class='section-lede'>data/projects.json 是唯一数据源；调研条目供阶段框架溯源。</p></div>");
  parts.push("<ul class='source-list'><li><a class='source-link' href='../data/projects.json'>data/projects.json 唯一源说明</a></li>" + researchItems + "</ul>");
  parts.push("<p class='data-note'>页面静态打开时从内联 application/json 读取同一份数据；运行期无 fetch。file:// 双击可开。构建脚本：scripts/build-data.mjs。</p>");
  parts.push("</section>");
  parts.push("</main>");
  parts.push("<footer class='site-footer'><div class='container'>");
  parts.push("<h2 class='footer-title'>项目展示：进度与内容</h2>");
  parts.push("<p class='footer-note'>作品集展示语气，墨线台账结构。缺失字段保留占位符；演示业务数据与界面计数均不作开发指标。</p>");
  parts.push("</div></footer>");
  parts.push("<script id=\"projects\" type=\"application/json\">" + jsonSafe + "</script>");
  parts.push("<script src=\"../assets/js/showcase.js\" defer></script>");
  parts.push("</body>");
  parts.push("</html>");
  return parts.join("\n") + "\n";
}

const data = JSON.parse(readFileSync(dataPath, "utf8"));
const json = JSON.stringify(data, null, 2);
mkdirSync(dirname(htmlPath), { recursive: true });
writeFileSync(htmlPath, renderHtml(data, json), "utf8");
process.stdout.write("WROTE " + htmlPath + "\n");
process.stdout.write("PROJECTS " + data.projects.length + "\n");
