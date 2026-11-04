/* test_home_prefetch_shell_v1165.mjs —— 首页外壳里的岛不再在后台预取首页 index.html
 *
 * v1163：hansen_home_link.js 每个岛页打开 1.5 秒后都预取一次首页（微信里是 <link rel=prefetch>，别的浏览器是预渲染规则），
 *        为的是「单独打开的岛」点回首页能瞬开。可在首页外壳里，岛是装在首页的岛框里的，回首页只是收起岛框——
 *        首页本来就开着。结果微信里每进一个岛都多下载一份 index.html（约 210 KB），白费流量。
 *
 * 合同（微信 UA）：
 *   ① 首页外壳里真点「动物」「食物」进岛：岛框里不加预取标签/预渲染规则，岛框不发 index.html 请求
 *   ② 单独打开 island_animal.html（顶层页）：照旧预取首页（回首页瞬开那条路不变）
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const WECHAT = 'Mozilla/5.0 (Linux; Android 12; V2049A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.47.2560(0x28002F30) NetType/WIFI Language/zh_CN';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: WECHAT });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const homeReqs = [];   // 顶层导航以外的 index.html 请求：[来自哪个框, 类型]
  page.on('request', r => {
    const u = new URL(r.url());
    if (!/^\/(index\.html)?$/.test(u.pathname) || r.isNavigationRequest()) return;
    homeReqs.push({ frame: r.frame() === page.mainFrame() ? 'top' : 'island', type: r.resourceType(), t: Date.now() });
  });
  return { ctx, page, errs, homeReqs };
}
// 岛框里有没有「预取首页」的东西
const frameMarks = (fr) => fr.evaluate(() => ({
  spec: [...document.querySelectorAll('script[type="speculationrules"]')].filter(s => /index\.html/.test(s.textContent || '')).length,
  link: document.querySelectorAll('link[rel="prefetch"][href="index.html"], link[rel="prerender"][href="index.html"]').length,
})).catch(() => null);

try {
  console.log('\n▶ ① 首页外壳里进岛');
  {
    const { ctx, page, errs, homeReqs } = await newPage();
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.openIsland === 'function' && document.querySelector('a.island[href="island_animal.html"]'), null, { timeout: 30000 });
    await sleep(2500);   // 首页自己的事做完再开始数
    const t0 = Date.now();
    for (const file of ['island_animal.html', 'island_food.html']) {
      const pt = await page.evaluate(async (f) => {
        const el = document.querySelector(`a.island[href="${f}"]`); if (!el) return null;
        el.scrollIntoView({ block: 'center' }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      }, file);
      if (pt) await page.touchscreen.tap(pt.x, pt.y);
      await page.waitForFunction((f) => { const fr = document.getElementById('islandFrame'); try { return fr && fr.contentWindow.location.pathname.endsWith('/' + f) && fr.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, file, { timeout: 20000 }).catch(() => {});
      await sleep(4000);   // 预取是开岛 1.5 秒后做的，多等一会儿
      const fr = page.frames().find(f => f.parentFrame() === page.mainFrame() && f.url().includes(file));
      const marks = fr ? await frameMarks(fr) : null;
      ok(!!pt && !!fr, `真点「${file}」进了岛`);
      ok(marks && marks.spec === 0 && marks.link === 0, `${file} 岛框里没有预取首页的标签/规则 ${JSON.stringify(marks)}`);
      if (!fr) break;
      // 第一次进岛的欢迎弹窗：点掉（只点「开始冒险」金按钮）；然后真点 🗺️ 回首页，再进下一个
      await fr.evaluate(() => { const b = document.querySelector('#alertModal.show .game-btn.gold'); if (b) b.click(); }).catch(() => {});
      await sleep(400);
      const map = await fr.evaluate(() => { const b = document.querySelector('.world-map-btn'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }).catch(() => null);
      if (map) await page.touchscreen.tap(map.x, map.y);
      await page.waitForFunction(() => { const w = document.getElementById('islandFrameWrap'); return !w || w.style.display === 'none'; }, null, { timeout: 8000 }).catch(() => {});
      await sleep(900);
    }
    const fromIsland = homeReqs.filter(r => r.frame === 'island' && r.t >= t0);
    ok(fromIsland.length === 0, `进了两个岛，岛框发出的 index.html 请求 ${fromIsland.length} 次（应为 0）`);
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }
  console.log('\n▶ ② 单独打开的岛（顶层页）照旧预取首页');
  {
    const { ctx, page, errs, homeReqs } = await newPage();
    await page.goto(BASE + 'island_animal.html', { waitUntil: 'load' });
    await sleep(3500);
    const marks = await frameMarks(page.mainFrame());
    const top = homeReqs.filter(r => r.frame === 'top');
    ok(marks && (marks.spec + marks.link) >= 1, `顶层岛页有预取首页的标签 ${JSON.stringify(marks)}`);
    ok(top.length >= 1, `顶层岛页预取了首页（${top.length} 次）`);
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 首页外壳里的岛不再预取首页；单独打开的岛照旧');
