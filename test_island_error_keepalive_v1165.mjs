/* test_island_error_keepalive_v1165.mjs —— 「这个岛还没下载过 / 网络有点慢」页点「返回首页」后，网好了再点同一个岛：真的去加载这个岛
 *
 * 复查（v1165 第 1 轮 SH1 / REG-03）：首页外壳把藏起来的岛框留着（保活），再点同一个岛就直接拿出来用。
 *   可框里要是 SW 给的错误页（没有带版本号的脚本），也被当成「岛」留着：孩子照提示点「返回首页」、网好了再点这个岛，
 *   看到的还是那张错误页，而且一个请求都不发（只有找到「再试一次」才出得来）。
 *
 * 合同（SW 接管首页；真点首页岛卡）：
 *   ① 断网点一个没去过的岛（职业岛）→ 看到「这个岛还没下载过」，点上面的「返回首页」→ 回到首页
 *   ② 联网后再点职业岛 → 真的去要了这个岛的页面，打开的是真的职业岛（不是那张错误页）
 *   ③ 正常玩过的岛（还是职业岛）回首页再点 → 照旧瞬间拿出来用（保活不受影响：不重新请求这个岛）
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
const hits = [];
const srv = http.createServer((req, res) => {
  hits.push(req.url);
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
const FILE = 'island_job.html';
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (window.top === window && !localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__seeded', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  const controlled = await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 60000 }).then(() => true).catch(() => false);
  ok(controlled, 'SW 接管了首页');
  await page.waitForFunction(f => typeof window.openIsland === 'function' && document.querySelector(`a.island[href="${f}"]`), FILE, { timeout: 30000 });
  await sleep(1500);
  const tapCard = async () => {
    const pt = await page.evaluate(async f => { const a = document.querySelector(`a.island[href="${f}"]`); a.scrollIntoView({ block: 'center' }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const b = a.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, FILE);
    await page.touchscreen.tap(pt.x, pt.y);
  };
  const frameState = () => page.evaluate(() => {
    const f = document.getElementById('islandFrame'), w = document.getElementById('islandFrameWrap');
    let t = '', home = false, island = false; try { t = (f.contentDocument.body && f.contentDocument.body.textContent || '').replace(/\s+/g, ' ').slice(0, 30); home = !!f.contentDocument.getElementById('hsnNavHome'); island = !!(f.contentWindow.S && typeof f.contentWindow.showScreen === 'function'); } catch (e) {}
    return { wrap: w.style.display, text: t, errorPage: home, island };
  });

  console.log('\n▶ ① 断网点职业岛');
  await ctx.setOffline(true);
  await tapCard();
  let s1 = null;
  for (let k = 0; k < 40; k++) { await sleep(300); s1 = await frameState(); if (s1.errorPage || s1.island) break; }
  ok(s1 && s1.errorPage && /还没下载过|网络有点慢/.test(s1.text), `看到错误页（「${s1 && s1.text}」）`);
  const fr = page.frames().find(f => f.parentFrame() === page.mainFrame() && /island_job/.test(f.url()));
  if (fr) await fr.evaluate(() => document.getElementById('hsnNavHome').click()).catch(() => {});
  await sleep(1200);
  ok((await frameState()).wrap === 'none', '点「返回首页」回到了首页');

  console.log('\n▶ ② 联网后再点职业岛');
  await ctx.setOffline(false);
  await sleep(500);
  hits.length = 0;
  await tapCard();
  let s2 = null;
  for (let k = 0; k < 60; k++) { await sleep(300); s2 = await frameState(); if (s2.island) break; }
  const asked = hits.filter(u => u.split('?')[0] === '/' + FILE);
  console.log('     ' + JSON.stringify({ s2, asked }));
  ok(asked.length >= 1, `真的去要了这个岛的页面（${asked.length} 次）`);
  ok(s2 && s2.island && !s2.errorPage, `打开的是真的职业岛（${s2 && s2.island ? '岛正常' : '还是「' + (s2 && s2.text) + '」'}）`);

  console.log('\n▶ ③ 玩过的岛回首页再点：照旧保活');
  await sleep(2500);
  await page.evaluate(() => closeIsland());
  await sleep(1200);
  hits.length = 0;
  await tapCard();
  await sleep(1500);
  const s3 = await frameState();
  const asked3 = hits.filter(u => u.split('?')[0] === '/' + FILE);
  ok(s3.island && s3.wrap === 'block' && asked3.length === 0, `瞬间拿出来用，没有重新请求这个岛（请求 ${asked3.length} 次）`);
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 错误页不再被当成岛留着；网好了再点就真的去加载');
process.exit(fails ? 1 : 0);
