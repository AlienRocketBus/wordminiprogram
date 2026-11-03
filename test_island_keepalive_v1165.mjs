/* test_island_keepalive_v1165.mjs —— 从第 2 个岛回首页，藏着的岛不许被浏览器导回第 1 个岛；🗺️ 一点就回首页
 *
 * 事故（v1163 审计 INT-01 / PH-03 / INT-06 / MISSED#13）：
 *   动物 → 🗺️ → 食物 → 🗺️：藏起来的 iframe 自己重新加载「动物」（联合会话历史把同一个 iframe 导回上一个岛），
 *   保活失效、后台重跑脚本、再进食物又整页重载；岛里点过「重新加载」（启动自检）后，🗺️ 要点两下才回首页，
 *   地址后面的 _r 还越拖越长。
 *
 * 合同（首页外壳，真点）：
 *   1. 动物→🗺️→食物→🗺️→等 3 秒：iframe 还是 /island_food.html，这 3 秒里 iframe 没被导到别的岛；
 *      再点食物是「瞬开保活」：食物岛里事先设的 JS 标记还在
 *   2. 岛里点启动自检的「重新加载」两次：地址里只有一个 _r；之后 🗺️ 点一下就回首页（顶层历史也退干净）
 *   3. 前进键能回到岛；岛开着时整页刷新能恢复这个岛；单词大陆地图 → ①号岛 → 🗺️ 回地图 → 返回 回首页
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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
page.on('dialog', d => d.dismiss().catch(() => {}));
const navs = [];   // #islandFrame（首页的直接子框）每一次导航
page.on('framenavigated', f => { if (f.parentFrame() === page.mainFrame()) navs.push({ t: Date.now(), url: f.url().replace(BASE, '') }); });

const state = () => page.evaluate(() => {
  const w = document.getElementById('islandFrameWrap'), f = document.getElementById('islandFrame');
  let u = '', q = '', rs = '';
  try { u = f.contentWindow.location.pathname.split('/').pop(); q = f.contentWindow.location.search; rs = f.contentDocument.readyState; } catch (e) {}
  return { wrap: w ? w.style.display : '', op: f ? f.style.opacity : '', u, q, rs, top: location.pathname.split('/').pop() || 'index.html', hst: history.state };
});
async function waitState(pred, ms = 12000) { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await state(); if (pred(s)) return s; await sleep(60); } return null; }
const islandFrame = () => page.frames().find(f => f.parentFrame() === page.mainFrame());
async function tapAt(frame, sel) {
  const pt = await frame.evaluate(async s => {
    const el = document.querySelector(s); if (!el) return null;
    el.scrollIntoView({ block: 'center' }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const b = el.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const h = document.elementFromPoint(x, y);
    return { x, y, hit: !!h && (h === el || el.contains(h)) };
  }, sel).catch(() => null);
  if (!pt || !pt.hit) return false;
  await page.touchscreen.tap(pt.x, pt.y);   // 岛框铺满全屏，坐标和顶层一致
  return true;
}
async function openCard(file) {
  const tapped = await tapAt(page.mainFrame(), `a.island[href="${file}"]`);
  const s = await waitState(s => s.wrap === 'block' && s.op === '1' && s.u === file && s.rs === 'complete');
  await sleep(600);
  // 第一次进岛的欢迎弹窗：点掉（只点「开始冒险」金按钮）
  const fr = islandFrame();
  if (fr) await fr.evaluate(() => { const b = document.querySelector('#alertModal.show .game-btn.gold'); if (b) b.click(); }).catch(() => {});
  await sleep(300);
  return tapped && !!s;
}
async function tapMap() { const fr = islandFrame(); return fr ? tapAt(fr, '.world-map-btn') : false; }

try {
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.openIsland === 'function' && document.querySelector('a.island[href="island_animal.html"]'), null, { timeout: 30000 });
  await sleep(1500);

  console.log('\n▶ 1. 动物 → 🗺️ → 食物 → 🗺️：藏着的岛不能被导回动物');
  ok(await openCard('island_animal.html'), '真点「动物」进岛');
  ok(await tapMap(), '真点 🗺️');
  ok(!!await waitState(s => s.wrap === 'none', 4000), '回到首页');
  ok(await openCard('island_food.html'), '真点「食物」进岛');
  await islandFrame().evaluate(() => { window.__hsnKeep = 'food-1'; });
  ok(await tapMap(), '真点 🗺️');
  ok(!!await waitState(s => s.wrap === 'none', 4000), '回到首页');
  const t0 = Date.now(); await sleep(3000);
  const s1 = await state();
  const moved = navs.filter(n => n.t >= t0 - 200);
  ok(s1.u === 'island_food.html', `等 3 秒后藏着的 iframe 还是食物岛（实际 ${s1.u}）`);
  ok(moved.length === 0, `这 3 秒里藏着的 iframe 没被导走（${moved.map(n => n.url).join(', ') || '无'}）`);
  ok(await tapAt(page.mainFrame(), 'a.island[href="island_food.html"]'), '再真点「食物」');
  const s2 = await waitState(s => s.wrap === 'block' && s.op === '1', 3000);
  const marker = await islandFrame().evaluate(() => window.__hsnKeep).catch(() => null);
  ok(!!s2 && marker === 'food-1', `瞬开保活：食物岛里的标记还在（${marker}）`);

  console.log('\n▶ 2. 岛里点两次「重新加载」（启动自检）：_r 不累加，🗺️ 一下回首页');
  const dismissWelcome = () => islandFrame().evaluate(() => { const b = document.querySelector('#alertModal.show .game-btn.gold'); if (b) b.click(); }).catch(() => {});
  for (let k = 0; k < 2; k++) {
    const fr = islandFrame(), q0 = (await state()).q;
    await fr.evaluate(() => { window.HansenCoins = undefined; window.HansenBootCheck._checkForTest(); });
    await fr.waitForSelector('#hsnBootReload', { timeout: 5000 });
    ok(await tapAt(fr, '#hsnBootReload'), `第 ${k + 1} 次真点「重新加载」`);
    const s = await waitState(s => s.u === 'island_food.html' && /[?&]_r=/.test(s.q) && s.q !== q0 && s.rs === 'complete', 15000);
    ok(!!s, `岛页重新加载完（${s && s.q}）`);
    await sleep(800); await dismissWelcome(); await sleep(300);
  }
  const s3 = await state();
  ok((s3.q.match(/_r=/g) || []).length === 1, `地址里只有一个 _r（${s3.q}）`);
  ok(await tapMap(), '真点 🗺️ 一次');
  const s4 = await waitState(s => s.wrap === 'none', 3000);
  ok(!!s4, '点一次就回到首页');
  await sleep(1500);
  const s5 = await state();
  ok(s5.wrap === 'none' && s5.top === 'index.html' && !(s5.hst && s5.hst.hsnIsland), `顶层历史也退干净了（state=${JSON.stringify(s5.hst)}，页面 ${s5.top}）`);

  console.log('\n▶ 3. 前进 / 整页刷新 / 单词大陆地图');
  await page.evaluate(() => history.forward());
  ok(!!await waitState(s => s.wrap === 'block' && s.u === 'island_food.html', 5000), '浏览器「前进」回到食物岛');
  ok(await tapMap(), '真点 🗺️');
  ok(!!await waitState(s => s.wrap === 'none', 4000), '回到首页');
  ok(await openCard('island_animal.html'), '真点「动物」');
  await page.reload({ waitUntil: 'load' });
  ok(!!await waitState(s => s.wrap === 'block' && s.u === 'island_animal.html' && s.rs === 'complete', 20000), '岛开着时整页刷新：恢复到动物岛');
  await sleep(800); await dismissWelcome(); await sleep(300);
  ok(await tapMap(), '真点 🗺️');
  ok(!!await waitState(s => s.wrap === 'none', 4000), '回到首页');
  await page.evaluate(() => openIsland('land_map.html'));
  ok(!!await waitState(s => s.wrap === 'block' && s.u === 'land_map.html' && s.rs === 'complete', 15000), '打开单词大陆地图');
  await sleep(800);
  let fr = islandFrame();
  ok(await tapAt(fr, 'button.spot'), '真点 ① 号岛');
  await fr.waitForSelector('#overlay.show .pbtn.enter', { timeout: 5000 });
  ok(await tapAt(fr, '#overlay.show .pbtn.enter'), '真点「进入学习」');
  ok(!!await waitState(s => s.wrap === 'block' && s.u === 'island_land1.html' && s.rs === 'complete' && s.op === '1', 15000), '进到 ① 号岛');
  await sleep(800);
  await islandFrame().evaluate(() => { const b = document.querySelector('#alertModal.show .game-btn.gold'); if (b) b.click(); }).catch(() => {});
  await sleep(300);
  ok(await tapMap(), '真点 🗺️');
  ok(!!await waitState(s => s.wrap === 'block' && s.u === 'land_map.html' && s.rs === 'complete', 15000), '回到单词大陆地图');
  await sleep(800);
  fr = islandFrame();
  ok(await tapAt(fr, '#backBtn'), '真点地图「← 返回」');
  ok(!!await waitState(s => s.wrap === 'none', 4000), '回到首页');
  await sleep(1200);
  const s6 = await state();
  ok(s6.top === 'index.html' && !(s6.hst && s6.hst.hsnIsland), `顶层还在首页、历史干净（${JSON.stringify(s6.hst)}）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs.slice(0, 2).join(' | ') : ''));
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 换岛不再被导回上一个岛，🗺️ 一点就回首页');
process.exit(fails ? 1 : 0);
