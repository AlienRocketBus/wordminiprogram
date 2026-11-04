/* test_hidden_island_dl_v1165.mjs —— 回首页以后，收起来的岛不再在后台下单词录音
 *
 * 复查（v1165 第 2 轮 R2-SH-05）：点 🗺️ 回首页，岛框只是藏起来（保活）。岛里的单词录音预载看的是 visibilityState ——
 *   藏起来的 iframe 还是 visible，于是 4G 上回首页 20 秒又下了 63 个录音（1.16MB）+ 2 张图（230KB）。
 *
 * 合同（不用 SW；4G（150ms / 9Mbps）；新孩子；首页外壳里进动物岛 6 秒，点 🗺️ 回首页）：
 *   ① 回首页后 15 秒：收起来的岛一个录音、一张图都不再下
 *   ② 再点动物岛（同一个岛又露出来）：录音预载接着下
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
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8, connectionType: 'cellular4g' });
  let phase = '';
  const reqs = [];
  page.on('request', r => { let f = ''; try { f = r.frame().url(); } catch (e) {} if (/island_animal\.html/.test(f) && /\.(mp3|webp|png)(\?|$)/.test(r.url())) reqs.push({ phase, u: r.url().replace(BASE, '').slice(0, 60) }); });
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
  await sleep(2500);
  phase = 'in';
  await page.evaluate(() => openIsland('island_animal.html'));
  await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /island_animal\.html$/.test(f.contentWindow.location.pathname) && f.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, null, { timeout: 30000 });
  const net = await page.evaluate(() => { try { const w = document.getElementById('islandFrame').contentWindow; const c = w.navigator.connection; return { et: c && c.effectiveType, can: w.HansenPreloadPolicy && w.HansenPreloadPolicy.canBackgroundDownload ? w.HansenPreloadPolicy.canBackgroundDownload() : null }; } catch (e) { return { err: e.message }; } });
  await sleep(6000);
  const inIsland = reqs.filter(r => r.phase === 'in' && /\.mp3/.test(r.u)).length;
  console.log(`    岛里 6 秒：下了 ${inIsland} 个录音（网络 ${JSON.stringify(net)}）`);
  ok(inIsland > 0, `岛开着时录音预载照常在下（${inIsland} 个）`);

  console.log('\n▶ ① 点 🗺️ 回首页，15 秒');
  await page.evaluate(() => closeIsland());
  await sleep(600);   // 正在路上的那一两个请求不算
  phase = 'home';
  await sleep(15000);
  const atHome = reqs.filter(r => r.phase === 'home');
  ok(atHome.length === 0, `收起来的岛 15 秒里下了 ${atHome.filter(r => /\.mp3/.test(r.u)).length} 个录音、${atHome.filter(r => !/\.mp3/.test(r.u)).length} 张图（都应是 0）${atHome.length ? '：' + atHome.slice(0, 3).map(r => r.u).join('、') : ''}`);

  console.log('\n▶ ② 再点动物岛');
  phase = 'back';
  await page.evaluate(() => openIsland('island_animal.html'));
  await sleep(8000);
  const back = reqs.filter(r => r.phase === 'back' && /\.mp3/.test(r.u)).length;
  ok(back > 0, `岛又露出来：录音预载接着下（${back} 个）`);
  ok(errs.length === 0, '页面无报错 ' + errs.slice(0, 3).join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 回首页后收起来的岛不再在后台下载');
