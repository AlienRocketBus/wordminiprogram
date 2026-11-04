/* test_sw_offline_page_v1165.mjs —— 离线时没下载过的岛：孩子看得懂的提示 + 一个能点的「返回首页」
 *
 * 事故（v1163 审计 NET-13）：离线时首页外壳里打开一个没去过的岛，全屏只有「当前页面尚未下载 / 请联网…」和「重试连接」，
 *   没有返回按钮（只能靠手机返回键）。
 *
 * 合同：SW 接管 → 断网 → 首页真点一个没去过的岛：显示「这个岛还没下载过 · 连上网再来玩吧」，有「返回首页」，真点后岛关掉回到首页。
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__seeded', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  const controlled = await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 60000 }).then(() => true).catch(() => false);
  ok(controlled, 'SW 接管了首页');
  await page.reload({ waitUntil: 'load' });   // 让首页本身也进页面缓存
  await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
  await sleep(1500);
  await ctx.setOffline(true);
  const pt = await page.evaluate(async () => { const a = document.querySelector('a.island[href="island_sports.html"]'); a.scrollIntoView({ block: 'center' }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const b = a.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.touchscreen.tap(pt.x, pt.y);
  let s = null;
  for (let i = 0; i < 80 && !s; i++) {
    s = await page.evaluate(() => { const f = document.getElementById('islandFrame'), w = document.getElementById('islandFrameWrap'); try { if (w.style.display === 'block' && f.style.opacity === '1' && /island_sports\.html$/.test(f.contentWindow.location.pathname) && f.contentDocument.readyState === 'complete') return { title: f.contentDocument.title, text: f.contentDocument.body.innerText }; } catch (e) {} return null; });
    if (!s) await sleep(150);
  }
  ok(!!s, '岛框打开了');
  ok(s && /这个岛还没下载过/.test(s.title + s.text) && /连上网再来玩/.test(s.text), `孩子看得懂的话（${s && s.text.replace(/\s+/g, ' ').slice(0, 60)}）`);
  const fr = page.frames().find(f => f.parentFrame() === page.mainFrame());
  const bt = fr ? await fr.evaluate(() => { const b = document.getElementById('hsnNavHome'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: b.textContent, h: r.height }; }) : null;
  ok(!!bt && /返回首页/.test(bt.t) && bt.h >= 44, `有一个大大的「返回首页」（${bt && bt.t}，高 ${bt && Math.round(bt.h)}px）`);
  if (bt) await page.touchscreen.tap(bt.x, bt.y);
  await sleep(1200);
  const wrap = await page.evaluate(() => document.getElementById('islandFrameWrap').style.display);
  ok(wrap === 'none', '真点「返回首页」：岛关掉、回到首页');
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 离线页有能点的返回首页');
process.exit(fails ? 1 : 0);
