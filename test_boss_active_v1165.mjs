/* test_boss_active_v1165.mjs —— window.bossActive 和页面里的 bossActive 是同一个东西
 *
 * v1163：bossActive 是 let 变量，不在 window 上。几段保护代码判断 window.bossActive（永远 undefined）：
 *   · showScreen 的「战斗中隐藏底栏」(hsn-boss-battle) 从这条路永远不加；
 *   · 选关墙模块「战斗中再切到 Boss 屏不要重画选关」永远不成立 → 战斗中一调 showScreen('boss') 就把战场换成选关墙；
 *   · 「战斗中等特效引擎」那条也从来不走。
 * 合同（island_animal、island_land3）：
 *   ① 开打后 window.bossActive === true
 *   ② 战斗中再 showScreen('boss')：战场 .boss-arena 还在、body 带 hsn-boss-battle、没被换成选关墙
 *   ③ 打赢 / 打输后 window.bossActive === false，回到 Boss 屏是选关墙
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
async function newCtx(vp = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true });
  await ctx.addInitScript(() => { try { if (window.top === window && !sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  return ctx;
}
async function open(ctx, file, ready = "typeof showScreen === 'function'") {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(new Function("return document.readyState !== 'loading' && " + ready), null, { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} });
  return { page, errs };
}

async function dismissRewards(page) {
  for (let k = 0; k < 6; k++) {
    await page.waitForTimeout(600);
    const b = page.locator('button:visible, div[role="button"]:visible', { hasText: /^(收下!?|好的|知道了|继续)$/ }).first();
    if (await b.count()) await b.tap().catch(() => {}); else break;
  }
}
try {
  for (const [file, start] of [['island_animal.html', () => startBoss()], ['island_land3.html', () => window.__hsnZoneFight(0)]]) {
    console.log('\n▶ ' + file);
    const ctx = await newCtx();
    const { page, errs } = await open(ctx, file, "typeof startBoss === 'function' && typeof window.hansenRenderBossPicker === 'function'");
    await page.evaluate(() => showScreen('boss'));
    await page.waitForTimeout(500);
    await page.evaluate(start);
    await page.waitForFunction(() => bossActive === true && document.querySelector('#bossContent .boss-arena'), null, { timeout: 15000 });
    const a = await page.evaluate(() => ({ win: window.bossActive, let: bossActive }));
    ok(a.win === true && a.let === true, '① 开打后 window.bossActive === true ' + JSON.stringify(a));
    await page.evaluate(() => showScreen('boss'));
    await page.waitForTimeout(1500);    // 特效引擎可能还在下载：等它好了才真正切屏
    const b = await page.evaluate(() => ({ arena: !!document.querySelector('#bossContent .boss-arena'), battle: document.body.classList.contains('hsn-boss-battle'), active: (document.querySelector('.screen.active') || {}).id, still: bossActive }));
    ok(b.arena && b.battle && b.active === 'bossScreen' && b.still === true, '② 战斗中再切到 Boss 屏：战场还在、底栏藏着 ' + JSON.stringify(b));
    // ③ 打赢
    await page.evaluate(() => { bossHP = 0; bossVictory(); });
    await dismissRewards(page);
    await page.evaluate(() => { showScreen('home'); showScreen('boss'); });
    await page.waitForTimeout(600);
    const c = await page.evaluate(() => ({ win: window.bossActive, arena: !!document.querySelector('#bossContent .boss-arena'), picker: document.querySelectorAll('#bossContent [onclick]').length, battle: document.body.classList.contains('hsn-boss-battle') }));
    ok(c.win === false && !c.arena && c.picker > 0 && !c.battle, '③ 打赢以后：window.bossActive=false，Boss 屏是选关墙 ' + JSON.stringify(c));
    // ③ 打输
    await page.evaluate(start);
    await page.waitForFunction(() => bossActive === true && document.querySelector('#bossContent .boss-arena'), null, { timeout: 15000 });
    await page.evaluate(() => { heroHP = 0; bossDefeat(); });
    await dismissRewards(page);
    await page.evaluate(() => { showScreen('home'); showScreen('boss'); });
    await page.waitForTimeout(600);
    const d = await page.evaluate(() => ({ win: window.bossActive, arena: !!document.querySelector('#bossContent .boss-arena'), picker: document.querySelectorAll('#bossContent [onclick]').length }));
    ok(d.win === false && !d.arena && d.picker > 0, '③ 打输以后：window.bossActive=false，Boss 屏是选关墙 ' + JSON.stringify(d));
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 window.bossActive 接上了：战斗中切屏保留战场，打完回选关墙');
