/* test_trial_clear_v1165.mjs —— 72 小时体验期跳着打赢最后一关，不能把岛标成「已通关」
 *
 * v1163：bossVictory 只看「打的是不是最后一关」就写 hsn_landmap_cleared_N='1'。体验期能跳打任何一关，
 *        新孩子直接点第 5 关、打赢 → 岛被永久标成「已通关」（地图、女帝终战门、赛季纪事都认它），进度却还是 0。
 *
 * 合同（island_land3，体验期内）：
 *   ① 进度 0 时跳打第 5 关并打赢 → 不记「已通关」、进度不变
 *   ② 进度 4（前 4 关都打过）再打第 5 关并打赢 → 记「已通关」、进度变 5
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
page.on('dialog', d => d.dismiss().catch(() => {}));

// 从选关网格真点第 k 关，等开打，再把 Boss 打到 0 血
async function fightAndWin(k) {
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} showScreen('home'); showScreen('boss'); });
  await page.waitForTimeout(600);
  const card = page.locator(`#bossContent [onclick="window.__hsnZoneFight(${k})"]`).first();
  const n = await card.count();
  if (!n) return { started: false };
  await card.tap();
  await page.waitForFunction(k => window._s1Idx === k && bossActive === true, k, { timeout: 15000 }).catch(() => {});
  const st = await page.evaluate(() => { const st = { started: bossActive === true, idx: window._s1Idx }; bossHP = 0; bossVictory(); return st; });
  // 打赢后会弹「🔓新 Boss 解锁」之类的领奖卡：真点「收下!」把它关掉，免得挡住下一次选关
  for (let k = 0; k < 6; k++) {
    await page.waitForTimeout(700);
    const b = page.locator('button:visible, div[role="button"]:visible', { hasText: /^(收下!?|好的|知道了|继续)$/ }).first();
    if (await b.count()) await b.tap().catch(() => {}); else break;
  }
  return st;
}
const state = () => page.evaluate(() => ({ flag: localStorage.getItem('hsn_landmap_cleared_3'), prog: localStorage.getItem('land3_prog') }));

try {
  await page.goto(BASE + 'island_land3.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof startBoss === 'function' && typeof window.__hsnZoneFight === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const fp = await page.evaluate(() => ({ fp: !!(window.HansenFreepass && HansenFreepass.active()), n: BOSSES.length }));
  ok(fp.fp && fp.n === 5, '体验期开着、本岛 5 关 ' + JSON.stringify(fp));

  console.log('\n▶ ① 进度 0：跳打第 5 关并打赢');
  const s0 = await state();
  const r1 = await fightAndWin(4);
  await page.waitForTimeout(500);
  const s1 = await state();
  ok(r1.started && r1.idx === 4, '① 体验期能直接挑战第 5 关 ' + JSON.stringify(r1));
  ok(s1.flag !== '1', '① 跳打赢了最后一关：没有记「已通关」 ' + JSON.stringify(s1));
  ok((s1.prog || '0') === (s0.prog || '0'), `① 进度没变（${s0.prog || '0'} → ${s1.prog || '0'}）`);

  console.log('\n▶ ② 进度 4：按顺序打第 5 关并打赢');
  await page.evaluate(() => { localStorage.setItem('land3_prog', '4'); localStorage.removeItem('hsn_landmap_cleared_3'); });
  const r2 = await fightAndWin(4);
  await page.waitForTimeout(500);
  const s2 = await state();
  ok(r2.started && r2.idx === 4, '② 开打第 5 关 ' + JSON.stringify(r2));
  ok(s2.flag === '1' && s2.prog === '5', '② 按顺序打赢最后一关：记「已通关」、进度 5 ' + JSON.stringify(s2));
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
} finally { await ctx.close(); await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 体验期跳打不算通关；按顺序打完才记「已通关」');
