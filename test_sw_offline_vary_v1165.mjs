/* test_sw_offline_vary_v1165.mjs —— 网页带着「Vary: Accept / Vary: User-Agent」响应头时，玩过的岛离线也能打开
 *
 * 复查（v1165 第 1 轮 SH2）：页面缓存改成按「路径」存一个光秃秃的 Request（不带这次导航的请求头）。
 *   离线兜底 caches.match(request, {ignoreSearch:true}) 没加 ignoreVary：服务器 / CDN 给网页加了 Vary: Accept 或
 *   Vary: User-Agent 时就对不上 → 孩子联网玩过的岛，断网再开显示「这个岛还没下载过」（origin/main 上是好的）。
 *   线上的 Vary 头查不到（代理对线上地址 403，仓库里也没有记录），所以两种都要能过。
 *
 * 合同（SW 接管；服务器给 HTML 加 Vary 头；联网打开首页 + 食物岛，然后断网）：
 *   Vary: User-Agent 和 Vary: Accept 各来一遍：断网再开食物岛，是真的食物岛（不是「还没下载过」页）；断网开首页也正常
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
let VARY = 'User-Agent';
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    const ext = path.extname(fp).toLowerCase();
    const h = { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' };
    if (ext === '.html') h.vary = VARY;
    res.writeHead(200, h); res.end(d);
  });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
try {
  for (const v of ['User-Agent', 'Accept']) {
    VARY = v;
    console.log(`\n▶ 网页带 Vary: ${v}`);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__seeded', '1'); } } catch (e) {} });
    const page = await ctx.newPage();
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    const controlled = await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 60000 }).then(() => true).catch(() => false);
    ok(controlled, 'SW 接管了首页');
    await page.goto(BASE + 'island_food.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.S && window.HansenCanonical, null, { timeout: 30000 });
    await sleep(2500);
    const cached = await page.evaluate(async () => { for (const n of await caches.keys()) { if (!/pages/.test(n)) continue; const c = await caches.open(n); for (const r of await c.keys()) if (/island_food\.html$/.test(new URL(r.url).pathname)) return true; } return false; });
    ok(cached, '联网玩过的食物岛进了页面缓存');
    await ctx.setOffline(true);
    await page.goto(BASE + 'island_food.html', { waitUntil: 'load' }).catch(() => {});
    const st = await page.waitForFunction(() => (window.S && typeof showScreen === 'function') || /还没下载过|网络有点慢/.test(document.body && document.body.textContent || ''), null, { timeout: 20000 })
      .then(() => page.evaluate(() => ({ island: !!(window.S && typeof showScreen === 'function'), text: (document.body.textContent || '').replace(/\s+/g, ' ').slice(0, 40) }))).catch(() => ({ island: false, text: '超时' }));
    ok(st.island, `断网再开食物岛：是真的食物岛（${st.island ? '岛正常' : '看到的是「' + st.text + '」'}）`);
    await page.goto(BASE + 'index.html', { waitUntil: 'load' }).catch(() => {});
    const home = await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 20000 }).then(() => true).catch(() => false);
    ok(home, '断网开首页也正常');
    await ctx.close();
  }
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 网页带 Vary 头时，玩过的岛离线照样能打开');
process.exit(fails ? 1 : 0);
