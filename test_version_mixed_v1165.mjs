/* test_version_mixed_v1165.mjs —— 新版首页里不留旧版岛页
 *
 * 事故（v1163 审计 NET-02）：发版后网慢，首页已经是新版，点进去的岛却是缓存里的旧版岛页（引用的全是旧版脚本），
 *   新旧混着跑也没人纠正；回首页再进同一个岛，外壳还直接把那份旧页面拿出来（保活）。
 *
 * 合同（不用 SW；首页、脚本、/VERSION 都是新一版，只有动物岛的 HTML 是旧的）：
 *   1. 动物岛第一次给的是旧页、重新要一次就是新页：岛框自己重新载一次，停在新版；整页不刷新
 *   2. 动物岛一直给旧页：岛框只重载一次（不循环）；回首页、服务器修好后再点动物：不再拿出旧页，换成新版
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
const swap = s => s.split('?v=' + VERSION).join('?v=' + NEXT).split('CURRENT_APP_VERSION=' + VERSION).join('CURRENT_APP_VERSION=' + NEXT);
let MODE = 'stale-first';     // 动物岛 HTML：stale-first（不带 _fresh 给旧页）/ stale（一直旧）/ new
let FRAME_LOADS = 0;          // 岛框真的去要了几次动物岛
const srv = http.createServer((req, res) => {
  const [p0, q = ''] = req.url.split('?');
  let p = decodeURIComponent(p0);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(NEXT); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    const ext = path.extname(fp).toLowerCase();
    let body = d;
    if (ext === '.html' || ext === '.js') {
      const stale = p === '/island_animal.html' && (MODE === 'stale' || (MODE === 'stale-first' && !/(?:^|&)_fresh=/.test(q)));
      body = stale ? d : swap(d.toString('utf8'));
      if (p === '/island_animal.html' && req.headers['sec-fetch-dest'] === 'iframe') FRAME_LOADS++;
    }
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
  });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
async function home() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__seeded', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const loads = []; page.on('domcontentloaded', () => loads.push(page.url()));
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
  await sleep(1500);
  return { ctx, page, loads };
}
async function tapAnimal(page) {
  const pt = await page.evaluate(() => { const a = document.querySelector('a.island[href="island_animal.html"]'); a.scrollIntoView({ block: 'center' }); const b = a.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.touchscreen.tap(pt.x, pt.y);
}
/* 岛框现在是哪一版（看它自己的脚本戳），没打开 / 没加载完就是 '' */
const frameStamp = page => page.evaluate(() => {
  const w = document.getElementById('islandFrameWrap'), f = document.getElementById('islandFrame');
  try {
    if (w.style.display !== 'block' || f.style.opacity !== '1' || f.contentDocument.readyState !== 'complete' || !/island_animal\.html$/.test(f.contentWindow.location.pathname)) return '';
    const s = f.contentDocument.querySelector('script[src*="hansen_version_watch"]'); const m = s && s.getAttribute('src').match(/[?&]v=(\d+)/); return m ? m[1] : '?';
  } catch (e) { return ''; }
}).catch(() => '');
const settle = async (page, ms) => { let last = '', t = Date.now(), stable = 0; while (Date.now() - t < ms) { const s = await frameStamp(page); if (s && s === last) { if (++stable >= 12) return s; } else stable = 0; last = s; await sleep(250); } return last; };

try {
  console.log('\n▶ 1. 第一次给旧页、再要就是新页');
  {
    MODE = 'stale-first'; FRAME_LOADS = 0;
    const { ctx, page, loads } = await home();
    await tapAnimal(page);
    const s = await settle(page, 20000);
    ok(s === NEXT, `岛框最后是新版（v${s || '没打开'}）`);
    ok(FRAME_LOADS === 2, `岛框只重新载了一次（一共要了 ${FRAME_LOADS} 次动物岛）`);
    ok(loads.length === 1, `整页没有刷新（打开 ${loads.length} 次）`);
    await ctx.close();
  }

  console.log('\n▶ 2. 一直给旧页：只重载一次；修好后再进不再拿出旧页');
  {
    MODE = 'stale'; FRAME_LOADS = 0;
    const { ctx, page, loads } = await home();
    await tapAnimal(page);
    const s1 = await settle(page, 20000);
    await sleep(6000);
    ok(FRAME_LOADS <= 2, `服务器一直给旧页：岛框不循环重载（要了 ${FRAME_LOADS} 次，停在 v${s1 || '?'}）`);
    const fr = page.frames().find(f => f.parentFrame() === page.mainFrame() && /island_animal\.html/.test(f.url()));
    if (fr) await fr.evaluate(() => goHome()).catch(() => {});
    await sleep(1200);
    MODE = 'new';
    const before = FRAME_LOADS;
    await tapAnimal(page);
    const s2 = await settle(page, 20000);
    ok(s2 === NEXT && FRAME_LOADS === before + 1, `再进动物岛：换成新版（v${s2 || '没打开'}，又要了 ${FRAME_LOADS - before} 次）`);
    ok(loads.length === 1, `整页没有刷新（打开 ${loads.length} 次）`);
    await ctx.close();
  }
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 新版首页里的旧版岛页会自己换成新版，再进也不拿旧页');
process.exit(fails ? 1 : 0);
