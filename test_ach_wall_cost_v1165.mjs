/* test_ach_wall_cost_v1165.mjs —— 进度多的孩子点开成就墙的分类不卡（一次重画只算一遍进度）
 *
 * 复查（v1165 第 2 轮 R2-ACH2）：成就墙每画一张没解锁的阶梯成就卡（一百多张），进度条都把 achFacts 整份重算一遍：
 *   翻遍 localStorage 每个键、各岛存档、读账本 —— 进度多的孩子在 4 倍慢 CPU 上每点开一栏卡 0.2~0.46 秒（越开越多越卡）。
 *
 * 合同（和 test_answer_cost_v1165 同一个「重」孩子：27 个岛存档、900 已学 / 200 错词 / 300 复习计划；食物岛；真点分类栏）：
 *   ① 不看时间、只数干了多少活：点开一栏，localStorage 被整份翻了几遍（localStorage.key(0) 被调用的次数）≤ 6 遍
 *      （现在点一栏只重画这一栏、进度只算一遍：实测 1~4 遍（含别的模块定时翻的）；以前整面墙重画、每张卡翻 2 遍，一栏一两百遍）
 *   ② 4 倍慢 CPU：每点开一栏，主线程最长一段 ≤ 150ms × 机器忙的倍数（同 test_answer_cost_v1165 的 CAL 换算，最多 3 倍）
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
/* 机器忙不忙（同 test_answer_cost_v1165）：一段固定的活，4 倍节流下这台测试机正常约 60ms */
const CAL = () => { const o = { a: [] }; for (let i = 0; i < 9000; i++) o.a.push({ i, s: 'word' + i, t: [i, i * 2, i * 3], cn: '中文词' + i, ok: i % 2 === 0 }); const t0 = performance.now(); for (let k = 0; k < 3; k++) { const s = JSON.stringify(o); const b = JSON.parse(s); let n = 0; for (const x of b.a) n += x.s.length + x.cn.length; if (n < 0) throw 0; } return performance.now() - t0; };
const CAL_REF = 60, CAP = 150, WALKS = 6;

/* 一个「进度多」的孩子：27 个岛存档 + 账本约 900 已学 / 200 错词 / 300 复习计划 + 上一代 _bak */
async function buildHeavyFixture() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_food.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenCanonical && window.S && typeof startListen === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const seed = await page.evaluate(() => {
    const HC = window.HansenCanonical, now = Date.now();
    const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const tpl = JSON.parse(JSON.stringify(window.S));
    let rnd = 12345; const R = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
    const out = {};
    HC.allSaveAliases().forEach((key, k) => {
      const a = HC.resolve(key); if (!a) return;
      const s = JSON.parse(JSON.stringify(tpl));
      s.learned = []; s.mc = {}; s.wrongs = {}; s.srs = {};
      for (let i = 0; i < a.length; i++) {
        if (R() < 0.95) { s.learned.push(i); s.mc[i] = 1 + Math.floor(R() * 5); }
        if (R() < 0.21) s.wrongs[i] = 1 + Math.floor(R() * 3);
        if (R() < 0.32) s.srs[i] = { box: Math.floor(R() * 5), due: ymd(new Date(now + Math.floor(R() * 6 - 2) * 86400000)), last: ymd(new Date(now - 86400000)) };
      }
      s.stats = Object.assign({}, s.stats || {}, { correct: 400 + k, wrong: 60 + k, clozeRight: 30, listenRight: 25, typeCount: 12 });
      s.lastSaveTime = now - (k + 2) * 3600000;
      out[key] = JSON.stringify(s); out[key + '_bak'] = out[key];
    });
    Object.entries(out).forEach(([k, v]) => localStorage.setItem(k, v));
    HC.migrate();
    const st = HC.read();
    HC.islands.forEach(isl => { const p = st.islands[isl.id]; for (let i = 0; i < isl.words; i++) if (R() < 0.75) p.cleared.wrongs[i] = now - Math.floor(R() * 40) * 86400000 - 1; });
    HC.write(st);
    const st2 = HC.read(); HC.write(st2);   // _bak = 上一代
    let learned = 0, wrongs = 0, srs = 0;
    HC.islands.forEach(isl => { const p = st2.islands[isl.id]; learned += p.learned.length; wrongs += Object.keys(p.wrongs).length; srs += Object.keys(p.srs).length; });
    const all = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); all[k] = localStorage.getItem(k); }
    delete all.wordIslandFood; delete all.wordIslandFood_bak;   // 食物岛自己的存档让页面现场写
    return { all, learned, wrongs, srs, ledgerBytes: localStorage.getItem(HC.STORE_KEY).length, saves: HC.allSaveAliases().length };
  });
  await ctx.close();
  return seed;
}


try {
  const fx = await buildHeavyFixture();
  console.log(`孩子进度：已学 ${fx.learned}、错词 ${fx.wrongs}、复习计划 ${fx.srs}，${fx.saves} 个岛存档`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(seed => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); for (const k in seed) localStorage.setItem(k, seed[k]); sessionStorage.setItem('__s', '1'); } } catch (e) {} }, fx.all);
  await ctx.addInitScript(() => {
    window.__lt = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push({ s: e.startTime, d: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
    /* 「整份翻一遍 localStorage」都从 key(0) 开始：数 key(0) 被调了几次 */
    try { const K = Storage.prototype.key; window.__walks = 0; Storage.prototype.key = function (i) { if (i === 0 && this === window.localStorage) window.__walks++; return K.apply(this, arguments); }; } catch (e) {}
    /* 云存档的「数据一变就整份导出」是对战组的（deferred_battle-01），这里只管成就墙自己 */
    try { const add = EventTarget.prototype.addEventListener; EventTarget.prototype.addEventListener = function (type) { if (type === 'hsn-data-changed') return; return add.apply(this, arguments); }; } catch (e) {}
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_food.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof renderAch === 'function' && window.HansenCanonical && window.HansenAch && typeof getAchProgress === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
  await sleep(3500);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); showScreen('ach'); });
  await sleep(1500);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await sleep(500);
  const cats = await page.evaluate(() => [...document.querySelectorAll('#achList .ach-bar')].map(b => b.getAttribute('onclick')).filter(oc => !/背单词/.test(oc)));
  const rows = [];
  for (const oc of cats) {
    const calB = await page.evaluate(CAL);
    await page.evaluate(() => { window.__lt = []; window.__walks = 0; window.__t0 = performance.now(); });
    const l = page.locator(`#achList .ach-bar[onclick="${oc}"]`).first();
    await l.scrollIntoViewIfNeeded().catch(() => {});
    await page.evaluate(() => { window.__lt = []; window.__walks = 0; window.__t0 = performance.now(); });
    await l.tap();
    await sleep(1500);
    const r = await page.evaluate(() => { const t0 = window.__t0; const lt = window.__lt.filter(x => x.s >= t0 - 5); return { max: Math.round(Math.max(0, ...lt.map(x => x.d))), walks: window.__walks, open: true }; });
    const calA = await page.evaluate(CAL);
    const k = Math.min(3, Math.max(1, Math.max(calB, calA) / CAL_REF));
    rows.push({ cat: oc.replace(/.*'(.*)'.*/, '$1'), ...r, k });
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  rows.forEach(r => console.log(`    点开「${r.cat}」：整份翻 localStorage ${r.walks} 遍、主线程最长一段 ${r.max}ms（上限 ${Math.round(CAP * r.k)}ms，×${r.k.toFixed(2)}）`));
  console.log(`    负载 ${os.loadavg().map(x => x.toFixed(1)).join(' / ')}（${os.cpus().length} 核）`);
  ok(rows.length >= 8, `真点开了 ${rows.length} 栏`);
  const many = rows.filter(r => r.walks > WALKS);
  ok(!many.length, `① 点开一栏最多整份翻 ${WALKS} 遍 localStorage（超过的：${many.map(r => r.cat + ' ' + r.walks + ' 遍').join('、') || '没有'}；最多 ${Math.max(...rows.map(r => r.walks))} 遍）`);
  const slow = rows.filter(r => r.max > CAP * r.k);
  ok(!slow.length, `② 4 倍慢 CPU：每点开一栏主线程最长一段 ≤ ${CAP}ms×倍数（超过的：${slow.map(r => r.cat + ' ' + r.max + 'ms').join('、') || '没有'}；中位数 ${median(rows.map(r => r.max))}ms）`);
  ok(errs.length === 0, '页面无报错 ' + errs.slice(0, 3).join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 成就墙一次重画只算一遍进度');
