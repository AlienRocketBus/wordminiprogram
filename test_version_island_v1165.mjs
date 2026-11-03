/* test_version_island_v1165.mjs —— 发现新版本时，不把正在岛里玩的孩子踢回首页
 *
 * 事故（v1163 审计 INT-08 / NET-08）：版本守望者一发现服务器上有新版，0.9 秒后就整页刷新 ——
 *   孩子正在岛里答题，这一局直接没了，被踢回首页。
 *
 * 合同（不用 SW；服务器 /VERSION 比页面新一版，网慢、3 秒才回）：
 *   1. 首页一打开就点「动物」进岛，在岛里待 10 秒：整页一次都不刷新、岛一直开着；顶上告诉孩子「回到首页时自动更新」
 *   2. 服务器换上新版文件，点 🗺️ 回首页：正好刷新一次，刷新后是新版页面，之后不再刷新
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
let FILES_V = VERSION;          // 服务器上的文件是哪一版
const SERVER_V = NEXT;          // /VERSION 说的是哪一版
const swap = s => s.split('?v=' + VERSION).join('?v=' + FILES_V).split('CURRENT_APP_VERSION=' + VERSION).join('CURRENT_APP_VERSION=' + FILES_V);
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { setTimeout(() => { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); res.end(SERVER_V); }, 3000); return; }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    const ext = path.extname(fp).toLowerCase();
    const body = (ext === '.html' || ext === '.js') && FILES_V !== VERSION ? swap(d.toString('utf8')) : d;
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
  });
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
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__seeded', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const navs = [];
  page.on('domcontentloaded', () => navs.push(page.url()));   // 真正换了文档才算（pushState 不算）
  await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
  navs.length = 0;

  console.log('\n▶ 1. 首页一打开就进「动物」岛，玩 10 秒');
  const pt = await page.evaluate(() => { const a = document.querySelector('a.island[href="island_animal.html"]'); a.scrollIntoView({ block: 'center' }); const b = a.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.touchscreen.tap(pt.x, pt.y);
  const t0 = Date.now(); let opened = false, sawHint = '', closedEarly = false;
  while (Date.now() - t0 < 12000) {
    const s = await page.evaluate(() => {
      const w = document.getElementById('islandFrameWrap'), f = document.getElementById('islandFrame'), bar = document.getElementById('hsn_vw_bar');
      let u = ''; try { u = f.contentWindow.location.pathname.split('/').pop(); } catch (e) {}
      return { open: !!w && w.style.display === 'block' && u === 'island_animal.html', bar: bar ? bar.textContent : '' };
    }).catch(() => null);
    if (s && s.open) opened = true;
    if (s && /回到首页时自动更新/.test(s.bar)) sawHint = s.bar;
    if (opened && (!s || !s.open)) closedEarly = true;
    await sleep(250);
  }
  ok(opened, '动物岛打开了');
  ok(navs.length === 0 && !closedEarly, `在岛里 12 秒：整页一次都没刷新、岛一直开着（刷新 ${navs.length} 次）`);
  ok(!!sawHint, `顶上告诉孩子回首页时再更新（「${sawHint}」）`);

  console.log('\n▶ 2. 服务器换上新版文件，点 🗺️ 回首页');
  FILES_V = NEXT;
  const fr = page.frames().find(f => f.parentFrame() === page.mainFrame() && /island_animal\.html/.test(f.url()));
  if (fr) await fr.evaluate(() => goHome()).catch(() => {});
  const t1 = Date.now();
  while (Date.now() - t1 < 8000 && navs.length === 0) await sleep(200);
  ok(navs.length >= 1, `回到首页后自动刷新了（${((Date.now() - t1) / 1000).toFixed(1)} 秒）`);
  await page.waitForLoadState('load').catch(() => {});
  await sleep(14000);    // 刷新后的页面自己再查一次版本：不该再刷新
  ok(navs.length === 1, `正好刷新一次（${navs.length} 次：${navs.map(u => u.replace(BASE, '')).join(' , ')}）`);
  const stamp = await page.evaluate(() => { const s = document.querySelector('script[src*="hansen_version_watch"]'); const m = s && s.getAttribute('src').match(/[?&]v=(\d+)/); return m ? m[1] : ''; }).catch(() => '');
  ok(stamp === NEXT, `刷新后是新版页面（v${stamp}）`);
  const home = await page.evaluate(() => { const w = document.getElementById('islandFrameWrap'); return !!w && w.style.display !== 'block'; }).catch(() => false);
  ok(home, '刷新后停在首页');
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 有新版本时等孩子回到首页再更新，只刷新一次');
process.exit(fails ? 1 : 0);
