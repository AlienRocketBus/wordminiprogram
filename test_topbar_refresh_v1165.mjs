/* test_topbar_refresh_v1165.mjs —— 顶栏跟着别的页面变；经验不被别的页面盖掉；满级显示「已满级 MAX」
 *
 * v1163：
 *   · 岛页只监听「主题」的变化。别的页面（另一个岛、首页）加了金币、经验、做了任务，这个岛的顶栏还是旧数字。
 *   · addXP 用本页开岛时读到的 S.charXP 去写全局经验：食物岛加了 20 经验，再在动物岛加 5，全局经验变成 5（丢了 20）。
 *   · 满级（Lv.30）以后顶栏显示「100/0 XP」。
 *
 * 合同：
 *   ① 同一来源的另一个页面写金币 / 人物经验 / 每日任务 → 本页 #coinCount、经验行、#questDot 500ms 内跟着变；不会两页来回刷个不停
 *   ② 两个页面：食物岛 addXP(5)×4，动物岛 addXP(5) → 全局经验 25，两边顶栏一致
 *   ③ addXP(52300) 到满级 → 顶栏「已满级 MAX」，页面上没有「/0 XP」
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

async function newCtx() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  // 只在第一个页面清一次存档（两个页面共用同一份 localStorage）
  await ctx.addInitScript(() => { try { if (window.top === window && !localStorage.getItem('__t_init')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__t_init', '1'); } } catch (e) {} });
  return ctx;
}
async function open(ctx, file) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof updateTopBar === 'function' && window.HansenCoins && window.HansenQuestGlobal, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} });
  return { page, errs };
}
const bar = p => p.evaluate(() => ({ coins: (document.getElementById('coinCount') || {}).textContent, xp: ((document.querySelector('.xp-text') || {}).textContent || '').replace(/\s+/g, ' ').trim(), lvl: (document.getElementById('lvl') || {}).textContent, dot: getComputedStyle(document.getElementById('questDot')).display, charXP: S.charXP }));
// 在 500ms 内轮询：条件成立就返回 true
async function within(page, fn, arg, ms = 500) { const t0 = Date.now(); while (Date.now() - t0 <= ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(40); } return false; }

try {
  // ───────────── ① 另一个页面改了，本页顶栏跟着变 ─────────────
  console.log('\n▶ ① 另一个页面（island_food）改金币 / 经验 / 任务，island_animal 的顶栏跟着变');
  {
    const ctx = await newCtx();
    const A = await open(ctx, 'island_animal.html');
    const B = await open(ctx, 'island_food.html');
    await A.page.evaluate(() => { window.__syncRuns = 0; const U = window.updateTopBar; window.updateTopBar = function () { window.__syncRuns++; return U.apply(this, arguments); }; });
    const a0 = await bar(A.page);
    // 金币
    const coinsNow = await B.page.evaluate(() => { HansenCoins.add(50); return String(HansenCoins.get()); });
    ok(await within(A.page, c => document.getElementById('coinCount').textContent === c, coinsNow), `① 金币：另一页 +50 → 本页 #coinCount 500ms 内变成 ${coinsNow}（原来 ${a0.coins}）`);
    // 经验
    const xpNow = await B.page.evaluate(() => { addXP(30); return S.charXP; });
    ok(await within(A.page, x => S.charXP === x && /^\s*30\s*\//.test(document.querySelector('.xp-text').textContent), xpNow), `① 经验：另一页 +30 → 本页经验行 500ms 内变成「30/…」、S.charXP=${xpNow}`);
    // 任务：另一页把一个任务做满 → 本页红点
    const qt = await B.page.evaluate(() => { const q = S.quests.list.find(x => !['reviewClear', 'speed', 'bubble'].includes(x.type)) || S.quests.list[0]; if (['reviewClear', 'speed', 'bubble'].includes(q.type)) setQuest(q.type, q.goal); else progressQuest(q.type, q.goal); return q.type; });
    ok(await within(A.page, () => getComputedStyle(document.getElementById('questDot')).display !== 'none'), `① 任务：另一页做满「${qt}」任务 → 本页 #questDot 500ms 内亮起`);
    // 不会两页来回刷个不停
    await A.page.evaluate(() => { window.__syncRuns = 0; });
    await A.page.waitForTimeout(3000);
    const runs = await A.page.evaluate(() => window.__syncRuns);
    ok(runs <= 2, `① 改完以后安静下来：3 秒里本页只刷新了 ${runs} 次（不会两页互相触发）`);
    ok(A.errs.length === 0 && B.errs.length === 0, '① 页面无报错 ' + A.errs.concat(B.errs).join(' | '));
    await ctx.close();
  }

  // ───────────── ② 经验不被别的页面盖掉 ─────────────
  console.log('\n▶ ② 两个页面先后加经验');
  {
    const ctx = await newCtx();
    const A = await open(ctx, 'island_animal.html');
    const F = await open(ctx, 'island_food.html');
    const w0 = await F.page.evaluate(() => +localStorage.getItem('hansen_wallet_charxp') || 0);
    await F.page.evaluate(() => { for (let i = 0; i < 4; i++) addXP(5); });
    await A.page.evaluate(() => addXP(5));   // 紧接着在动物岛加（不等同步）
    await A.page.waitForTimeout(600);
    const w = await A.page.evaluate(() => +localStorage.getItem('hansen_wallet_charxp') || 0);
    const a = await bar(A.page), f = await bar(F.page);
    ok(w - w0 === 25, `② 食物岛 +5×4、动物岛 +5 → 全局经验 +25（实际 +${w - w0}）`);
    ok(a.charXP === w && f.charXP === w && a.xp === f.xp && a.lvl === f.lvl, `② 两边顶栏一致（动物「${a.xp}」Lv${a.lvl} / 食物「${f.xp}」Lv${f.lvl}）`);
    ok(A.errs.length === 0 && F.errs.length === 0, '② 页面无报错 ' + A.errs.concat(F.errs).join(' | '));
    await ctx.close();
  }

  // ───────────── ③ 满级 ─────────────
  console.log('\n▶ ③ 满级显示');
  for (const file of ['island_animal.html', 'island_land1.html']) {
    const ctx = await newCtx();
    const A = await open(ctx, file);
    const r = await A.page.evaluate(() => { addXP(52300); updateTopBar(); return { lvl: S.level, bar: document.querySelector('.xp-text').textContent.replace(/\s+/g, ' ').trim(), page: /\/\s*0\s*XP/.test(document.body.innerText) }; });
    ok(r.lvl === 30 && /已满级/.test(r.bar) && /MAX/.test(r.bar) && !/\/\s*0/.test(r.bar) && !r.page, `③ ${file}：Lv.${r.lvl} 顶栏「${r.bar}」，页面上没有「/0 XP」`);
    ok(A.errs.length === 0, '③ 页面无报错 ' + A.errs.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 顶栏跟着别的页面变、经验不丢、满级显示「已满级 MAX」');
