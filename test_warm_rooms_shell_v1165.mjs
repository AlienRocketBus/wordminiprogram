/* test_warm_rooms_shell_v1165.mjs —— 首页外壳里进岛，不再在后台偷偷开整份星海页
 *
 * 事故（v1163 审计 INT-02 / NET-05 / PH-01 / SS-1 / SS-4）：去过星海/单词大陆的孩子，每从首页进一个岛，
 *   岛（在 #islandFrame 里）都会在后台建两个隐藏房间（land_map + island_season）再加三个 ?warm=1 预取页。
 *   这些房间在首页外壳里从来不会被打开（外壳用 openIsland 换页，不用 HansenRoom.open），
 *   藏着的 island_season 还会照常 save()、跑任务、初始化账本、改 lastSaveTime（首页「最近探险」因此指错岛）。
 *   直接打开 island_season.html 时，它还会预热「它自己」。
 *
 * 合同（真浏览器，4G，真点岛卡）：
 *   1. 外壳里进食物岛、停 15 秒：#islandFrame 下没有 land_map / island_season / ?warm=1 页面；岛里 HansenRoom._rooms() 为空
 *   2. 这 15 秒里没人写 wordIslandSeason / hsn_progress:星海… / hsn_season_prologue_seen
 *   3. 单独打开 island_season.html：不建 hsn_room_season（不预热自己）
 *   4. 单独打开食物岛（顶层页）：去过星海的孩子照旧预热两个房间（按需功能不受影响）
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
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
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });

const SEED = {
  hansen_onboarded: '1', hansen_room_opened_v1165_land: '1', hansen_room_opened_v1165_season: '1',
  'hsn_progress:学校大冒险': JSON.stringify({ name: '学校大冒险', totalWords: 40, learned: 3, ans: 12, cor: 9, boss: 0, level: 2, maxCombo: 4, ts: Date.now() }),
};
const WATCH = /^(?:wordIslandSeason|hsn_season_prologue_seen)$|^hsn_progress:(?:星海|单词大陆)/;

async function open(file) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(seed => {
    try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); for (const k in seed) localStorage.setItem(k, seed[k]); sessionStorage.setItem('__s', '1'); } } catch (e) {}
    /* 明确的 4G（预热的网络门槛） */
    const c = { effectiveType: '4g', saveData: false, downlink: 10, rtt: 50, addEventListener() {}, removeEventListener() {} };
    try { Object.defineProperty(Navigator.prototype, 'connection', { get: () => c, configurable: true }); } catch (e) {}
    /* 每个页面框的 setItem 都记到顶层，看谁写了星海的键 */
    try {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        try { (top.__writes = top.__writes || []).push((location.pathname.split('/').pop() + (location.search || '')) + ' ' + k); } catch (e) {}
        return orig.apply(this, arguments);
      };
    } catch (e) {}
  }, SEED);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  return { ctx, page, errs };
}

try {
  console.log('\n▶ 1. 去过星海的孩子，首页外壳里真点「食物」，停 15 秒');
  {
    const { ctx, page, errs } = await open('index.html');
    await page.waitForFunction(() => typeof window.openIsland === 'function' && document.querySelector('a.island[href="island_food.html"]'), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const pt = await page.evaluate(async () => { const el = document.querySelector('a.island[href="island_food.html"]'); el.scrollIntoView({ block: 'center' }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const b = el.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const h = document.elementFromPoint(x, y); return { x, y, hit: !!h && (h === el || el.contains(h)) }; });
    ok(pt.hit, '岛卡没被挡住');
    await page.evaluate(() => { top.__writes = []; });
    await page.touchscreen.tap(pt.x, pt.y);
    await page.waitForFunction(() => { try { return /island_food\.html$/.test(document.getElementById('islandFrame').contentWindow.location.pathname); } catch (e) { return false; } }, null, { timeout: 20000 });
    await page.waitForTimeout(15000);
    const island = page.frames().find(f => /island_food\.html/.test(f.url()) && f.parentFrame() === page.mainFrame());
    ok(!!island, '食物岛在 #islandFrame 里打开');
    const under = page.frames().filter(f => { let p = f.parentFrame(); while (p) { if (p === island) return true; p = p.parentFrame(); } return false; }).map(f => f.url().replace(BASE, ''));
    const bad = under.filter(u => /land_map\.html|island_season\.html|[?&]warm=1/.test(u));
    ok(bad.length === 0, `岛里没有后台星海页 / 预取页（${bad.join(', ') || '无'}）`);
    const rooms = island ? await island.evaluate(() => window.HansenRoom ? HansenRoom._rooms() : null) : null;
    ok(Array.isArray(rooms) && rooms.length === 0, `岛里 HansenRoom 一个房间都没建（${JSON.stringify(rooms)}）`);
    const writes = await page.evaluate(() => (top.__writes || []).slice());
    const starWrites = writes.filter(w => WATCH.test(w.split(' ').slice(1).join(' ')));
    ok(starWrites.length === 0, `没人写星海存档 / 星海快照 / 开场故事标记（${starWrites.slice(0, 4).join(' | ') || '无'}）`);
    ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ 2. 直接打开 island_season.html：不预热它自己');
  {
    const { ctx, page, errs } = await open('island_season.html');
    await page.waitForTimeout(14000);
    const r = await page.evaluate(() => ({ rooms: window.HansenRoom ? HansenRoom._rooms() : null, el: !!document.getElementById('hsn_room_season') }));
    ok(r.rooms && !r.rooms.includes('season') && !r.el, `星海岛不在自己里面再开一个星海岛（${JSON.stringify(r)}）`);
    const self = page.frames().filter(f => f !== page.mainFrame() && /island_season\.html/.test(f.url()));
    ok(self.length === 0, `没有套着的 island_season 页面（${self.length} 个）`);
    ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ 3. 单独打开食物岛（顶层页）：去过星海的孩子照旧预热两个房间');
  {
    const { ctx, page, errs } = await open('island_food.html');
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) { await page.waitForTimeout(600); ready = await page.evaluate(() => !!(window.HansenRoom && HansenRoom.isReady('land') && HansenRoom.isReady('season'))).catch(() => false); }
    ok(ready, '顶层岛页：两个星海房间照常预热（按需打开不受影响）');
    ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
    await ctx.close();
  }
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 外壳里进岛不再偷偷开星海页');
process.exit(fails ? 1 : 0);
