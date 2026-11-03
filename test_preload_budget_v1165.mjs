/* test_preload_budget_v1165.mjs —— 后台预载只替孩子准备「他真的会去」的地方
 *
 * 事故（v1163 实测，4G + 4 倍慢 CPU）：
 *   · 每开一个岛，hansen_room_warm 在后台把星海地图和星海岛整页跑一遍；星海岛自己也装着预热模块，
 *     于是在预热框里又预热一遍（套娃）→ 每个岛多下约 6MB、多 4~5 个页面，岛并没有更快可用；
 *   · 不看网络（弱网 / 省流量也下），不看孩子（从没去过星海也下）；
 *   · 被预热的星海岛会写存档 →「我的学习」说孩子去过星海，星海开场故事被标成「已看过」；
 *   · 新孩子首页 12 秒内静默下载约 4.5MB：6 个岛 + 星海地图 + 3 张 Boss 头像。
 *
 * 合同（真浏览器）：
 *   P1 新孩子首页：不预取星海地图、不空闲预取岛（推荐的第一个岛由 hansen_preload 预热）、不下 Boss 头像；手指碰到岛卡照样立刻预取
 *   P2 玩过的孩子首页：最近玩过的岛照常空闲预取，有上限；没去过星海、没学完普通岛 → 不预取星海地图
 *   P3 学完一个普通岛的孩子首页：星海地图空闲预取
 *   P4 新孩子进岛（经首页外壳）：一个星海房间都不建、不请求星海页 / 三个带参数页；「我的学习」不出现星海；开场故事没被标成已看过
 *   P5 去过星海的孩子进岛：两个房间照常预热，房间里不再套娃；藏着的星海岛不写「我的学习」快照，孩子点开后才写
 *   P6 网络策略不允许（3G）：去过星海的孩子也不预热
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

const OPENED = { hansen_room_opened_v1165_land: '1', hansen_room_opened_v1165_season: '1' };
/* 快照用别的岛：进美食岛时它自己会用真实数据覆盖「食物大冒险」那一份 */
const PLAYED = { 'hsn_progress:学校大冒险': JSON.stringify({ name: '学校大冒险', totalWords: 40, learned: 3, ans: 12, cor: 9, boss: 0, level: 2, maxCombo: 4, ts: Date.now() }), lastIslandKey: 'food' };
const FINISHED = { 'hsn_progress:动物大冒险': JSON.stringify({ name: '动物大冒险', totalWords: 41, learned: 41, ans: 300, cor: 280, boss: 3, level: 9, maxCombo: 20, ts: Date.now() }) };

async function open(file, seed = {}, { slowNet = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([s, slow]) => {
    try {
      if (!sessionStorage.getItem('__s')) {
        localStorage.clear(); localStorage.setItem('hansen_onboarded', '1');
        for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
        sessionStorage.setItem('__s', '1');
      }
    } catch (e) {}
    if (slow) {
      const c = { effectiveType: '3g', saveData: false, downlink: 1.2, rtt: 300, addEventListener() {}, removeEventListener() {} };
      try { Object.defineProperty(Navigator.prototype, 'connection', { get: () => c, configurable: true }); } catch (e) {}
    }
  }, [seed, slowNet]);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const reqs = []; page.on('request', r => reqs.push(r.url().replace(BASE, '')));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  return { ctx, page, errs, reqs };
}
const islandFrame = page => page.frames().find(f => /island_food\.html/.test(f.url()) && f.parentFrame() === page.mainFrame());
const lsOf = frame => frame.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });

/* ── P1 新孩子首页 ── */
console.log('\n▶ P1 新孩子首页 12 秒');
{
  const { ctx, page, errs, reqs } = await open('index.html');
  await page.waitForTimeout(12000);
  ok(!reqs.some(u => /^land_map\.html/.test(u)), '没去过星海：首页不空闲预取星海地图');
  const pf = await page.evaluate(() => window.HansenIslandPrefetch ? HansenIslandPrefetch.prefetched() : null);
  ok(Array.isArray(pf) && pf.length === 0, `没玩过：不空闲预取岛卡（实取 ${pf && pf.join(',')}）`);
  const islandHtml = [...new Set(reqs.filter(u => /^island_[a-z0-9]+\.html/.test(u)).map(u => u.split('?')[0]))];
  ok(islandHtml.length <= 1, `只预热推荐的第一个岛（实请求 ${islandHtml.join(',') || '无'}）`);
  ok(!reqs.some(u => /bosses\/lv\d\d/.test(u)), '没玩过：首页不下 Boss 头像');
  await page.evaluate(() => { const a = document.querySelector('a.island[href="island_food.html"]'); a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => HansenIslandPrefetch.prefetched().includes('island_food.html')), '手指碰到岛卡：照样立刻预取');
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ── P2 玩过的孩子首页 ── */
console.log('\n▶ P2 玩过（没去过星海）的孩子首页');
{
  const { ctx, page, errs, reqs } = await open('index.html', PLAYED);
  await page.waitForTimeout(12000);
  const pf = await page.evaluate(() => HansenIslandPrefetch.prefetched());
  ok(pf.includes('island_food.html'), `玩过：最近玩过的岛照常空闲预取（${pf.join(',')}）`);
  ok(pf.length <= 6, `空闲预取有上限（${pf.length} 个）`);
  ok(!reqs.some(u => /^land_map\.html/.test(u)), '没去过星海、没学完普通岛：不预取星海地图');
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ── P3 学完一个普通岛 ── */
console.log('\n▶ P3 学完一个普通岛的孩子首页');
{
  const { ctx, page, errs, reqs } = await open('index.html', { ...PLAYED, ...FINISHED });
  await page.waitForTimeout(10000);
  ok(reqs.some(u => /^land_map\.html/.test(u)), '学完一个普通岛：空闲时预取星海地图');
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ── P4 新孩子进岛 ── */
console.log('\n▶ P4 新孩子从首页进美食岛，停 18 秒');
{
  const { ctx, page, errs, reqs } = await open('index.html');
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.openIsland('island_food.html'));
  await page.waitForTimeout(18000);
  const f = islandFrame(page);
  ok(!!f, '美食岛在首页外壳里打开');
  const rooms = f ? await f.evaluate(() => window.HansenRoom ? HansenRoom._rooms() : null) : null;
  ok(Array.isArray(rooms) && rooms.length === 0, `没去过星海：岛里一个星海房间都不建（${rooms && rooms.join(',')}）`);
  ok(!reqs.some(u => /^(?:island_season|land_map|boss_hall|season_showcase|spelling_bee)\.html/.test(u)),
    '不请求星海页、也不请求三个带参数页');
  const ls = f ? await lsOf(f) : {};
  ok(!Object.keys(ls).some(k => k.startsWith('hsn_progress:') && /星海|单词大陆/.test(k)), '「我的学习」里没有凭空多出星海');
  ok(!('hsn_season_prologue_seen' in ls) && !('wordIslandSeason' in ls), '星海开场故事没被标成已看过、没有星海存档');
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ── P5 去过星海的孩子 ── */
console.log('\n▶ P5 去过星海、玩过的孩子直接进美食岛');
{
  const { ctx, page, errs } = await open('island_food.html', { ...OPENED, ...PLAYED });
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) { await page.waitForTimeout(600); ready = await page.evaluate(() => !!(window.HansenRoom && HansenRoom.isReady('land') && HansenRoom.isReady('season'))).catch(() => false); }
  ok(ready, '两个星海房间照常在后台预热好');
  await page.waitForTimeout(6000);
  const docs = page.frames().map(f => f.url());
  const nSeason = docs.filter(u => /island_season\.html/.test(u)).length, nLand = docs.filter(u => /land_map\.html/.test(u)).length;
  ok(nSeason === 1 && nLand === 1, `不套娃：星海岛 ${nSeason} 个、星海地图 ${nLand} 个页面`);
  const seasonFrame = page.frames().find(f => /island_season\.html/.test(f.url()));
  const inner = seasonFrame ? await seasonFrame.evaluate(() => ({ rooms: window.HansenRoom ? HansenRoom._rooms() : null, pf: window.HansenRoom ? HansenRoom.prefetched() : null })) : null;
  ok(inner && inner.rooms.length === 0 && inner.pf.length === 0, `预热框里的星海岛不再预热任何东西（${JSON.stringify(inner)}）`);
  const pf = await page.evaluate(() => HansenRoom.prefetched());
  ok(pf.length === 3, `玩过的孩子：三个带参数页照常灌进缓存（${pf.join(',')}）`);
  const before = await page.evaluate(() => Object.keys(localStorage).filter(k => /^hsn_progress:星海/.test(k)));
  ok(before.length === 0, '藏在后台的星海岛不写「我的学习」快照');
  await page.evaluate(() => HansenRoom.open('season'));
  await page.waitForTimeout(9500);
  const after = await page.evaluate(() => Object.keys(localStorage).filter(k => /^hsn_progress:星海/.test(k)));
  ok(after.length === 1, '孩子点开星海岛之后，快照照常写进「我的学习」');
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ── P6 3G 网络 ── */
console.log('\n▶ P6 去过星海的孩子，但网络是 3G');
{
  const { ctx, page, errs, reqs } = await open('island_food.html', { ...OPENED, ...PLAYED }, { slowNet: true });
  await page.waitForTimeout(14000);
  const rooms = await page.evaluate(() => window.HansenRoom ? HansenRoom._rooms() : null);
  ok(Array.isArray(rooms) && rooms.length === 0, `网络策略不允许：不预热星海房间（${rooms && rooms.join(',')}）`);
  ok(!reqs.some(u => /^(?:boss_hall|season_showcase|spelling_bee)\.html/.test(u)), '网络策略不允许：不灌三个带参数页');
  await page.evaluate(() => HansenRoom.open('land'));
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => HansenRoom.isOpen('land')), '孩子自己点星海：照样能打开（按需加载）');
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

await browser.close(); srv.close();
console.log(fails ? `\n❌ 预载流量预算：${fails} 项失败` : '\n✅ 预载流量预算：新孩子首页/进岛不乱下、去过星海才预热且不套娃、预热页不写进度、3G 不预热全通过');
process.exit(fails ? 1 : 0);
