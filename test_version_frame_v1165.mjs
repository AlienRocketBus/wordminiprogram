/* test_version_frame_v1165.mjs —— 电脑上的「手机框」模式（_frame.html）里，版本守望者也在工作
 *
 * 事故（v1163 审计 NET-11）：电脑上选了「手机版」，游戏在 _frame.html 的手机框（iframe）里跑；
 *   框里的守望者只会把检查交给顶层，而 _frame.html 没装守望者 —— 于是一次都不查，发了新版也一直跑旧的。
 *
 * 合同（1280×800 电脑、hsnViewMode=mobile、不用 SW，/VERSION 新一版、文件还是旧的）：
 *   打开 index.html → 进手机框 → 守望者去服务器问了版本 → 顶层（_frame.html）刷新一次（保留 ?u=），之后不再刷新
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
let VHITS = 0;
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { VHITS++; res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(NEXT); }
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsnViewMode', 'mobile'); localStorage.setItem('__seeded', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const loads = [];
  page.on('domcontentloaded', () => loads.push(page.url().replace(BASE, '')));
  await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /_frame\.html/.test(location.pathname) && document.getElementById('phone'), null, { timeout: 20000 }).catch(() => {});
  ok(/_frame\.html/.test(page.url()), `电脑上进了手机框（${page.url().replace(BASE, '')}）`);
  const t0 = Date.now();
  while (Date.now() - t0 < 25000 && !loads.some(u => /_frame\.html\?.*_fresh=/.test(u))) await sleep(250);
  ok(VHITS >= 1, `守望者去服务器问了版本（${VHITS} 次）`);
  const fresh = loads.filter(u => /_frame\.html\?.*_fresh=/.test(u));
  ok(fresh.length === 1, `顶层手机框页刷新了一次（${loads.join(' → ')}）`);
  await sleep(15000);
  ok(loads.filter(u => /_fresh=/.test(u)).length === 1, `之后不再刷新（一共打开 ${loads.length} 次）`);
  const after = new URL(page.url());
  const phone = await page.evaluate(() => { const f = document.getElementById('phone'); return f ? f.getAttribute('src') : ''; }).catch(() => '');
  ok(/index\.html/.test(after.searchParams.get('u') || '') && /index\.html/.test(phone), `刷新后还是手机框里的游戏（u=${after.searchParams.get('u')}）`);
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 手机框模式里版本守望者照常工作');
process.exit(fails ? 1 : 0);
