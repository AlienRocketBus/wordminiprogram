/* test_view_transition_v1165.mjs —— 换岛 / 回首页不再冒出没人接的「ViewTransition opt-in disabled」错误
 *
 * 事故（v1163 审计 INT-11 / PH-08 / P2-21）：hansen_home_link.js 把 @view-transition{navigation:auto} 也注入到首页外壳
 *   iframe 里的岛页；iframe 里的跨文档过渡不生效，每次岛框里换页浏览器都抛一个未处理的 Promise 错误。
 *
 * 合同（首页外壳，真点）：动物 → 岛框里换一次页（和「重新加载」一样的 location.replace）→ 🗺️，来回 3 轮：
 *   0 个 ViewTransition 错误；顶层首页仍有 @view-transition 规则（单独打开的页面照样平滑）。
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
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
  await sleep(1200);
  const state = () => page.evaluate(() => { const w = document.getElementById('islandFrameWrap'), f = document.getElementById('islandFrame'); let u = '', rs = '', q = ''; try { u = f.contentWindow.location.pathname.split('/').pop(); q = f.contentWindow.location.search; rs = f.contentDocument.readyState; } catch (e) {} return { wrap: w.style.display, op: f.style.opacity, u, q, rs }; });
  const wait = async (pred, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await state(); if (pred(s)) return s; await sleep(80); } return null; };
  const tapIn = async (frame, sel) => { const pt = await frame.evaluate(async s => { const el = document.querySelector(s); if (!el) return null; el.scrollIntoView({ block: 'center' }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel).catch(() => null); if (!pt) return false; await page.touchscreen.tap(pt.x, pt.y); return true; };
  for (let k = 1; k <= 3; k++) {
    ok(await tapIn(page.mainFrame(), 'a.island[href="island_animal.html"]'), `第 ${k} 轮：真点「动物」`);
    await wait(s => s.wrap === 'block' && s.u === 'island_animal.html' && s.rs === 'complete');
    await sleep(500);
    const fr = page.frames().find(f => f.parentFrame() === page.mainFrame());
    await fr.evaluate(k => { location.replace(location.pathname + '?_r=' + k); }, k).catch(() => {});
    await wait(s => s.u === 'island_animal.html' && s.q === '?_r=' + k && s.rs === 'complete');
    await sleep(500);
    const fr2 = page.frames().find(f => f.parentFrame() === page.mainFrame());
    await fr2.evaluate(() => { const b = document.querySelector('#alertModal.show .game-btn.gold'); if (b) b.click(); }).catch(() => {});
    await sleep(300);
    ok(await tapIn(fr2, '.world-map-btn'), `第 ${k} 轮：真点 🗺️`);
    await wait(s => s.wrap === 'none', 4000);
    await sleep(500);
  }
  const vt = errs.filter(e => /ViewTransition|Transition was aborted/i.test(e));
  ok(vt.length === 0, `没有 ViewTransition 错误（${vt.length} 个：${vt[0] || ''}）`);
  const topRule = await page.evaluate(() => [...document.querySelectorAll('style')].some(s => /@view-transition/.test(s.textContent)));
  ok(topRule, '顶层首页仍有 @view-transition 规则');
  const fr = page.frames().find(f => f.parentFrame() === page.mainFrame());
  const inFrame = fr ? await fr.evaluate(() => [...document.querySelectorAll('style')].some(s => /@view-transition/.test(s.textContent))) : true;
  ok(!inFrame, '岛框里的岛页没有 @view-transition 规则');
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 换岛不再冒 ViewTransition 错误');
process.exit(fails ? 1 : 0);
