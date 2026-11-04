/* test_sw_offline_islands_v1165.mjs —— 打开过的岛离线照样能玩；带版本号的脚本不再每次重下
 *
 * 事故（v1163 审计 NET-04 / MISSED#19）：sw_v944.js 的代码缓存只留 72 条（一个岛就要 90 多个脚本），而且每个代码请求
 *   哪怕缓存里有一模一样的 ?v= 地址，也照样联网重下、重写缓存；页面缓存按完整地址存（?v / ?warm / _fresh / _r 各占一格）。
 *   结果：离线时打开过的岛缺核心脚本（504），一直在白白下载。
 *
 * 合同（SW 接管；联网打开首页 + 动物/食物/运动岛）：
 *   1. 再开食物岛：带 ?v= 的脚本一个都不联网（全用缓存）
 *   2. 页面缓存按路径存：三个岛各一份，没有带 ? 的键
 *   3. 断网后依次打开三个岛：没有一个代码地址 504，岛都能正常打开
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
const ISLANDS = ['island_animal.html', 'island_food.html', 'island_sports.html'];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__seeded', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  const controlled = await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 60000 }).then(() => true).catch(() => false);
  ok(controlled, 'SW 接管了首页');
  for (const f of ISLANDS) { await page.goto(BASE + f, { waitUntil: 'load' }); await page.waitForFunction(() => window.S && window.HansenCanonical, null, { timeout: 30000 }); await sleep(2500); }

  console.log('\n▶ 1. 再开食物岛：带版本号的脚本不联网');
  hits.length = 0;
  await page.goto(BASE + 'island_food.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.S && window.HansenCanonical, null, { timeout: 30000 });
  await sleep(2500);
  const versionedNet = hits.filter(u => /\.(?:js|css)\?(?:.*&)?v=\d+/.test(u));
  ok(versionedNet.length === 0, `带 ?v= 的脚本联网 ${versionedNet.length} 次（${versionedNet.slice(0, 3).join(', ')}）`);

  console.log('\n▶ 2. 页面缓存按路径存');
  const pages = await page.evaluate(async () => { const out = []; for (const n of await caches.keys()) { if (!/pages/.test(n)) continue; const c = await caches.open(n); for (const r of await c.keys()) out.push(new URL(r.url).pathname + new URL(r.url).search); } return out; });
  console.log('    ' + pages.join(' , '));
  for (const f of ISLANDS) ok(pages.filter(p => p.startsWith('/' + f)).length === 1, `${f} 在页面缓存里正好一份`);
  ok(!pages.some(p => p.includes('?')), '页面缓存没有带 ? 的键');

  console.log('\n▶ 3. 断网后打开三个岛');
  await ctx.setOffline(true);
  const bad = []; const onResp = r => { if (/\.(?:js|css|woff2)(?:\?|$)/.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(BASE, '')); };
  page.on('response', onResp);
  for (const f of ISLANDS) {
    await page.goto(BASE + f, { waitUntil: 'load' }).catch(() => {});
    const okIsland = await page.waitForFunction(() => window.S && window.HansenCanonical && typeof showScreen === 'function', null, { timeout: 20000 }).then(() => true).catch(() => false);
    ok(okIsland, `断网打开 ${f}：岛正常`);
    await sleep(800);
  }
  page.off('response', onResp);
  ok(bad.length === 0, `代码地址 504/出错 ${bad.length} 个（${bad.slice(0, 4).join(', ')}）`);
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 打开过的岛离线照样能玩、脚本不再白下载');
process.exit(fails ? 1 : 0);
