/* test_sw_slow_nav_v1165.mjs —— 网慢但能用时，没打开过的岛也能打开（SW 不再 12 秒掐断显示「请联网」）
 *
 * 事故（v1163 审计 NET-01）：sw_v944.js 对从没缓存过的页面限时 12 秒、而且要在这 12 秒里把整页正文读完；
 *   慢网下（几十 KB/s）一个岛 HTML 读不完就被掐断、显示「当前页面尚未下载，请联网」——网明明是通的。
 *   首页外壳到 10 秒还会把空白的 iframe 揭开。
 *
 * 合同（gzip、SW 接管）：
 *   1. island_animal.html 限速 10 KB/s、land_map.html 限速 30 KB/s：都能打开并加载完，不出离线页；
 *      岛还没到时外壳绝不把 iframe 揭开（不露白纸），10 秒后加载屏改口「网络有点慢」并有「返回首页」
 *   2. 有网但连接被掐断（真实的 fetch 失败）：显示「网络有点慢」页，它的「返回首页」能把岛关掉
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const SLOW = { '/island_animal.html': 10 * 1024, '/land_map.html': 30 * 1024 };   // 字节/秒
const BROKEN = new Set(['/island_food.html']);                                     // 连接直接断掉（预取也断，免得拿到预取副本）
const LATE_HEAD = { '/island_sports.html': 11000 };                                // 响应头 11 秒后才到（网极慢）
const gz = new Map();
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  if (BROKEN.has(p)) { req.socket.destroy(); return; }
  if (LATE_HEAD[p]) { setTimeout(() => serve(p, req, res), LATE_HEAD[p]); return; }   // 预取、导航都一样慢（免得拿到预取副本）
  serve(p, req, res);
});
function serve(p, req, res) {
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    const type = MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream';
    if (!/\.(?:html|js|css|json|webmanifest)$/i.test(fp)) { res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); return res.end(d); }
    let z = gz.get(fp); if (!z) { z = zlib.gzipSync(d); gz.set(fp, z); }
    res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', 'content-length': z.length, 'cache-control': 'no-store' });
    const rate = SLOW[p];
    if (!rate) return res.end(z);
    let off = 0; const step = Math.max(1, Math.floor(rate / 10));
    (function pump() { if (res.destroyed) return; const c = z.subarray(off, off + step); off += c.length; if (c.length) res.write(c); if (off >= z.length) return res.end(); setTimeout(pump, 100); })();
  });
}
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
  await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
  await sleep(1000);
  const shell = () => page.evaluate(() => {
    const w = document.getElementById('islandFrameWrap'), f = document.getElementById('islandFrame');
    let u = '', rs = '', title = '', home = false; try { u = f.contentWindow.location.pathname.split('/').pop(); rs = f.contentDocument.readyState; title = f.contentDocument.title; home = !!f.contentDocument.querySelector('#homeScreen, #stage'); } catch (e) {}
    const lt = (document.getElementById('islandLoadingText') || {}).textContent || '', bk = document.getElementById('islandLoadingBack');
    return { wrap: w.style.display, op: f.style.opacity, u, rs, title, home, lt, back: !!(bk && bk.style.display !== 'none' && bk.offsetParent) };
  });

  for (const [file, open] of [['island_animal.html', 'card'], ['land_map.html', 'api']]) {
    console.log(`\n▶ 1. 慢网打开 ${file}（${SLOW['/' + file] / 1024} KB/s）`);
    if (open === 'card') {
      await page.evaluate(f => { const a = document.querySelector(`a.island[href="${f}"]`); a.scrollIntoView({ block: 'center' }); a.click(); }, file);
    } else await page.evaluate(f => openIsland(f), file);
    const t0 = Date.now(); let blank = 0, sawSlowHint = false, done = null;
    while (Date.now() - t0 < 90000) {
      const s = await shell();
      if (s.wrap === 'block' && s.op === '1' && s.u !== file) blank++;
      if (/网络有点慢/.test(s.lt) && s.back) sawSlowHint = true;
      if (s.u === file && s.rs === 'complete') { done = s; break; }
      await sleep(250);
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    ok(!!done, `${secs} 秒后加载完`);
    ok(done && done.home && !/没下载|网络有点慢/.test(done.title), `是真正的页面，不是离线/网慢页（标题「${done && done.title}」）`);
    ok(blank === 0, `岛没到之前没把 iframe 揭开（露白纸 ${blank} 次）`);
    await page.evaluate(() => closeIsland());
    await sleep(800);
  }

  console.log('\n▶ 1b. 响应头 11 秒后才到：加载屏改口「网络有点慢」+「返回首页」，到了照样打开');
  {
    await page.evaluate(() => { const a = document.querySelector('a.island[href="island_sports.html"]'); a.scrollIntoView({ block: 'center' }); a.click(); });
    const t0 = Date.now(); let blank = 0, hint = false, done = null;
    while (Date.now() - t0 < 60000) {
      const s = await shell();
      if (s.wrap === 'block' && s.op === '1' && s.u !== 'island_sports.html') blank++;
      if (/网络有点慢/.test(s.lt) && s.back) hint = true;
      if (s.u === 'island_sports.html' && s.rs === 'complete') { done = s; break; }
      await sleep(250);
    }
    ok(hint, '10 秒后加载屏写「网络有点慢，还在加载…」并给「返回首页」');
    ok(blank === 0, `等的时候没把 iframe 揭开（露白纸 ${blank} 次）`);
    ok(!!done && done.home, `头到了以后照样打开（${((Date.now() - t0) / 1000).toFixed(1)} 秒）`);
    const s = await shell();
    ok(!s.back, '打开以后「返回首页」按钮收起来了');
    await page.evaluate(() => closeIsland());
    await sleep(800);
  }

  console.log('\n▶ 2. 有网但连接断了：网慢页 + 返回首页');
  await page.evaluate(() => { const a = document.querySelector('a.island[href="island_food.html"]'); a.scrollIntoView({ block: 'center' }); a.click(); });
  const t1 = Date.now(); let s2 = null;
  while (Date.now() - t1 < 20000) { const s = await shell(); if (s.u === 'island_food.html' && s.rs === 'complete' && s.wrap === 'block' && s.op === '1') { s2 = s; break; } await sleep(200); }
  ok(!!s2 && /网络有点慢/.test(s2.title), `显示「网络有点慢」页（${s2 && s2.title}）`);
  const fr = page.frames().find(f => f.parentFrame() === page.mainFrame());
  const pt = fr ? await fr.evaluate(() => { const b = document.getElementById('hsnNavHome'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: b.textContent }; }) : null;
  ok(!!pt && /返回首页/.test(pt.t), '网慢页上有「返回首页」');
  if (pt) await page.touchscreen.tap(pt.x, pt.y);
  await sleep(1200);
  const s3 = await shell();
  ok(s3.wrap === 'none', '点「返回首页」回到首页（岛关掉了）');
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 慢网能打开没去过的岛；断网/断连有能点的返回首页');
process.exit(fails ? 1 : 0);
