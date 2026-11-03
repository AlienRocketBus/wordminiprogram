/* test_land_unlock_banner_v1165.mjs —— 单词大陆岛的「🔓新 Boss 解锁! Lv N 已开放」只在真开了下一关时弹，关号写真的
 *
 * v1163：hansen_boss_progress.js 按常规岛的 20 关数字记胜场，单词大陆岛（5 关、看 landN_prog）也照用：
 *        这个岛第一次打赢任何一关都弹「Lv 2 已开放」。72 小时体验期新孩子跳着打赢第 5 关 → 弹「Lv 2 已开放」，
 *        可大陆的进度一步没动（体验期一过第 2 关还锁着）；进度从别处恢复过来（比如已打到第 3 关）再赢 → 也写「Lv 2」。
 *
 * 合同（island_land3，体验期内，每段都是这个岛的第一场胜利）：
 *   ① 进度 0 跳打第 5 关赢了 → 不弹解锁提示（进度没动）
 *   ② 进度 0 按顺序打第 1 关赢了 → 弹「Lv 2 已开放」（和以前一样）
 *   ③ 进度 2 按顺序打第 3 关赢了 → 弹「Lv 4 已开放」（写大陆真的关号）
 *   ④ 常规岛（island_animal）第一关赢了 → 照旧弹「Lv 2 已开放」
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

// 一个全新的孩子（新浏览器环境），可选先放好大陆进度；真点选关网格第 k 关、开打、把 Boss 打到 0 血，读解锁提示
async function firstWin(file, k, prog) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.addInitScript((prog) => {
    try {
      if (!sessionStorage.getItem('__s')) {
        localStorage.clear(); localStorage.setItem('hansen_onboarded', '1');
        if (prog != null) localStorage.setItem('land3_prog', String(prog));
        sessionStorage.setItem('__s', '1');
      }
    } catch (e) {}
  }, prog);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  try {
    await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.readyState !== 'loading' && typeof startBoss === 'function' && !!window.__hbpVictoryHooked, null, { timeout: 20000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { try { closeAlert(); } catch (e) {} showScreen('home'); showScreen('boss'); });
    await page.waitForTimeout(600);
    const land = /island_land/.test(file);
    const sel = land ? `#bossContent [onclick="window.__hsnZoneFight(${k})"]` : `#bossContent [onclick*="hansenStartRebattle(${k + 1})"]`;
    const card = page.locator(sel).first();
    if (!(await card.count())) return { started: false, errs };
    await card.tap();
    await page.waitForFunction(() => bossActive === true, null, { timeout: 15000 }).catch(() => {});
    const st = await page.evaluate(() => { const st = { started: bossActive === true, idx: window._s1Idx }; bossHP = 0; bossVictory(); return st; });
    await page.waitForTimeout(900);
    const banner = await page.evaluate(() => {
      const el = [...document.querySelectorAll('body > div')].find(d => /新 Boss 解锁/.test(d.textContent || ''));
      return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
    });
    const after = await page.evaluate(() => localStorage.getItem('land3_prog'));
    return { ...st, banner, prog: after, errs };
  } finally { await ctx.close(); }
}

try {
  console.log('\n▶ ① 进度 0：体验期跳打第 5 关赢了');
  {
    const r = await firstWin('island_land3.html', 4, null);
    ok(r.started && r.idx === 4, '① 开打第 5 关 ' + JSON.stringify({ started: r.started, idx: r.idx }));
    ok(!r.banner, `① 进度没动（land3_prog=${r.prog || '0'}），不弹解锁提示（弹的是：「${r.banner}」）`);
    ok(r.errs.length === 0, '页面无报错 ' + r.errs.join(' | '));
  }
  console.log('\n▶ ② 进度 0：按顺序打第 1 关赢了');
  {
    const r = await firstWin('island_land3.html', 0, null);
    ok(r.started && r.idx === 0 && r.prog === '1', '② 打赢第 1 关、进度变 1 ' + JSON.stringify({ idx: r.idx, prog: r.prog }));
    ok(/Lv 2 已开放/.test(r.banner), `② 弹「Lv 2 已开放」（弹的是：「${r.banner}」）`);
    ok(r.errs.length === 0, '页面无报错 ' + r.errs.join(' | '));
  }
  console.log('\n▶ ③ 进度 2：按顺序打第 3 关赢了');
  {
    const r = await firstWin('island_land3.html', 2, 2);
    ok(r.started && r.idx === 2 && r.prog === '3', '③ 打赢第 3 关、进度变 3 ' + JSON.stringify({ idx: r.idx, prog: r.prog }));
    ok(/Lv 4 已开放/.test(r.banner), `③ 写大陆真的关号「Lv 4 已开放」（弹的是：「${r.banner}」）`);
    ok(r.errs.length === 0, '页面无报错 ' + r.errs.join(' | '));
  }
  console.log('\n▶ ④ 常规岛第一关赢了');
  {
    const r = await firstWin('island_animal.html', 0, null);
    ok(r.started, '④ 动物岛开打第 1 关');
    ok(/Lv 2 已开放/.test(r.banner), `④ 照旧弹「Lv 2 已开放」（弹的是：「${r.banner}」）`);
    ok(r.errs.length === 0, '页面无报错 ' + r.errs.join(' | '));
  }
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 单词大陆的解锁提示只在真开了下一关时弹、写真的关号；常规岛照旧');
