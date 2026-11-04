/* test_ach_days_v1165.mjs —— 成就「累计学习 N 天」数的是所有岛加起来学过几天
 *
 * 复查（v1165 第 2 轮 R2-ACH1）：「累计学习 3 天 / 30 天 / 100 天」以前取「单个岛的天数」里最大的那个 ——
 *   每天换一个岛玩的孩子，玩了 3 天还是「1 天」，永远拿不到。
 *
 * 合同（新孩子；把页面里的「今天」往后拨，模拟连着三天各玩一个不同的岛）：
 *   ① 第 1 天动物岛、第 2 天食物岛、第 3 天运动岛：「累计学习」进度 3/3，「起步三日」成就解锁
 *   ② 第 3 天再打开学校岛：还是 3 天（同一天不重复算）
 *   ③ 只在后台预热（?warm=1）打开的岛不算一天
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
  if (/\.mp3$/.test(p)) { res.writeHead(404); return res.end(); }
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
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => {
    try { if (!localStorage.getItem('__seed')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); localStorage.setItem('__seed', '1'); } } catch (e) {}
    /* 把「今天」往后拨 __dayShift 天（只改不带参数的 new Date() 和 Date.now()） */
    try {
      const shift = (Number(localStorage.getItem('__dayShift')) || 0) * 86400000;
      if (shift) { const D = Date; const FD = function (...a) { return a.length ? new D(...a) : new D(D.now() + shift); }; FD.prototype = D.prototype; FD.now = () => D.now() + shift; FD.UTC = D.UTC; FD.parse = D.parse; window.Date = FD; }
    } catch (e) {}
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const visit = async (file, day) => {
    await page.evaluate(d => localStorage.setItem('__dayShift', String(d)), day).catch(() => {});
    await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.readyState === 'complete' && typeof getAchProgress === 'function' && window.S && window.HansenAch, null, { timeout: 30000 });
    await sleep(1500);
    return page.evaluate(() => { try { closeAlert(); } catch (e) {} try { checkAch(); } catch (e) {} const p = getAchProgress('dayNS3'); return { today: today(), prog: p ? p.cur + '/' + p.need : 'none', got: HansenAch.isPending('dayNS3') || HansenAch.isClaimed('dayNS3'), mine: S.stats.daysPlayed, raw: localStorage.getItem('hansen_study_days_v1165') }; });
  };
  await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' }); await sleep(300);
  const d1 = await visit('island_animal.html', 0);
  const d2 = await visit('island_food.html', 1);
  const d3 = await visit('island_sports.html', 2);
  console.log(`    第 1 天 ${d1.today} 动物岛 ${d1.prog}；第 2 天 ${d2.today} 食物岛 ${d2.prog}；第 3 天 ${d3.today} 运动岛 ${d3.prog}（运动岛自己 ${d3.mine} 天；${d3.raw}）`);
  ok(d1.prog === '1/3' && d2.prog === '2/3' && d3.prog === '3/3', `① 三天各玩一个岛：累计学习 ${d1.prog} → ${d2.prog} → ${d3.prog}`);
  ok(d3.got, '① 「起步三日」成就解锁了');
  const d3b = await visit('island_school.html', 2);
  ok(d3b.prog === '3/3', `② 同一天再开学校岛：还是 ${d3b.prog}`);
  /* ③ 第 4 天只在后台预热打开一个岛 */
  await page.evaluate(() => localStorage.setItem('__dayShift', '3'));
  await page.goto(BASE + 'island_home.html?warm=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState === 'complete' && window.S, null, { timeout: 30000 });
  await sleep(1500);
  const raw4 = await page.evaluate(() => localStorage.getItem('hansen_study_days_v1165'));
  ok(raw4 && JSON.parse(raw4).n === 3, `③ 后台预热（?warm=1）打开的岛不算一天（${raw4}）`);
  ok(errs.length === 0, '页面无报错 ' + errs.slice(0, 3).join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165「累计学习 N 天」数所有岛加起来的天数');
