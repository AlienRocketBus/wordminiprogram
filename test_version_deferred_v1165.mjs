/* test_version_deferred_v1165.mjs —— 「回到首页时自动更新」不会把刚点进下一个岛的孩子踢出来；首页上开着对战也不刷新
 *
 * 复查（v1165 第 2 轮 R2-SH-06）：岛里发现新版本 →「有新版本，回到首页时自动更新」（这一步是对的）。
 *   孩子点 🗺️ 回首页、马上又点了另一个岛（孩子常这样）：0.9 秒后照样整页刷新，把他从刚进的岛里踢回首页。
 *   另外首页上的拼写大PK / 天梯对战屏（不在岛框里）开着时也不算「正在玩」，开机检查一到就刷新、这一局没了（只看代码）。
 *
 * 合同（不用 SW；服务器 /VERSION 先是当前版、孩子进岛后变成新一版）：
 *   ① 在岛里发现新版本：不刷新，顶上写「回到首页时自动更新」
 *   ② 点 🗺️ 回首页，0.3 秒后又点进食物岛：之后 6 秒都不刷新、食物岛一直开着
 *   ③ 回首页，可首页上开着对战屏：6 秒都不刷新
 *   ④ 对战屏关了、停在首页：几秒内刷新一次（攒着的更新照样会做）
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const NEXT = String(Number(VERSION) + 1);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
let SV = VERSION;
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(SV); }
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seed')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); localStorage.setItem('__seed', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  /* 只数真的整页重新加载（openIsland 的 history.pushState 也会触发 framenavigated，不算） */
  const navs = [];
  page.on('domcontentloaded', () => { navs.push(page.url()); });
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.HansenVersionWatch && typeof window.openIsland === 'function', null, { timeout: 30000 });
  const t0 = Date.now();
  await sleep(9000);   // 首页开机后空闲时查一次版本（最迟 8 秒）：这时还是当前版
  navs.length = 0;
  const island = file => page.evaluate(f => { const w = document.getElementById('islandFrameWrap'), fr = document.getElementById('islandFrame'); let u = ''; try { u = fr.contentWindow.location.pathname.split('/').pop(); } catch (e) {} return !!w && w.style.display === 'block' && u === f; }, file).catch(() => false);
  const bar = () => page.evaluate(() => (document.getElementById('hsn_vw_bar') || {}).textContent || '').catch(() => '');

  console.log('\n▶ ① 在岛里发现新版本');
  await page.evaluate(() => openIsland('island_animal.html'));
  await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /island_animal\.html$/.test(f.contentWindow.location.pathname) && f.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, null, { timeout: 30000 });
  SV = NEXT;
  const wait = 61000 - (Date.now() - t0);   // 1 分钟内不重复问 /VERSION
  if (wait > 0) await sleep(wait);
  await page.evaluate(() => openIsland('island_sports.html'));   // 进下一个岛：岛页的守望者开机时请顶层查一次
  await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /island_sports\.html$/.test(f.contentWindow.location.pathname) && f.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, null, { timeout: 30000 });
  let hint = '';
  for (let k = 0; k < 40 && !/回到首页时自动更新/.test(hint); k++) { await sleep(300); hint = await bar(); }
  ok(/回到首页时自动更新/.test(hint) && navs.length === 0, `不刷新，顶上写「${hint}」（刷新 ${navs.length} 次）`);

  console.log('\n▶ ② 点 🗺️ 回首页，0.3 秒后又点进食物岛');
  await page.evaluate(() => closeIsland());
  await sleep(300);
  await page.evaluate(() => openIsland('island_food.html'));
  await sleep(6000);
  ok(navs.length === 0, `6 秒里没有刷新（刷新 ${navs.length} 次${navs.length ? '：' + navs[0].replace(BASE, '') : ''}）`);
  ok(await island('island_food.html'), '食物岛一直开着');

  console.log('\n▶ ③ 回首页，首页上开着对战屏');
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'hsn_pkroom_screen'; d.className = 'on'; d.style.cssText = 'position:fixed;inset:0;z-index:99990;background:#123'; document.body.appendChild(d); });
  await page.evaluate(() => closeIsland());
  await sleep(6000);
  ok(navs.length === 0, `对战屏开着：6 秒里没有刷新（刷新 ${navs.length} 次）`);

  console.log('\n▶ ④ 对战屏关了，停在首页');
  await page.evaluate(() => { document.getElementById('hsn_pkroom_screen').remove(); window.__hsnAfterIslandClose(); });
  const t4 = Date.now();
  while (Date.now() - t4 < 9000 && navs.length === 0) await sleep(200);
  ok(navs.length === 1 && /_fresh=/.test(navs[0]), `${((Date.now() - t4) / 1000).toFixed(1)} 秒后刷新了一次（${navs.map(u => u.replace(BASE, '')).join(' , ')}）`);
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 回到首页时的自动更新等孩子真的停在首页');
