/* test_sw_icon_fresh_v1165.mjs —— 图标换了新图（新 ?v=）以后老玩家看到的是新图；断网时旧图兜底
 *
 * 事故（v1163 审计 NET-07）：sw_v944.js 的图标分支先 caches.match(request,{ignoreSearch:true})：缓存里有旧版本的
 *   explore_3d.webp?v=1163，新版本页面要 ?v=1164 也拿到旧图 —— 图标改了内容，老玩家一直看到旧图（图标缓存代号 icons-3 从不轮换）。
 *
 * 合同（SW 接管）：先要 ?v=1163（服务器给图 A，进缓存）→ 再要 ?v=1164（服务器给图 B）：拿到的是 B；
 *   断网后要一个从没要过的 ?v=1165：用缓存里的旧图兜底（不是 504）。
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
const A = fs.readFileSync(path.join(ROOT, 'icons/explore_3d.webp')), B = fs.readFileSync(path.join(ROOT, 'icons/map_home.webp'));
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
  if (p === '/icons/explore_3d.webp') { res.writeHead(200, { 'content-type': 'image/webp', 'cache-control': 'no-store' }); return res.end(u.searchParams.get('v') === '1164' ? B : A); }
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('hansen_onboarded', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  const controlled = await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 60000 }).then(() => true).catch(() => false);
  ok(controlled, 'SW 接管了首页');
  const get = v => page.evaluate(async v => { try { const r = await fetch('icons/explore_3d.webp?v=' + v); return { status: r.status, len: (await r.arrayBuffer()).byteLength }; } catch (e) { return { status: -1, len: 0 }; } }, v);
  const r1 = await get('1163'); await sleep(800);
  ok(r1.status === 200 && r1.len === A.length, `?v=1163 拿到图 A（${r1.len}）`);
  const r2 = await get('1164'); await sleep(800);
  ok(r2.status === 200 && r2.len === B.length, `?v=1164 拿到新图 B（${r2.len}，B=${B.length}，A=${A.length}）`);
  await ctx.setOffline(true);
  const r3 = await get('1165');
  ok(r3.status === 200 && (r3.len === A.length || r3.len === B.length), `断网要 ?v=1165：旧图兜底（${r3.status}，${r3.len}）`);
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 图标换新图老玩家看得到，断网旧图兜底');
process.exit(fails ? 1 : 0);
