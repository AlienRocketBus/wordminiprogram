/* test_island_hidden_quiet_v1165.mjs —— 回到首页后，藏起来的岛不许再出声、不许接着倒计时
 *
 * 事故（v1163 审计 CB-03 / INT-07）：首页外壳里的岛点 🗺️ 只是被藏起来（保活），游戏却还在跑：
 *   打地鼠每 5 秒在首页念一个词，极速 60 秒继续倒数（注释里写的「隐藏时不会响」并不成立）。
 *
 * 合同（首页外壳，真点）：
 *   1. 打地鼠玩着 → 🗺️ → 在首页停 12 秒：岛里一次 Audio.play / speechSynthesis.speak 都没有
 *   2. 再进这个岛：看到的是本岛主页（游戏已经收好）
 *   3. 极速 60 秒玩着 → 🗺️ → 停 5 秒：倒计时数字不动（spTime 不变）
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
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--autoplay-policy=no-user-gesture-required'] });

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
await ctx.addInitScript(() => {
  try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {}
  /* 每个页面框都记下谁在出声 */
  window.__sound = [];
  try {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { try { window.__sound.push({ t: Date.now(), k: 'play', src: String(this.currentSrc || this.src || '').split('/').pop() }); } catch (e) {} return play.apply(this, arguments); };
  } catch (e) {}
  try {
    if (window.speechSynthesis) {
      const sp = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = function (u) { try { window.__sound.push({ t: Date.now(), k: 'speak', src: u && u.text }); } catch (e) {} return sp(u); };
    }
  } catch (e) {}
});
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
page.on('dialog', d => d.dismiss().catch(() => {}));
const islandFrame = () => page.frames().find(f => f.parentFrame() === page.mainFrame());
const shell = () => page.evaluate(() => {
  const w = document.getElementById('islandFrameWrap'), f = document.getElementById('islandFrame');
  let u = '', rs = ''; try { u = f.contentWindow.location.pathname.split('/').pop(); rs = f.contentDocument.readyState; } catch (e) {}
  return { wrap: w.style.display, op: f.style.opacity, u, rs };
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

try {
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.openIsland === 'function' && document.querySelector('a.island[href="island_animal.html"]'), null, { timeout: 30000 });
  await sleep(1200);
  ok(await tapAt(page.mainFrame(), 'a.island[href="island_animal.html"]'), '真点「动物」');
  ok(!!await waitShell(s => s.wrap === 'block' && s.op === '1' && s.u === 'island_animal.html' && s.rs === 'complete'), '进到动物岛');
  await sleep(800);
  let fr = islandFrame();
  await fr.evaluate(() => { const b = document.querySelector('#alertModal.show .game-btn.gold'); if (b) b.click(); }).catch(() => {});
  await sleep(400);

  console.log('\n▶ 1. 打地鼠玩着 → 🗺️ → 首页停 12 秒');
  ok(await tapAt(fr, '.mode-card[onclick="startMoles()"]'), '真点「打地鼠」');
  await fr.waitForSelector('#molesContent [onclick^="startMolesLevel"]', { timeout: 8000 });
  ok(await tapAt(fr, '#molesContent [onclick^="startMolesLevel"]'), '真点第一档');
  await fr.waitForFunction(() => typeof molesActive !== 'undefined' && molesActive, null, { timeout: 10000 }).catch(() => {});
  await sleep(6500);   // 至少出过一波（会念词）
  const during = await fr.evaluate(() => window.__sound.length);
  ok(during > 0, `玩的时候确实会出声（${during} 次，证明钩子有效）`);
  ok(await tapAt(fr, '.world-map-btn'), '真点 🗺️');
  ok(!!await waitShell(s => s.wrap === 'none', 4000), '回到首页');
  const tHide = Date.now();
  await sleep(12000);
  const after = await fr.evaluate(t => window.__sound.filter(x => x.t >= t), tHide);
  ok(after.length === 0, `藏起来 12 秒岛里没出声（${after.length} 次：${after.slice(0, 3).map(x => x.k + ':' + x.src).join(', ')}）`);

  console.log('\n▶ 2. 再进动物岛：是本岛主页');
  ok(await tapAt(page.mainFrame(), 'a.island[href="island_animal.html"]'), '再真点「动物」');
  ok(!!await waitShell(s => s.wrap === 'block' && s.op === '1' && s.u === 'island_animal.html', 4000), '瞬开');
  await sleep(500);
  fr = islandFrame();
  const scr = await fr.evaluate(() => { const a = document.querySelector('.screen.active'); return a ? a.id : ''; });
  ok(scr === 'homeScreen', `看到的是本岛主页（${scr}）`);

  console.log('\n▶ 3. 极速 60 秒玩着 → 🗺️ → 停 5 秒');
  ok(await tapAt(fr, '.mode-card[onclick="startSpeed()"]'), '真点「极速 60 秒」');
  await fr.waitForSelector('#speedContent [onclick^="startSpeedLevel"]', { timeout: 8000 });
  ok(await tapAt(fr, '#speedContent [onclick^="startSpeedLevel"]'), '真点第一档');
  await fr.waitForFunction(() => typeof spActive !== 'undefined' && spActive, null, { timeout: 10000 }).catch(() => {});
  await sleep(2500);
  ok(await tapAt(fr, '.world-map-btn'), '真点 🗺️');
  ok(!!await waitShell(s => s.wrap === 'none', 4000), '回到首页');
  await sleep(300);
  const t1 = await fr.evaluate(() => spTime);
  await sleep(5000);
  const t2 = await fr.evaluate(() => spTime);
  ok(t1 === t2, `藏起来后倒计时不动（${t1} → ${t2}）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs.slice(0, 2).join(' | ') : ''));
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 藏起来的岛不再出声、不再倒计时');
process.exit(fails ? 1 : 0);
