/* test_island_back_v1165.mjs —— 手机「返回」只退一步（外壳部分）
 *
 * 事故（v1163 审计 INT-04 / INT-09）：首页外壳里，岛里不管在哪个玩法、开着哪个浮层，按一下手机返回都直接退出整个岛；
 *   单词大陆的岛返回还跳过大陆地图直接回首页。
 *
 * 合同（首页外壳；history.back() = 手机返回键 / 返回手势）：
 *   1. 探索单词 / 听音辨义 / 打字大师 里按返回：岛还开着，回到本岛主页；在本岛主页再按返回才回首页
 *   2. 我的学习 / 错题总览 / 复习中心 开着时按返回：只关这个浮层，岛还开着
 *   3. 单词大陆 ①号岛按返回 → 回大陆地图；再按返回 → 回首页
 *   4. 🗺️ 照旧一下回首页，顶层历史退干净
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
const islandFrame = () => page.frames().find(f => f.parentFrame() === page.mainFrame());
const shell = () => page.evaluate(() => {
  const w = document.getElementById('islandFrameWrap'), f = document.getElementById('islandFrame');
  let u = '', rs = '', scr = ''; try { u = f.contentWindow.location.pathname.split('/').pop(); rs = f.contentDocument.readyState; const a = f.contentDocument.querySelector('.screen.active'); scr = a ? a.id : ''; } catch (e) {}
  return { wrap: w.style.display, op: f.style.opacity, u, rs, scr, hst: history.state };
});
async function waitShell(pred, ms = 15000) { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await shell(); if (pred(s)) return s; await sleep(60); } return null; }
async function tapAt(frame, sel) {
  const pt = await frame.evaluate(async s => {
    const el = document.querySelector(s); if (!el) return null;
    el.scrollIntoView({ block: 'center' }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const b = el.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const h = document.elementFromPoint(x, y);
    return { x, y, hit: !!h && (h === el || el.contains(h)) };
  }, sel).catch(() => null);
  if (!pt || !pt.hit) return false;
  await page.touchscreen.tap(pt.x, pt.y);
  return true;
}
const back = async () => { await page.evaluate(() => history.back()); await sleep(700); };
const dismissWelcome = async () => { const fr = islandFrame(); if (fr) await fr.evaluate(() => { const b = document.querySelector('#alertModal.show .game-btn.gold'); if (b) b.click(); }).catch(() => {}); await sleep(300); };
async function enter(file) {
  ok(await tapAt(page.mainFrame(), `a.island[href="${file}"]`), `真点 ${file}`);
  ok(!!await waitShell(s => s.wrap === 'block' && s.op === '1' && s.u === file && s.rs === 'complete'), `进到 ${file}`);
  await sleep(600); await dismissWelcome();
}

try {
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.openIsland === 'function' && document.querySelector('a.island[href="island_animal.html"]'), null, { timeout: 30000 });
  await sleep(1200);
  await enter('island_animal.html');

  console.log('\n▶ 1. 玩法里按返回：回本岛主页，岛不关');
  for (const [name, sel] of [['探索单词', `.mode-card[onclick="showScreen('explore')"]`], ['听音辨义', '.mode-card[onclick="startListen()"]'], ['打字大师', '.mode-card[onclick="showTypingMenu()"]']]) {
    ok(await tapAt(islandFrame(), sel), `真点「${name}」`);
    const inGame = await waitShell(s => s.scr && s.scr !== 'homeScreen', 6000);
    ok(!!inGame, `进了${name}（${inGame && inGame.scr}）`);
    await back();
    const s = await shell();
    ok(s.wrap === 'block' && s.u === 'island_animal.html' && s.scr === 'homeScreen', `${name} 里按返回：岛还开着、回到本岛主页（wrap=${s.wrap} 屏=${s.scr}）`);
  }

  console.log('\n▶ 2. 浮层开着按返回：只关浮层');
  for (const [name, open, id] of [['我的学习', 'HansenMyLearning._open()', 'hsn-ml'], ['错题总览', 'HansenWrongOverview.open()', 'hwo_overlay'], ['复习中心', 'HansenReview._open()', 'hr_center']]) {
    await islandFrame().evaluate(js => { (0, eval)(js); }, open);
    await sleep(500);
    const opened = await islandFrame().evaluate(id => !!document.getElementById(id), id);
    ok(opened, `${name} 打开了`);
    await back();
    const gone = await islandFrame().evaluate(id => !document.getElementById(id) || getComputedStyle(document.getElementById(id)).display === 'none', id);
    const s = await shell();
    ok(gone && s.wrap === 'block' && s.u === 'island_animal.html', `${name} 开着按返回：只关了它，岛还开着（浮层已关=${gone}，wrap=${s.wrap}）`);
  }

  // 神秘殿堂（星海面板类）、装备商店（用 class 开关、开两次）、没有 id 的全屏弹层（只有一个 ✕）
  for (const [name, open, isOpen] of [
    ['神秘殿堂', '__hsnOpenHall()', '!!document.getElementById("__hs_hall_panel")'],
    ['装备商店', 'HansenGear.open()', '!!document.querySelector("#hsnGearMask.show")'],
    ['装备商店（第二次）', 'HansenGear.open()', '!!document.querySelector("#hsnGearMask.show")'],
    ['没有 id 的弹层', '(function(){var m=document.createElement("div");m.className="t-probe";m.style.cssText="position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.7)";m.innerHTML="<div style=\\"margin:80px auto;width:200px;background:#fff\\"><span class=\\"x\\">✕</span></div>";m.querySelector(".x").onclick=function(){m.remove();};document.body.appendChild(m);})()', '!!document.querySelector(".t-probe")'],
  ]) {
    await islandFrame().evaluate(js => { (0, eval)(js); }, open);
    await sleep(500);
    ok(await islandFrame().evaluate(js => (0, eval)(js), isOpen), `${name} 打开了`);
    await back();
    const still = await islandFrame().evaluate(js => (0, eval)(js), isOpen);
    const s = await shell();
    ok(!still && s.wrap === 'block' && s.u === 'island_animal.html' && s.scr === 'homeScreen', `${name} 开着按返回：只关了它（还开着=${still}，wrap=${s.wrap}，屏=${s.scr}）`);
  }

  console.log('\n▶ 1b. 本岛主页再按返回：回首页');
  await back();
  const sh = await waitShell(s => s.wrap === 'none', 3000);
  ok(!!sh, '本岛主页按返回回到首页');

  console.log('\n▶ 3. 单词大陆 ①号岛：返回 → 大陆地图 → 返回 → 首页');
  await page.evaluate(() => openIsland('land_map.html'));
  ok(!!await waitShell(s => s.wrap === 'block' && s.u === 'land_map.html' && s.rs === 'complete', 15000), '打开单词大陆地图');
  await sleep(700);
  ok(await tapAt(islandFrame(), 'button.spot'), '真点 ① 号岛');
  await islandFrame().waitForSelector('#overlay.show .pbtn.enter', { timeout: 5000 });
  ok(await tapAt(islandFrame(), '#overlay.show .pbtn.enter'), '真点「进入学习」');
  ok(!!await waitShell(s => s.wrap === 'block' && s.u === 'island_land1.html' && s.rs === 'complete' && s.op === '1', 15000), '进到 ① 号岛');
  await sleep(600); await dismissWelcome();
  await back();
  ok(!!await waitShell(s => s.wrap === 'block' && s.u === 'land_map.html' && s.rs === 'complete', 15000), '① 号岛按返回：回到大陆地图（不是首页）');
  await sleep(600);
  await back();
  ok(!!await waitShell(s => s.wrap === 'none', 3000), '大陆地图按返回：回到首页');

  console.log('\n▶ 4. 🗺️ 照旧一下回首页');
  await enter('island_food.html');
  ok(await tapAt(islandFrame(), '.world-map-btn'), '真点 🗺️');
  ok(!!await waitShell(s => s.wrap === 'none', 3000), '一下回首页');
  await sleep(1200);
  const s4 = await shell();
  ok(!(s4.hst && s4.hst.hsnIsland), `顶层历史退干净（${JSON.stringify(s4.hst)}）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs.slice(0, 2).join(' | ') : ''));
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 手机返回只退一步');
process.exit(fails ? 1 : 0);
