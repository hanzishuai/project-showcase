
import fs from 'node:fs';
import path from 'node:path';
const ROOT = String.raw`C:\Users\31598\Desktop\AIArea\DSHWork\project-showcase`;
const OUT = path.join(ROOT, 'design-variants', '2026-11-10-screen');
fs.mkdirSync(OUT, { recursive: true });
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'projects.json'), 'utf8'));
const NL = String.fromCharCode(10);
const IMG = '../../assets/images/';

const STAGES = [
 ['需求分析','文档未给结构化阶段',0],['方案设计','文档未给结构化阶段',0],['开发实现','原话：基于原型设计实现',1],['测试验证','未提供测试记录',0],['部署上线','未提供部署信息',0],['运维迭代','资料待补',0],
 ['需求分析','文档未给结构化阶段',0],['方案设计','文档未给结构化阶段',0],['开发实现','主要功能都已经做完',1],['测试验证','改完的都测过了',1],['部署上线','还没有正式上线',1],['运维迭代','资料待补',0],
 ['需求分析','文档未给结构化阶段',0],['方案设计','文档未给结构化阶段',0],['开发实现','文档未给开发阶段结论',0],['测试验证','文档未给测试结论',0],['部署上线','业务环节：线下评审',1],['运维迭代','资料待补',0]
];
const FACTS = [
 [['文档标题','高校党组织管理平台项目介绍.docx'],['结构化阶段','—'],['状态 / 进度 / 更新时间','— / — / —'],['技术栈','Spring Boot 3 + MySQL · Vue 3 + Vite'],['角色','学生 / 支部书记 / 党委书记'],['界面证据','3 张外部截图']],
 [['文档标题','文档内页标题与目录名不一致'],['结构化阶段','—'],['状态 / 进度 / 更新时间','— / — / —'],['开工与演示','10 月 27 日开工 · 计划 11 月 13 日交付演示'],['上线状态','没有正式上线，仅为演示版'],['界面证据','4 张外部截图']],
 [['文档标题','科研项目申报系统简介.docx'],['结构化阶段','—'],['状态 / 进度 / 更新时间','— / — / —'],['业务环节','线下评审（非开发阶段）'],['业务数据','379 人 / 48 家 / 378 条 · 348 条待线下评审'],['界面证据','外部截图未提供 · 文档图注 5 条']]
];
const MODELS = [
 { id:'p1', no:'01', name:'高校党组织管理平台', full:'高校党组织管理平台项目介绍', lead:'基于原型设计实现', short:'把入党全流程搬进系统',
   quote:'「高校党组织管理平台是一套面向高校党建工作的信息化管理系统，基于原型设计实现，采用前后端分离架构。」', cite:'高校党组织管理平台项目介绍.docx · P2',
   shots:['微信图片_20261109162755_36_102.jpg','微信图片_20261109162756_38_102.png','微信图片_20261109162757_39_102.png'], shotCount:'3 张界面截图',
   note:'截图含阶段计数与业务数据，均为界面证据，不换算成软件开发进度。' },
 { id:'p2', no:'02', name:'科技成果转化平台', full:'科技成果转化平台项目介绍', lead:'主要功能都已经做完', short:'学校与企业的成果对接平台',
   quote:'「主要功能都已经做完，眼下还在边开发边修……改完的都测过了，目前没发现大问题。」', cite:'产教融合服务平台项目介绍.docx · P2 · 进度叙述',
   shots:['截图-科技成果列表.png','截图-企业需求列表.png','截图-管理后台统计.png','截图-操作日志.png'], shotCount:'4 张界面截图',
   note:'20 项成果 / 20 条需求 / 9 个技术领域为演示业务数据，不是开发进度。' },
 { id:'p3', no:'03', name:'科研项目申报系统', full:'科研项目申报系统简介', lead:'当前业务整体处于线下评审环节', short:'课题申报与审核业务平台',
   quote:'「当前业务整体处于线下评审环节。」这是业务流程环节，不是软件开发阶段。', cite:'科研项目申报系统简介.docx · P2 · 业务状态',
   shots:[], shotCount:'外部截图未提供',
   note:'项目目录未附外部截图文件，仅列文档内嵌图注 5 条，不配未核对图片。' }
];
const THEMES = {
 v1:{ name:'极光卡片', en:'Aurora Cards', desc:'三张等宽玻璃卡，详情为双栏资料台', bg1:'#10162e', bg2:'#17324a', bg3:'#0d2036', ink:'#f5f8ff', sub:'#b9c9de', card:'rgba(255,255,255,.07)', line:'rgba(255,255,255,.18)', g1:'#3ddc97', g2:'#5b8cff', g3:'#b06cff', a1:'#3ddc97', a2:'#5b8cff', a3:'#ff9d76' },
 v2:{ name:'棱镜阶梯', en:'Prism Steps', desc:'错位色带总览，详情为横向六段时间轴', bg1:'#241033', bg2:'#5a1846', bg3:'#8a2a2f', ink:'#fff6f2', sub:'#e8c9d6', card:'rgba(255,255,255,.08)', line:'rgba(255,255,255,.20)', g1:'#ffb35c', g2:'#ff5f8f', g3:'#8b6cff', a1:'#ffb35c', a2:'#ff6f91', a3:'#a99bff' },
 v3:{ name:'斜切三屏', en:'Split Panels', desc:'斜切色板三栏，详情为左右分栏海报', bg1:'#062b2e', bg2:'#0e4b4f', bg3:'#123a63', ink:'#f2fffb', sub:'#b6d8d2', card:'rgba(255,255,255,.06)', line:'rgba(255,255,255,.18)', g1:'#4fe0b0', g2:'#45b6ff', g3:'#7c6cff', a1:'#4fe0b0', a2:'#45b6ff', a3:'#ffd166' },
 v4:{ name:'轨道圆点', en:'Orbit Deck', desc:'三圆放射总览，详情为三列资料甲板', bg1:'#2a1030', bg2:'#4a1b52', bg3:'#7a2a45', ink:'#fff6fb', sub:'#e5c9dd', card:'rgba(255,255,255,.07)', line:'rgba(255,255,255,.18)', g1:'#ffd36e', g2:'#ff7a9c', g3:'#9d7bff', a1:'#ffd36e', a2:'#ff7a9c', a3:'#8fd3ff' }
};
const VIDS = ['v1','v2','v3','v4'];

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fill(tpl, map){ return tpl.replace(/@@([A-Z0-9_]+)@@/g, function(m,k){ return Object.prototype.hasOwnProperty.call(map,k) ? map[k] : m; }); }
function themeVars(t){ return [ '--bg1:'+t.bg1, '--bg2:'+t.bg2, '--bg3:'+t.bg3, '--ink:'+t.ink, '--sub:'+t.sub, '--card:'+t.card, '--line:'+t.line, '--g1:'+t.g1, '--g2:'+t.g2, '--g3:'+t.g3, '--a1:'+t.a1, '--a2:'+t.a2, '--a3:'+t.a3, '--font-body:"PingFang SC","Microsoft YaHei",system-ui,sans-serif', '--u:min(0.0625vw, 0.111111vh)' ].join(';'); }

function chipsHtml(mi){
  var out = '<section class="box chips" aria-label="六段阶段框架"><h3 class="box-t">六段阶段 · 仅作分组名</h3><div class="chips-grid">';
  for(var i=0;i<6;i++){ var s=STAGES[mi*6+i]; out += '<div class="chip'+(s[2]?' on':' gray')+'"><b>'+String(i+1).padStart(2,'0')+'</b><span>'+esc(s[0])+'</span><em>'+esc(s[1])+'</em></div>'; }
  return out + '</div></section>';
}
function factsHtml(mi){
  var out = '<section class="box facts"><h3 class="box-t">事实清单</h3><dl>';
  FACTS[mi].forEach(function(f){ var v = esc(f[1]).replace(/—/g,'<code class="mv">—</code>'); out += '<div><dt>'+esc(f[0])+'</dt><dd>'+v+'</dd></div>'; });
  return out + '</dl></section>';
}
function shotsHtml(m){
  var out = '<section class="box shots"><h3 class="box-t">'+esc(m.shotCount)+' · 点击放大</h3><div class="shots-grid">';
  if(m.shots.length === 0){ out += '<div class="shot-empty"><b>外部截图未提供</b><code class="mv">—</code><small>文档内嵌图注 5 条 · 不配未核对图片</small></div>'; }
  m.shots.forEach(function(f,i){ out += '<button class="shot" type="button" data-src="'+IMG+encodeURIComponent(f)+'"><img src="'+IMG+encodeURIComponent(f)+'" alt="'+esc(m.name)+' 界面证据 '+(i+1)+'"><i>'+String(i+1).padStart(2,'0')+'</i></button>'; });
  return out + '</div><p class="shot-note">'+esc(m.note)+'</p></section>';
}
function quoteHtml(m){ return '<blockquote class="box quote"><h3 class="box-t">文档原话</h3><p>'+esc(m.quote)+'</p><cite>'+esc(m.cite)+'</cite></blockquote>'; }

function overviewHtml(){
  var cards = MODELS.map(function(m,i){ return '<a class="card c'+(i+1)+'" href="#'+m.id+'" aria-label="打开项目 '+m.no+' '+esc(m.name)+'"><span class="c-no">'+m.no+'</span><span class="c-name">'+esc(m.name)+'</span><span class="c-lead">'+esc(m.lead)+'</span><span class="c-short">'+esc(m.short)+'</span><span class="c-go">查看项目详情 <span aria-hidden="true">↗</span></span></a>'; }).join('');
  return '<section class="screen ov" id="overview"><div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div>'+
    '<header class="ov-head"><div class="kicker">项目展示 · 大屏演示</div><h1>三个项目，<br>一屏看清</h1><p>点击任一项目卡片，进入该项目的完整资料台。按 1 / 2 / 3 快速切换，Esc 返回总览。</p></header>'+
    '<div class="ov-grid">'+cards+'</div>'+
    '<footer class="ov-foot">3 个项目文件夹 · 3 份 docx · 7 张截图 · 唯一数据源 data/projects.json · 状态 / 进度 / 更新时间文档未提供，显示「<code class="mv">—</code>」</footer></section>';
}
function detailHtml(m,i){
  var tabs = MODELS.map(function(x,j){ return '<a href="#'+x.id+'"'+(j===i?' class="on"':'')+' aria-label="切换到项目 '+x.no+'">'+x.no+'</a>'; }).join('');
  return '<section class="screen dt" id="'+m.id+'"><div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div>'+
    '<header class="dt-head"><a class="back" href="#overview"><span aria-hidden="true">←</span> 返回总览</a><div class="dt-no">项目 '+m.no+' / 03</div><h2>'+esc(m.name)+'</h2><p class="dt-lead">'+esc(m.lead)+'</p><nav class="dt-tabs" aria-label="项目切换">'+tabs+'</nav></header>'+
    '<div class="dt-main">'+chipsHtml(i)+factsHtml(i)+quoteHtml(m)+shotsHtml(m)+'</div>'+
    '<footer class="dt-foot">口径：六段框架来自调研，仅作分组名；进度叙述逐字引用 DOCX 原话；零编造百分比、零联网请求 · 来源 data/projects.json</footer></section>';
}

const CSS_ALL = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow-x:clip;background:#080b16}
body{display:flex;align-items:center;justify-content:center;font-family:var(--font-body);color:var(--ink)}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit;cursor:pointer}
code.mv{font-family:var(--font-body);font-style:normal;opacity:.85}
:focus-visible{outline:2px solid var(--ink);outline-offset:calc(3*var(--u))}
.stage{position:relative;width:calc(1600*var(--u));height:calc(900*var(--u));overflow:hidden;border-radius:calc(18*var(--u));background:linear-gradient(135deg,var(--bg1),var(--bg2) 55%,var(--bg3));box-shadow:0 calc(30*var(--u)) calc(90*var(--u)) rgba(0,0,0,.45)}
.screen{position:absolute;inset:0;padding:calc(52*var(--u)) calc(72*var(--u)) calc(40*var(--u));display:flex;flex-direction:column}
.ov{z-index:1}
.orb{position:absolute;border-radius:50%;filter:blur(calc(90*var(--u)));opacity:.42;pointer-events:none}
.o1{width:calc(620*var(--u));height:calc(620*var(--u));left:calc(-120*var(--u));top:calc(-200*var(--u));background:var(--g1)}
.o2{width:calc(560*var(--u));height:calc(560*var(--u));right:calc(-100*var(--u));top:calc(60*var(--u));background:var(--g2)}
.o3{width:calc(700*var(--u));height:calc(700*var(--u));left:calc(520*var(--u));bottom:calc(-420*var(--u));background:var(--g3)}
.ov-head{position:relative;z-index:2;margin-bottom:calc(34*var(--u))}
.kicker{font-size:calc(17*var(--u));letter-spacing:0;color:var(--sub);margin-bottom:calc(14*var(--u))}
.ov-head h1{margin:0;font-size:calc(84*var(--u));line-height:1.06;font-weight:800;text-wrap:balance}
.ov-head p{margin:calc(14*var(--u)) 0 0;font-size:calc(19*var(--u));color:var(--sub);max-width:calc(860*var(--u))}
.ov-grid{position:relative;z-index:2;flex:1;display:grid;gap:calc(26*var(--u));align-items:center}
.card{position:relative;display:flex;flex-direction:column;justify-content:center;min-width:0;min-height:calc(390*var(--u));padding:calc(34*var(--u));background:var(--card);border:1px solid var(--line);border-radius:calc(28*var(--u));backdrop-filter:blur(calc(14*var(--u)));overflow:hidden}
.card::after{content:'';position:absolute;inset:auto auto calc(-90*var(--u)) calc(-90*var(--u));width:calc(260*var(--u));height:calc(260*var(--u));border-radius:50%;background:var(--accent);filter:blur(calc(70*var(--u)));opacity:.5;pointer-events:none}
.c1{--accent:var(--a1)} .c2{--accent:var(--a2)} .c3{--accent:var(--a3)}
.c-no{font-size:calc(74*var(--u));font-weight:800;line-height:1;color:var(--accent);font-variant-numeric:tabular-nums}
.c-name{margin-top:calc(18*var(--u));font-size:calc(38*var(--u));font-weight:750;line-height:1.2;overflow-wrap:anywhere}
.c-lead{margin-top:calc(14*var(--u));font-size:calc(20*var(--u));color:var(--accent)}
.c-short{margin-top:calc(8*var(--u));font-size:calc(17*var(--u));color:var(--sub)}
.c-go{margin-top:auto;padding-top:calc(26*var(--u));font-size:calc(17*var(--u));color:var(--sub)}
.ov-foot{position:relative;z-index:2;padding-top:calc(20*var(--u));font-size:calc(15*var(--u));color:var(--sub);border-top:1px solid var(--line)}
.dt{display:none;z-index:3;background:linear-gradient(135deg,var(--bg1),var(--bg2) 55%,var(--bg3))}
.dt:target{display:flex}
.dt-head{position:relative;z-index:2;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:'back tabs' 'no tabs' 'title tabs' 'lead tabs';align-items:center;gap:calc(4*var(--u)) calc(20*var(--u))}
.back{grid-area:back;font-size:calc(16*var(--u));color:var(--sub);width:max-content}
.dt-no{grid-area:no;font-size:calc(16*var(--u));color:var(--accent);font-weight:700}
#p1{--accent:var(--a1)} #p2{--accent:var(--a2)} #p3{--accent:var(--a3)}
.dt-head h2{grid-area:title;margin:0;font-size:calc(62*var(--u));font-weight:800;line-height:1.12;overflow-wrap:anywhere}
.dt-lead{grid-area:lead;margin:calc(6*var(--u)) 0 0;font-size:calc(22*var(--u));color:var(--accent)}
.dt-tabs{grid-area:tabs;display:flex;gap:calc(8*var(--u))}
.dt-tabs a{display:grid;place-items:center;width:calc(52*var(--u));height:calc(52*var(--u));border:1px solid var(--line);border-radius:calc(14*var(--u));font-size:calc(18*var(--u));color:var(--sub);background:var(--card)}
.dt-tabs a.on{border-color:var(--accent);color:var(--accent);font-weight:800}
.dt-main{position:relative;z-index:2;flex:1;margin-top:calc(22*var(--u));display:grid;gap:calc(14*var(--u));min-height:0}
.box{min-width:0;background:var(--card);border:1px solid var(--line);border-radius:calc(18*var(--u));padding:calc(14*var(--u)) calc(18*var(--u));overflow:hidden}
.box-t{margin:0 0 calc(8*var(--u));font-size:calc(14*var(--u));font-weight:700;color:var(--sub)}
.chips{grid-area:chips} .facts{grid-area:facts} .quote{grid-area:quote} .shots{grid-area:shots}
.chips-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:calc(8*var(--u))}
.chip{display:flex;flex-direction:column;gap:calc(3*var(--u));padding:calc(10*var(--u));border:1px solid var(--line);border-radius:calc(12*var(--u));background:rgba(255,255,255,.04)}
.chip.on{border-color:var(--accent);background:rgba(255,255,255,.10)}
.chip.gray{opacity:.62}
.chip b{font-size:calc(13*var(--u));color:var(--accent);font-variant-numeric:tabular-nums}
.chip span{font-size:calc(17*var(--u));font-weight:700;white-space:nowrap}
.chip em{font-size:calc(12*var(--u));font-style:normal;color:var(--sub);overflow-wrap:anywhere}
.facts dl{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:calc(6*var(--u)) calc(14*var(--u))}
.facts dl div{border-bottom:1px solid var(--line);padding-bottom:calc(5*var(--u))}
.facts dt{font-size:calc(12*var(--u));color:var(--sub)}
.facts dd{margin:calc(2*var(--u)) 0 0;font-size:calc(14*var(--u));font-weight:650;overflow-wrap:anywhere}
.quote p{margin:0;font-size:calc(18*var(--u));line-height:1.45;overflow-wrap:anywhere}
.quote cite{display:block;margin-top:calc(8*var(--u));font-size:calc(12*var(--u));font-style:normal;color:var(--sub)}
.shots-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:calc(8*var(--u))}
.shot{position:relative;padding:0;border:1px solid var(--line);border-radius:calc(12*var(--u));background:rgba(255,255,255,.05);overflow:hidden;height:calc(104*var(--u))}
.shot img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
.shot i{position:absolute;left:calc(8*var(--u));top:calc(8*var(--u));font-style:normal;font-size:calc(12*var(--u));padding:calc(2*var(--u)) calc(6*var(--u));border-radius:calc(6*var(--u));background:rgba(0,0,0,.55)}
.shot-empty{grid-column:1/-1;display:flex;align-items:center;gap:calc(12*var(--u));padding:calc(12*var(--u)) calc(14*var(--u));border:1px dashed var(--line);border-radius:calc(12*var(--u));font-size:calc(15*var(--u))}
.shot-empty small{color:var(--sub);font-size:calc(14*var(--u))}
.shot-note{margin:calc(6*var(--u)) 0 0;font-size:calc(12*var(--u));color:var(--sub)}
.dt-foot{position:relative;z-index:2;padding-top:calc(10*var(--u));font-size:calc(13*var(--u));color:var(--sub)}
.zoom{position:absolute;inset:0;z-index:9;display:none;align-items:center;justify-content:center;background:rgba(6,9,20,.92);padding:calc(40*var(--u))}
.zoom.on{display:flex}
.zoom img{max-width:100%;max-height:100%;object-fit:contain;border-radius:calc(10*var(--u))}
.zoomclose{position:absolute;right:calc(36*var(--u));top:calc(28*var(--u));padding:calc(10*var(--u)) calc(18*var(--u));border:1px solid var(--line);border-radius:calc(10*var(--u));background:var(--card);font-size:calc(16*var(--u))}
/* V1 极光卡片：等宽玻璃卡 + 双栏资料台 */
.v1 .ov-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.v1 .dt-main{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:'chips chips' 'facts quote' 'shots shots'}
.v1 .chips-grid{grid-template-columns:repeat(6,minmax(0,1fr))}
.v1 .shots-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
/* V2 棱镜阶梯：错位色带 + 横向六段轴 */
.v2 .ov-head{margin-bottom:calc(20*var(--u))}
.v2 .ov-head h1{font-size:calc(70*var(--u))}
.v2 .ov-grid{grid-template-columns:minmax(0,1fr);gap:calc(14*var(--u));align-content:center;padding-left:calc(90*var(--u))}
.v2 .card{min-height:0;height:calc(140*var(--u));flex-direction:row;align-items:center;gap:calc(30*var(--u));padding:calc(20*var(--u)) calc(34*var(--u));border-radius:calc(18*var(--u));border-left:calc(8*var(--u)) solid var(--accent)}
.v2 .card:nth-child(2){margin-left:calc(80*var(--u))} .v2 .card:nth-child(3){margin-left:calc(160*var(--u))}
.v2 .c-no{font-size:calc(52*var(--u));min-width:calc(80*var(--u))}
.v2 .c-name{margin:0;font-size:calc(34*var(--u));min-width:calc(330*var(--u))}
.v2 .c-lead,.v2 .c-short{margin:0;font-size:calc(17*var(--u))}
.v2 .c-go{margin:0 0 0 auto;padding:0;white-space:nowrap}
.v2 .dt-main{grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:auto minmax(0,1fr);grid-template-areas:'chips chips chips' 'facts quote shots'}
.v2 .chips-grid{grid-template-columns:repeat(6,minmax(0,1fr))}
.v2 .chip span{font-size:calc(17*var(--u))}
.v2 .facts dl{grid-template-columns:repeat(2,minmax(0,1fr))}
.v2 .shots-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.v2 .shot{height:calc(88*var(--u))}
/* V3 斜切三屏：斜切色板 + 左右分栏 */
.v3 .ov-head{margin-bottom:calc(24*var(--u))}
.v3 .ov-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:calc(12*var(--u));align-items:stretch}
.v3 .card{min-height:calc(460*var(--u));border-radius:0;border:0;clip-path:polygon(0 4%,100% 0,100% 96%,0 100%);background:linear-gradient(160deg,var(--accent),var(--bg2) 78%);justify-content:flex-start;padding:calc(48*var(--u)) calc(34*var(--u))}
.v3 .c-no{font-size:calc(130*var(--u));color:var(--ink);opacity:.9}
.v3 .c-name{font-size:calc(40*var(--u))}
.v3 .c-lead,.v3 .c-short,.v3 .c-go{color:var(--ink)}
.v3 .c-go{margin-top:auto}
.v3 .dt-main{grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:'facts chips' 'quote chips' 'shots shots'}
.v3 .chips-grid{grid-template-columns:repeat(6,minmax(0,1fr))}
.v3 .facts dl{grid-template-columns:repeat(2,minmax(0,1fr))}
.v3 .quote p{font-size:calc(18*var(--u))}
.v3 .shots-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
/* V4 轨道圆点：三圆放射 + 三列资料甲板 */
.v4 .ov-head{text-align:center;margin-bottom:calc(12*var(--u))}
.v4 .ov-head h1{font-size:calc(70*var(--u))}
.v4 .ov-head p{margin-left:auto;margin-right:auto}
.v4 .ov-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:calc(60*var(--u));padding:0 calc(80*var(--u));align-items:center}
.v4 .card{aspect-ratio:1;min-height:0;border-radius:50%;align-items:center;text-align:center;padding:calc(30*var(--u));border:calc(2*var(--u)) solid var(--accent);background:radial-gradient(circle at 50% 35%,var(--card),rgba(255,255,255,.02))}
.v4 .card:nth-child(2){transform:translateY(calc(-46*var(--u)))}
.v4 .c-no{font-size:calc(60*var(--u))}
.v4 .c-name{font-size:calc(28*var(--u));margin-top:calc(8*var(--u))}
.v4 .c-lead{font-size:calc(16*var(--u));margin-top:calc(8*var(--u))}
.v4 .c-short{display:none}
.v4 .c-go{margin-top:calc(14*var(--u));padding:0;font-size:calc(14*var(--u))}
.v4 .dt-main{grid-template-columns:minmax(0,1.1fr) minmax(0,.95fr) minmax(0,1fr);grid-template-rows:auto auto;grid-template-areas:'chips facts shots' 'chips quote shots'}
.v4 .chips-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.v4 .facts dl{grid-template-columns:repeat(2,minmax(0,1fr))}
.v4 .shots-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.v4 .shot{height:calc(96*var(--u))}
.v4 .shot-empty{flex-direction:column;align-items:flex-start;gap:calc(6*var(--u))}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
`;

const HTML_TPL = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="三个项目的大屏演示页：总览点击项目进入完整资料台。">
<title>@@TITLE@@ · 项目展示大屏</title>
<style>
/* Hallmark · shape: workbench · genre: editorial · theme: @@EN@@ · hero: poster · job: 16:9 project showcase · draw: 2026-11-10 */
:root{@@VARS@@}
@@CSS@@
</style></head>
<body class="@@VID@@"><main class="stage">
@@BODY@@
<div class="zoom" id="zoom" aria-hidden="true"><img id="zoomimg" src="" alt="界面证据放大图"><button class="zoomclose" type="button" id="zoomclose">关闭放大</button></div>
</main>
<script id="projects" type="application/json">@@JSON@@</script>
<script>
(function(){
  var zoom=document.getElementById('zoom'), zimg=document.getElementById('zoomimg');
  function openZoom(src){ zimg.src=src; zoom.classList.add('on'); zoom.setAttribute('aria-hidden','false'); }
  function closeZoom(){ zoom.classList.remove('on'); zoom.setAttribute('aria-hidden','true'); zimg.src=''; }
  document.getElementById('zoomclose').addEventListener('click',closeZoom);
  zoom.addEventListener('click',function(e){ if(e.target===zoom) closeZoom(); });
  document.addEventListener('click',function(e){
    var b=e.target.closest ? e.target.closest('.shot') : null;
    if(b) openZoom(b.getAttribute('data-src'));
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){ if(zoom.classList.contains('on')){closeZoom();} else {window.location.hash='#overview';} return; }
    if(e.key==='1'||e.key==='2'||e.key==='3'){ window.location.hash='#p'+e.key; return; }
    var h=window.location.hash||'#overview', n=parseInt(h.slice(2),10);
    if(e.key==='ArrowRight'){ window.location.hash='#p'+(n>=1&&n<=3?n%3+1:1); }
    if(e.key==='ArrowLeft'){ window.location.hash='#p'+(n>=1&&n<=3?(n+1)%3+1:3); }
  });
})();
</script></body></html>`;

function buildBody(){ var s=overviewHtml(); MODELS.forEach(function(m,i){ s+=detailHtml(m,i); }); return s; }
function buildOne(vid){
  var t=THEMES[vid];
  var json=JSON.stringify(DATA,null,2).replace(/</g,String.fromCharCode(92)+'u003c');
  var html=fill(HTML_TPL,{ VID:vid, TITLE:t.name, EN:t.en, VARS:themeVars(t), CSS:CSS_ALL, BODY:buildBody(), JSON:json });
  var f=path.join(OUT,vid+'-'+t.en.toLowerCase().replace(/ /g,'-')+'.html');
  fs.writeFileSync(f,html,'utf8');
  return { file:path.basename(f), bytes:Buffer.byteLength(html,'utf8'), name:t.name };
}

var made=VIDS.map(buildOne);

var idxCards=VIDS.map(function(vid,i){ var t=THEMES[vid]; var f=made[i].file; return '<a class="ic" href="'+f+'"><img src="previews/'+vid+'-overview.png" alt="'+esc(t.name)+' 总览截图"><div class="ic-b"><b>0'+(i+1)+' · '+esc(t.name)+'</b><span>'+esc(t.en)+' — '+esc(t.desc)+'</span><em>点开完整演示页 ↗</em></div></a>'; }).join('');
var idx = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>四版大屏方案 · 项目展示</title><style>'+
':root{--bg1:#10162e;--bg2:#17324a;--bg3:#0d2036;--ink:#f5f8ff;--sub:#b9c9de;--line:rgba(255,255,255,.18);--card:rgba(255,255,255,.07);--u:min(0.0625vw,0.111111vh);--font-body:"PingFang SC","Microsoft YaHei",system-ui,sans-serif}'+
'*{box-sizing:border-box}html,body{margin:0;overflow-x:clip;background:linear-gradient(135deg,var(--bg1),var(--bg2) 55%,var(--bg3));color:var(--ink);font-family:var(--font-body)}'+
'body{padding:48px 6vw 64px}a{color:inherit;text-decoration:none}:focus-visible{outline:2px solid var(--ink);outline-offset:3px}'+
'h1{margin:0;font-size:clamp(30px,4vw,56px);text-wrap:balance}p.lead{margin:14px 0 34px;font-size:clamp(15px,1.4vw,20px);color:var(--sub);max-width:820px}'+
'.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:26px}'+
'.ic{display:block;background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden}'+
'.ic img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-bottom:1px solid var(--line)}'+
'.ic-b{display:flex;flex-direction:column;gap:6px;padding:18px 22px 22px}.ic-b b{font-size:20px}.ic-b span{font-size:14px;color:var(--sub)}.ic-b em{margin-top:8px;font-size:14px;font-style:normal;opacity:.9}'+
'.foot{margin-top:34px;padding-top:18px;border-top:1px solid var(--line);font-size:14px;color:var(--sub)}'+
'@media(max-width:760px){.grid{grid-template-columns:minmax(0,1fr)}}'+
'</style></head><body><h1>四版 16:9 大屏方案</h1><p class="lead">彩色渐变＋光斑；总览一屏展示三个项目，点击项目卡片进入该项目的完整资料台（六段阶段 / 事实清单 / 文档原话 / 界面截图）。四版内容完全一致，差别只在版式与配色。点任意一张进入可交互演示页；按 1 / 2 / 3 切项目，Esc 返回总览。</p><div class="grid">'+idxCards+'</div><p class="foot">唯一数据源 data/projects.json · 每版均内联数据、零 fetch、零 CDN、禁用 JavaScript 时总览与详情仍可用（CSS :target）· 生成于 2026-11-10</p></body></html>';
fs.writeFileSync(path.join(OUT,'index.html'),idx,'utf8');
console.log('VARIANTS='+JSON.stringify(made));
console.log('INDEX_BYTES='+Buffer.byteLength(idx,'utf8'));
console.log('OUT='+OUT);
