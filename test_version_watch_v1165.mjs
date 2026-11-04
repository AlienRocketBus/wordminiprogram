/* test_version_watch_v1165.mjs —— 版本守望者：自动更新不被用光、存储坏了不循环刷新、刷新不丢参数、进岛不狂查
 *
 * 事故（v1163 审计 NET-09 / NET-16 / NET-17 / MISSED#22）：
 *   · 同一个新版本只自动刷新一次 —— 发版后 CDN 有几分钟新旧混着，这唯一的一次常常刷到的还是旧文件，之后再也不自动修；
 *   · 记「修过了」的标记写不进去（存储满了 / 被禁用）时，每次打开都判定「没修过」→ 一直刷新停不下来；
 *   · 刷新只留路径（?u=… 和 #… 全丢）；
 *   · 每开一个岛（还有后台预热的页面）都去问一次 /VERSION。
 *
 * 合同（不用 SW）：
 *   a. /VERSION 新一版、文件还是旧的 → 刷新 1 次后停住；文件换成新版、过了 4 分钟、切回前台 → 再自动更新一次，到新版后不再刷新
 *   b. 记标记的存储一读写就报错 → 45 秒里最多打开 2 次（不循环刷新）
 *   c. 刷新保留原来的参数和 #：index.html?foo=1#x → ?foo=1&_fresh=…#x
 *   d. 版本一致时开首页、接连进 3 个岛（每个岛页自己也装着守望者）→ /VERSION 最多问 2 次
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
let FILES_V = VERSION, SERVER_V = NEXT, VHITS = 0;
const swap = s => s.split('?v=' + VERSION).join('?v=' + FILES_V).split('CURRENT_APP_VERSION=' + VERSION).join('CURRENT_APP_VERSION=' + FILES_V);
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { VHITS++; res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(SERVER_V); }
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
const PARTS = process.env.PARTS || 'abcd';   // 调试时只跑其中几段
async function open(url, init) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__seeded', '1'); } } catch (e) {} });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const loads = [];
  page.on('domcontentloaded', () => loads.push(page.url().replace(BASE, '')));   // 真正换了文档才算
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  return { ctx, page, loads };
}
const waitFor = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(200); } return fn(); };
const stampOf = page => page.evaluate(() => { const s = document.querySelector('script[src*="hansen_version_watch"]'); const m = s && s.getAttribute('src').match(/[?&]v=(\d+)/); return m ? m[1] : ''; }).catch(() => '');

try {
  if (PARTS.includes('a')) {
  console.log('\n▶ a. 发版头几分钟文件还是旧的：刷新一次后停住；4 分钟后切回前台再更新一次');
    FILES_V = VERSION; SERVER_V = NEXT;
    const { ctx, page, loads } = await open('index.html');
    ok(await waitFor(() => loads.length >= 2, 20000), `发现新版本，自动刷新了（${loads.join(' → ')}）`);
    await sleep(12000);
    ok(loads.length === 2, `文件还是旧的：刷新一次就停住（打开 ${loads.length} 次）`);
    FILES_V = NEXT;
    await page.waitForFunction(() => window.HansenVersionWatch && HansenVersionWatch.status().server > 0, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { const o = Date.now; Date.now = () => o() + 4 * 60 * 1000; document.dispatchEvent(new Event('visibilitychange')); });
    ok(await waitFor(() => loads.length >= 3, 12000), `4 分钟后切回前台：再自动更新一次（打开 ${loads.length} 次）`);
    await sleep(12000);
    ok(loads.length === 3, `到了新版就不再刷新（打开 ${loads.length} 次）`);
    ok(await stampOf(page) === NEXT, `现在是新版页面（v${await stampOf(page)}）`);
    await ctx.close();
  }

  if (PARTS.includes('b')) {
  console.log('\n▶ b. 记标记的存储报错：不循环刷新');
    FILES_V = VERSION; SERVER_V = NEXT;
    const { ctx, loads } = await open('index.html', () => {
      const K = 'hansen_vw_autofixed', g = Storage.prototype.getItem, s = Storage.prototype.setItem;
      Storage.prototype.getItem = function (k) { if (k === K) throw new Error('存储坏了'); return g.apply(this, arguments); };
      Storage.prototype.setItem = function (k) { if (k === K) throw new Error('存储坏了'); return s.apply(this, arguments); };
    });
    await sleep(45000);
    ok(loads.length >= 2 && loads.length <= 2, `45 秒里打开 ${loads.length} 次（应该是 2 次：刷新一次后停住）`);
    await ctx.close();
  }

  if (PARTS.includes('c')) {
  console.log('\n▶ c. 刷新保留原来的参数和 #');
    FILES_V = VERSION; SERVER_V = NEXT;
    const { ctx, page, loads } = await open('index.html?foo=1#x');
    await waitFor(() => loads.length >= 2, 20000);
    const u = new URL(page.url());
    ok(loads.length >= 2 && u.searchParams.get('foo') === '1' && /^\d+$/.test(u.searchParams.get('_fresh') || '') && u.hash === '#x', `刷新后的地址：${page.url().replace(BASE, '')}`);
    await ctx.close();
  }

  if (PARTS.includes('d')) {
  console.log('\n▶ d. 版本一致：开首页、接连进 3 个岛，/VERSION 最多问 2 次');
    FILES_V = VERSION; SERVER_V = VERSION; VHITS = 0;
    const { ctx, page, loads } = await open('index.html');
    await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
    await sleep(3000);
    for (const f of ['island_food.html', 'island_animal.html', 'island_sports.html']) {
      await page.evaluate(f => openIsland(f), f);
      await sleep(6000);
    }
    ok(VHITS >= 1 && VHITS <= 2, `/VERSION 一共问了 ${VHITS} 次`);
    ok(loads.length === 1, `版本一致：一次都不刷新（打开 ${loads.length} 次）`);
    await ctx.close();
  }
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 版本守望者：能再试、不循环、不丢参数、不狂查');
process.exit(fails ? 1 : 0);
