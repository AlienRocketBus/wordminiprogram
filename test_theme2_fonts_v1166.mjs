// 主题 2.0 字体计划测试（不联网、约 5 秒）
//  ① 新文件里没有 'Bowlby One'（从没打包过）、没有 serif 兜底；只用仓库里已有的两个字体文件
//  ② 真浏览器问 Chromium“实际用哪个字体画的”：标题=CartoonBlack，英文和数字=Baloo2，正文≠衬线体
//  ③ CartoonBlack 在 DOMContentLoaded 后注入一次（以前要等 window.load）；页面已有声明就不重复
//  ④ 没有任何外网字体请求
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, findOne, serve, browser, scorer } from './攻坚笔记/theme2/tools/testkit.mjs';

const t = scorer('主题 2.0 字体计划');
const FONTS = findOne(/^hansen_theme2_fonts_v\d{4}\.js$/);
const files = ['theme2_tokens.css', 'theme2_base.css', FONTS, findOne(/^hansen_theme2_registry_v\d{4}\.js$/), findOne(/^hansen_theme2_icons_v\d{4}\.js$/)];
try { files.push(findOne(/^hansen_fx_v\d{4}\.js$/)); } catch (e) {}
const strip = s => s.replace(/\/\*[\s\S]*?\*\/|(^|[^:'"])\/\/[^\n]*/g, '$1');
for (const f of files) {
  const s = strip(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  t.ok(!/Bowlby/i.test(s), `${f}：代码里没有 'Bowlby One'`);
  t.ok(!/(^|[,\s"'(])serif\b/i.test(s.replace(/sans-serif/gi, '')), `${f}：没有 serif 兜底`);
  t.ok(!/fonts\.googleapis|fonts\.gstatic|https?:\/\/[^'")\s]+\.woff2?/.test(s), `${f}：没有外网字体`);
  const urls = [...s.matchAll(/url\(['"]?([^'")]+\.woff2)['"]?\)/g)].map(m => m[1]);
  t.ok(urls.every(u => fs.existsSync(path.join(ROOT, u))) && urls.every(u => /^(baloo2|cartoon_font)\.woff2$/.test(u)), `${f}：只引用仓库里已有的字体文件`, urls);
}

{
  const code = fs.readFileSync(path.join(ROOT, FONTS), 'utf8');
  const bare = code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').replace(/'(?:\\.|[^'\\])*'/g, "''").replace(/"(?:\\.|[^"\\])*"/g, '""');
  t.ok(!/=>|\blet\s|\bconst\s|`|\bclass\s/.test(bare), `${FONTS}：只用 ES5 写法（旧手机内核）`);
  t.ok(!/setInterval|setTimeout|requestAnimationFrame/.test(bare), `${FONTS}：没有定时器，只在 DOMContentLoaded 跑一次`);
  t.ok(!/\?v=\d|\b1166\b/.test(code), `${FONTS}：文件里没有版本号字面量`);
}
const page = (extra = '') => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/theme2_tokens.css"><link rel="stylesheet" href="/theme2_base.css">${extra}
<script src="/${FONTS}"></script><script>window.__early=!!document.getElementById('t2-font-display');
document.addEventListener('DOMContentLoaded',function(){window.__atDCL=!!document.getElementById('t2-font-display');});</script></head>
<body class="t2-page"><h1 class="t2-display" id="d">单词大冒险</h1><div class="t2-latin" id="l">Apple 123</div><div class="t2-num" id="n">1,280</div>
<div class="t2-word" id="w">elephant</div><p id="b">今天也来冒险吧，复习六个单词。</p></body></html>`;
const srv = await serve({ '/__t2/f.html': page(), '/__t2/f2.html': page("<style>@font-face{font-family:'CartoonBlack';src:url('cartoon_font.woff2') format('woff2');font-weight:900}</style>") });
const br = await browser();
try {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const outside = []; await ctx.route(/^(?!http:\/\/127\.0\.0\.1)/, r => { outside.push(r.request().url()); r.abort(); });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(srv.base + '/__t2/f.html', { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate(() => Promise.all([document.fonts.load('900 20px CartoonBlack', '单词大冒险'), document.fonts.load('800 20px Baloo2', 'Apple 123')]));
  const st = await pg.evaluate(() => ({ early: window.__early, dcl: window.__atDCL, n: document.querySelectorAll('#t2-font-display').length }));
  t.ok(st.early === false && st.dcl === true && st.n === 1, 'CartoonBlack：首屏 CSS 里不带（不抢首屏流量），DOMContentLoaded 时注入一次', st);
  const cdp = await ctx.newCDPSession(pg); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const used = {};
  for (const id of ['d', 'l', 'n', 'w', 'b']) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#' + id });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    used[id] = fonts.map(f => f.familyName + '×' + f.glyphCount);
  }
  const fam = id => used[id].map(x => x.split('×')[0]);
  /* CartoonBlack 文件没有字体名表，Chromium 报成 “OTS derived font”；重点是不能落到系统字 */
  t.ok(used.d.length === 1 && /^(CartoonBlack|OTS derived font)×5$/.test(used.d[0]), '标题 5 个字全部用 CartoonBlack 画（不是系统字）', used.d);
  t.ok(fam('l').every(f => /Baloo/.test(f)) && fam('n').every(f => /Baloo/.test(f)) && fam('w').every(f => /Baloo/.test(f)), '英文、数字、目标词实际全部用 Baloo2 画（含逗号）', { l: used.l, n: used.n, w: used.w });
  t.ok(fam('b').length > 0 && fam('b').every(f => !/serif/i.test(f.replace(/sans/i, '')) && !/Liberation Serif|Times|Song|Ming/i.test(f)), '正文用系统无衬线字（不会落到衬线体）', used.b);
  const pg2 = await ctx.newPage();
  await pg2.goto(srv.base + '/__t2/f2.html', { waitUntil: 'load' });
  const st2 = await pg2.evaluate(() => document.querySelectorAll('#t2-font-display').length);
  t.ok(st2 === 0, '页面已经声明过 CartoonBlack（老模板的晚注入）→ 不重复注入', st2);
  t.ok(outside.length === 0, '没有任何外网请求', outside);
  t.ok(errs.length === 0, '页面 0 报错', errs);
  await ctx.close();
} finally {
  await br.close().catch(() => {}); await srv.close();
}
const failed = t.done();
process.exit(failed ? 1 : 0);
