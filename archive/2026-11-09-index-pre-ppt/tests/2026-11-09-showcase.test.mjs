import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = 'data/projects.json';
const HTML_PATH = 'pages/index.html';
const BUILD_PATH = 'scripts/build-data.mjs';
const README_PATH = 'README.md';
const CSS_DIR = 'assets/css';
const JS_DIR = 'assets/js';
const IMAGES_DIR = 'assets/images';
const UNIQUE_SOURCE = 'data/projects.json';
const PLACEHOLDER = '资料待上传';
const DOCX_TITLE = '产教融合服务平台项目情况汇报';

const DISPLAY_NAMES = [
  '高校党组织管理平台项目介绍',
  '科技成果转化平台项目介绍',
  '科研项目申报系统简介'
];

const SOURCE_IMAGES = [
  '截图-科技成果列表.png',
  '截图-企业需求列表.png',
  '截图-管理后台统计.png',
  '截图-操作日志.png',
  '微信图片_20261109162755_36_102.jpg',
  '微信图片_20261109162756_38_102.png',
  '微信图片_20261109162757_39_102.png'
];

const STAGE_LABELS = [
  '需求分析',
  '方案设计',
  '开发实现',
  '测试验证',
  '部署上线',
  '运维迭代'
];

const DOCX_QUOTES = [
  '基于原型设计实现',
  '主要功能都已经做完，眼下还在边开发边修',
  '当前业务整体处于线下评审环节'
];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  assert.ok(exists(rel), '缺少文件：' + rel);
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/\s+/gu, ' ')
    .trim();
}

function cssText() {
  const dir = path.join(root, CSS_DIR);
  assert.ok(fs.existsSync(dir), '缺少 assets/css 目录');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.css'));
  assert.ok(files.length > 0, 'assets/css 下无 CSS 文件');
  return files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
}

function jsText() {
  const dir = path.join(root, JS_DIR);
  assert.ok(fs.existsSync(dir), '缺少 assets/js 目录');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  assert.ok(files.length > 0, 'assets/js 下无 JS 文件');
  return files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
}

function loadData() {
  return JSON.parse(read(DATA_PATH));
}

test('资料盘点与 data/projects.json 契约', () => {
  const data = loadData();
  assert.ok(data.meta, '缺少 meta');
  assert.deepEqual(data.meta.materials, { projectFolders: 3, docx: 3, screenshots: 7 }, 'meta.materials 必须是 3/3/7');
  assert.equal(Array.isArray(data.projects), true, 'projects 必须是数组');
  assert.equal(data.projects.length, 3, 'projects 必须恰好 3 条');
  assert.deepEqual(data.projects.map(p => p.name), DISPLAY_NAMES, '三个展示名必须与两轮共识一致');
  assert.ok(!data.projects.some(p => p.name === DOCX_TITLE), '展示名不得出现 docx 标题');
  for (const p of data.projects) {
    assert.equal(p.status, null, 'status 必须为 null');
    assert.equal(p.progress, null, 'progress 必须为 null');
    assert.equal(p.updatedAt, null, 'updatedAt 必须为 null');
    assert.deepEqual(p.links, [], 'links 必须为空数组');
    assert.ok(typeof p.id === 'string' && p.id.length > 0, 'id 必须为非空字符串');
    assert.ok(typeof p.content === 'string', 'content 必须为字符串');
    assert.ok(typeof p.stage === 'string', 'stage 必须为字符串');
    assert.ok(typeof p.stageNote === 'string', 'stageNote 必须为字符串');
    assert.ok(typeof p.dataNote === 'string', 'dataNote 必须为字符串');
    assert.ok(Array.isArray(p.sourceFiles), 'sourceFiles 必须为数组');
    assert.ok(Array.isArray(p.screenshots), 'screenshots 必须为数组');
  }
});

test('展示命名与 1 个汇总占位行', () => {
  const visible = visibleText(read(HTML_PATH));
  assert.ok(visible.includes(DISPLAY_NAMES[0]), '缺少展示名：' + DISPLAY_NAMES[0]);
  assert.ok(visible.includes(DISPLAY_NAMES[1]), '缺少展示名：' + DISPLAY_NAMES[1]);
  assert.ok(visible.includes(DISPLAY_NAMES[2]), '缺少展示名：' + DISPLAY_NAMES[2]);
  assert.equal(visible.split(PLACEHOLDER).length - 1, 1, '「资料待上传」必须在可见正文恰好出现 1 次');
  assert.ok(!visible.includes(DOCX_TITLE), '页面不得出现 docx 标题');
  assert.ok(!visible.includes('并列'), '页面不得出现并列展示说明');
  assert.ok(visible.includes(UNIQUE_SOURCE), '页面必须写明 data/projects.json 唯一源');
  assert.ok(visible.includes('3 个项目文件夹'), '资料声明必须写明 3 个项目文件夹');
  assert.ok(visible.includes('3 份 docx'), '资料声明必须写明 3 份 docx');
  assert.ok(visible.includes('7 张截图'), '资料声明必须写明 7 张截图');
});

test('六段阶段框架与 docx 原话', () => {
  const html = read(HTML_PATH);
  const visible = visibleText(html);
  assert.equal((html.match(/data-stage/g) || []).length, 6, '页面必须有 6 个独立 data-stage 块');
  for (const label of STAGE_LABELS) assert.ok(visible.includes(label), '缺少阶段标签：' + label);
  for (const q of DOCX_QUOTES) assert.ok(visible.includes(q), '缺少 docx 原话：' + q);
  assert.ok(!visible.includes('SDLC'), '页面不得出现 SDLC');
  assert.ok(!visible.includes('映射'), '页面不得出现 SDLC 映射');
  assert.ok(visible.includes('—'), '缺失值必须显示 —');
});

test('静态 HTML 无 JS 正文可见且构建期内联 JSON', () => {
  const html = read(HTML_PATH);
  const visible = visibleText(html);
  assert.match(html, /<body[\s\S]*<\/body>/u, '缺少 body 静态正文');
  assert.ok(visible.length > 100, '静态可见正文过短');
  for (const name of DISPLAY_NAMES) assert.ok(visible.includes(name), '无 JS 时仍须可见：' + name);
  assert.match(html, /<script[^>]*id="projects"[^>]*type="application\/json"[^>]*>/u, '缺少 application/json 内联标签');
  const inline = html.match(/<script[^>]*id="projects"[^>]*>([\s\S]*?)<\/script>/u);
  assert.ok(inline, '缺少 id="projects" 的内联 JSON 标签');
  assert.deepEqual(JSON.parse(inline[1]), loadData(), '内联 JSON 必须与 data/projects.json 深相等');
  assert.doesNotMatch(html, /fetch\s*\(/u, 'HTML 运行期不得 fetch');
});

test('HTML 零写死百分比/零空 href/零 onclick', () => {
  const html = read(HTML_PATH);
  const visible = visibleText(html);
  assert.doesNotMatch(visible, /\b\d{1,3}\s*%/u, '可见正文不得写死百分比');
  assert.doesNotMatch(html, /style\s*=\s*["'][^"']*\d{1,3}\s*%/u, 'HTML 属性不得写死百分比');
  assert.doesNotMatch(html, /href\s*=\s*["']\s*["']/u, '不得出现空 href');
  assert.doesNotMatch(html, /href\s*=\s*["']#["']/u, '不得出现 href="#"');
  assert.doesNotMatch(html, /\bonclick\s*=/iu, '不得出现 onclick');
  assert.doesNotMatch(html, /javascript:/iu, '不得出现 javascript: 协议');
  assert.doesNotMatch(html, /(?:src|href)\s*=\s*["']https?:\/\//iu, '不得引用外部 http(s) 资源');
  assert.doesNotMatch(html, /<base\b/iu, '不得出现 base 外链基准');
});

test('缺失值不伪造 0%', () => {
  const visible = visibleText(read(HTML_PATH));
  assert.doesNotMatch(visible, /0\s*%/u, '静态正文不得出现 0% 假象');
  assert.ok(visible.includes('—'), '缺失值必须显示 —');
});

test('data/projects.json 唯一源说明', () => {
  const readme = read(README_PATH);
  const visible = visibleText(read(HTML_PATH));
  assert.match(readme, /data\/projects\.json/u, 'README 必须保留唯一源说明');
  assert.ok(visible.includes(UNIQUE_SOURCE), '页面必须写明 data/projects.json 唯一源');
  const dataDir = path.join(root, 'data');
  assert.ok(fs.existsSync(dataDir), '缺少 data 目录');
  assert.deepEqual(fs.readdirSync(dataDir).filter(f => f.endsWith('.json')), ['projects.json'], 'data 下只允许 projects.json 一个 JSON 数据源');
  assert.ok(!fs.existsSync(path.join(dataDir, 'projects.js')), '不得回退到 data/projects.js');
});

test('构建脚本构建期内联且零 fetch', () => {
  const build = read(BUILD_PATH);
  assert.match(build, /data\/projects\.json/u, '构建脚本必须读 data/projects.json');
  assert.match(build, /pages\/index\.html/u, '构建脚本必须写 pages/index.html');
  assert.match(build, /application\/json/u, '构建脚本必须处理 application/json 内联');
  assert.match(build, /readFileSync/u, '构建脚本必须读文件');
  assert.match(build, /writeFileSync/u, '构建脚本必须写文件');
  assert.doesNotMatch(build, /fetch\s*\(/u, '构建脚本不得 fetch');
});

test('CSS 首行 Hallmark 与 token/布局/可访问性', () => {
  const css = cssText();
  const firstNonEmpty = css.split(/\r?\n/u).find(l => l.trim().length > 0) || '';
  assert.match(firstNonEmpty, /Hallmark/iu, 'CSS 首行缺少 Hallmark stamp');
  assert.match(css, /:root\s*\{/u, '缺少 :root token 定义');
  assert.match(css, /--[a-z-]+\s*:/u, '缺少 --token 变量');
  assert.match(css, /overflow-x\s*:\s*clip/u, '缺少 overflow-x: clip');
  assert.match(css, /minmax\(\s*0\s*,\s*1fr\s*\)/u, '缺少 minmax(0,1fr)');
  assert.match(css, /overflow-wrap/u, '缺少 overflow-wrap');
  assert.match(css, /:focus-visible/u, '缺少 :focus-visible');
  assert.match(css, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/u, '缺少 prefers-reduced-motion');
});

test('少量入场动效与进度条零动画', () => {
  const css = cssText();
  assert.match(css, /@keyframes/u, '缺少入场动效 keyframes');
  assert.match(css, /opacity/u, '入场动效应使用 opacity');
  assert.doesNotMatch(css, /transition\s*:\s*all/iu, '禁止 transition: all');
  assert.doesNotMatch(css, /scaleX/u, '进度条禁止 scaleX 动画');
  assert.doesNotMatch(css, /transition\s*:\s*[^;]*(?:width|transform)/iu, '进度条禁止 width/transform 过渡');
  assert.doesNotMatch(css, /\.progress[^{]*\{[^}]*animation/isu, '进度条禁止 animation');
  assert.doesNotMatch(css, /\[data-progress\][^{]*\{[^}]*animation/isu, '进度条禁止 animation');
  assert.doesNotMatch(css, /@keyframes[^{]*\{[\s\S]*?(?:width|scaleX|transform)/isu, '入场动效不得动画 width/scaleX/transform');
});

test('JS 严格区分 progress === 0 与 progress == null', () => {
  const js = jsText();
  assert.match(js, /progress\s*===\s*0/u, '缺少 progress === 0 真实零值分支');
  assert.match(js, /progress\s*==\s*null/u, '缺少 progress == null 缺失值分支');
  assert.match(js, /aria-label/u, '缺少 aria-label 区分可读文案');
  assert.match(js, /进度未提供/u, '缺少 null 分支可读文案');
  assert.match(js, /0%/u, '缺少真实 0 分支可读文案');
  assert.match(js, /—/u, '缺少缺失值 — 文案');
  assert.doesNotMatch(js, /fetch\s*\(/u, 'JS 运行期不得 fetch');
  assert.doesNotMatch(js, /requestAnimationFrame/u, 'JS 不得驱动帧动画');
  assert.doesNotMatch(js, /setInterval/u, 'JS 不得轮询动画');
});

test('7 张截图落盘且 HTML 引用', () => {
  const imagesDir = path.join(root, IMAGES_DIR);
  assert.ok(fs.existsSync(imagesDir), '缺少 assets/images 目录');
  const images = fs.readdirSync(imagesDir).filter(f => /\.(png|jpe?g|webp|gif)$/iu.test(f));
  assert.equal(images.length, 7, 'assets/images 必须恰好 7 张截图');
  assert.deepEqual(images.slice().sort(), SOURCE_IMAGES.slice().sort(), '7 张截图文件名必须与来源一致');
  const html = read(HTML_PATH);
  for (const img of SOURCE_IMAGES) assert.ok(html.includes(img), 'HTML 未引用截图：' + img);
});

test('sourceFiles 与 screenshots 盘点', () => {
  const data = loadData();
  const allSource = data.projects.flatMap(p => p.sourceFiles);
  const docx = allSource.filter(f => String(f).endsWith('.docx'));
  assert.equal(docx.length, 3, 'sourceFiles 中必须恰好 3 份 docx');
  assert.ok(docx.some(f => f.includes('高校党组织管理平台项目介绍.docx')), '缺少第一份 docx');
  assert.ok(docx.some(f => f.includes('产教融合服务平台项目介绍.docx')), '缺少第二份 docx');
  assert.ok(docx.some(f => f.includes('科研项目申报系统简介.docx')), '缺少第三份 docx');
  const allShots = data.projects.flatMap(p => p.screenshots).map(s => String(s).split(/[\\/]/u).pop());
  assert.equal(allShots.length, 7, 'screenshots 合计必须恰好 7 张');
  assert.deepEqual(allShots.slice().sort(), SOURCE_IMAGES.slice().sort(), 'screenshots 文件名必须与来源一致');
  const notes = data.projects.map(p => p.stageNote).join('\n');
  for (const q of DOCX_QUOTES) assert.ok(notes.includes(q), 'stageNote 缺少 docx 原话：' + q);
  assert.doesNotMatch(JSON.stringify(data), /SDLC/u, '数据不得出现 SDLC');
  assert.doesNotMatch(JSON.stringify(data), /映射/u, '数据不得出现 SDLC 映射');
  assert.doesNotMatch(JSON.stringify(data), /并列/u, '数据不得出现冲突并列说明');
});

test('汇总占位行不进入 projects 数组', () => {
  const data = loadData();
  assert.equal(data.projects.length, 3, 'projects 仍为 3 条');
  assert.ok(!data.projects.some(p => p.name === PLACEHOLDER), '占位行不得成为项目记录');
  const visible = visibleText(read(HTML_PATH));
  assert.equal(visible.split(PLACEHOLDER).length - 1, 1, '页面恰好 1 个汇总占位行');
});

test('静态 file:// 与运行期零 fetch 汇总', () => {
  const html = read(HTML_PATH);
  const js = exists(JS_DIR) ? (() => {
    const dir = path.join(root, JS_DIR);
    return fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  })() : '';
  const build = exists(BUILD_PATH) ? read(BUILD_PATH) : '';
  assert.doesNotMatch(html, /fetch\s*\(/u, 'HTML 不得 fetch');
  assert.doesNotMatch(js, /fetch\s*\(/u, 'JS 不得 fetch');
  assert.doesNotMatch(build, /fetch\s*\(/u, '构建脚本不得 fetch');
  assert.doesNotMatch(html, /type\s*=\s*["']module["'][^>]*\bfrom\s*["']https?:/iu, 'HTML 不得远程模块导入');
  assert.match(html, /<script[^>]*id="projects"[^>]*type="application\/json"[^>]*>/u, '必须内联 application/json');
});
