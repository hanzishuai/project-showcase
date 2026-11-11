import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(root, 'index.html');

function readHtml() {
  assert.ok(fs.existsSync(HTML), '根目录 index.html 必须存在');
  return fs.readFileSync(HTML, 'utf8');
}

function visibleText(html) {
  const body = html.slice(html.indexOf('<body'), html.indexOf('</body>') + 7);
  const noCode = body.replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, '');
  const noTags = noCode.replace(/<[^>]+>/g, ' ');
  return noTags.replace(/&[a-z]+;/gi, ' ');
}

test('单页结构：只有一个页面，不链向任何子页面', () => {
  const html = readHtml();
  const hrefs = [...html.matchAll(/href\s*=\s*"([^"]*)"/gi)].map((m) => m[1]);
  assert.equal(hrefs.filter((h) => /\.html?(?:[?#]|$)/i.test(h)).length, 0, '不允许链接到任何 .html 子页面');
  assert.equal((html.match(/<script\b/gi) || []).length, 0, '单页不引入脚本');
  assert.equal((html.match(/https?:\/\//gi) || []).length, 0, '不引用任何外部资源');
});

test('项目数量与分块：3 个项目，2 个在做，1 个已做', () => {
  const html = readHtml();
  for (const name of ['高校党组织管理平台', '科技成果转化平台', '科研项目申报系统']) {
    assert.ok(html.includes(name), `缺少项目：${name}`);
  }
  assert.equal((html.match(/<article class="project"/g) || []).length, 3, '应有 3 个项目块');
  assert.equal((html.match(/<p class="tag wip">在做<\/p>/g) || []).length, 2, '在做项目块应为 2 个');
  assert.equal((html.match(/<p class="tag done">已做<\/p>/g) || []).length, 1, '已做项目块应为 1 个');
});

test('在做项目按模块展示，且每个模块都有已开发完毕与正在开发两列', () => {
  const html = readHtml();
  assert.equal((html.match(/<div class="module">/g) || []).length, 12, '两个在做项目共 12 个模块');
  assert.equal((html.match(/>已开发完毕</g) || []).length, 12, '每个模块都要有已开发完毕列');
  assert.equal((html.match(/>正在开发</g) || []).length, 12, '每个模块都要有正在开发列');
});

test('每个项目都交代开发者和指导老师，缺资料时显示占位符', () => {
  const html = readHtml();
  assert.equal((html.match(/<dt>开发者<\/dt>/g) || []).length, 3, '三个项目都要有开发者字段');
  assert.equal((html.match(/<dt>指导老师<\/dt>/g) || []).length, 3, '三个项目都要有指导老师字段');
  const pairs = [...html.matchAll(/<dt>(开发者|指导老师)<\/dt><dd>([\s\S]*?)<\/dd>/g)];
  assert.equal(pairs.length, 6, '六个字段都要有值');
  for (const pair of pairs) {
    assert.match(pair[2], /<code class="missing-value">—<\/code>/, `${pair[1]} 缺资料时必须显示占位符`);
  }
});

test('已做项目展示用户数与运行时长，没有数据时显示占位符', () => {
  const html = readHtml();
  assert.ok(html.includes('使用人数'), '已做项目要有使用人数');
  assert.ok(html.includes('运行时长'), '已做项目要有运行时长');
  assert.ok(html.includes('文档未提供实时用户数'), '说明用户数缺失的原因');
  assert.ok(html.includes('文档未提供上线日期'), '说明运行时长缺失的原因');
});

test('页面引用的 7 张截图全部存在', () => {
  const html = readHtml();
  const srcs = [...html.matchAll(/<img\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi)].map((m) => m[1]);
  assert.equal(srcs.length, 7, '应引用 7 张截图');
  for (const src of srcs) {
    assert.ok(fs.existsSync(path.join(root, src)), `截图不存在：${src}`);
  }
});

test('所有破折号占位符都包在 code.missing-value 中', () => {
  const html = readHtml();
  const text = visibleText(html);
  assert.ok(!/[\u2014\u2013]/.test(text), '正文里不能直接出现破折号，必须用 code.missing-value 包裹');
  assert.ok((html.match(/<code class="missing-value">—<\/code>/g) || []).length >= 15, '缺资料处应统一使用占位符');
});

test('没有空链接、伪协议链接或点了没反应的按钮', () => {
  const html = readHtml();
  const hrefs = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*"([^"]*)"/gi)].map((m) => m[1]);
  assert.ok(hrefs.length > 0, '页面应有可用的导航链接');
  for (const href of hrefs) {
    assert.ok(href.trim() !== '' && href.trim() !== '#', `出现了空链接：${href}`);
    assert.ok(!/^javascript:/i.test(href), '不允许 javascript: 链接');
  }
  assert.equal((html.match(/\bonclick\s*=/gi) || []).length, 0, '不允许内联点击脚本');
  assert.equal((html.match(/<button\b/gi) || []).length, 0, '本页不应放无后端的按钮');
});

test('长页面提供回到顶部的入口', () => {
  const html = readHtml();
  assert.ok(/id="top"/.test(html), '页面顶部需要有 id="top" 锚点');
  assert.ok(/href="#top"/.test(html), '页脚需要提供回到顶部的链接');
});
