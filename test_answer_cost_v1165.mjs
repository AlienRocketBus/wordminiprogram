/* test_answer_cost_v1165.mjs —— 进度多的孩子每答一题不能卡（账本不能每次都整份重读、重算）
 *
 * 事故（v1165 复查实测）：学了 900 个词、错词 200、复习计划 300 的孩子，4 倍慢 CPU 下每答一题主线程卡 350~410ms。
 *   根因：readStore() 每次都把主账本和 _bak 两份 JSON 整份解析、规整、合并、再序列化两遍比较；
 *   一次答题里 markAnswer / save 钩子 / 复习奖励 / 成就 / 宠物 各自又调好几次 → 一题 20 来次整份重建。
 *
 * 合同（真浏览器，CDP 4 倍 CPU 节流，听音辨义真点 10 题，其中 3 题答错走小课）：
 *   1. 平均每题「整份账本重建」≤ 1 次（HansenCanonical._perf().rebuilds；旧代码没有这个计数器时
 *      用「解析超过 20KB 的字符串次数 ÷ 3」近似 —— 旧 readStore 每次解析 main + _bak + 合并时的副本共 3 份）
 *   2. 点选项那一下的主线程处理时间（Event Timing：click 的 processingEnd - processingStart）中位数 ≤ 120ms
 *   3. 岛单独打开、在首页外壳 iframe 里打开，两种都要过
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
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--autoplay-policy=no-user-gesture-required'] });
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

/* 每个页面框都装：大字符串 JSON.parse 计数 + Event Timing（click 处理时间） */
const PROBE = () => {
  try {
    const orig = JSON.parse; window.__bigParse = 0;
    JSON.parse = function (s) { if (typeof s === 'string' && s.length > 20000) window.__bigParse++; return orig.apply(this, arguments); };
  } catch (e) {}
  try {
    window.__evt = [];
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'click') window.__evt.push({ t: e.startTime, ps: e.processingStart, pe: e.processingEnd, d: e.duration }); })
      .observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch (e) {}
};

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

async function runCase(label, shell, seedAll) {
  console.log(`\n▶ ${label}`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(seed => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); for (const k in seed) localStorage.setItem(k, seed[k]); sessionStorage.setItem('__s', '1'); } } catch (e) {} }, seedAll);
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const cdp = await ctx.newCDPSession(page);
  let F;   // 岛所在的框
  if (shell) {
    await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.openIsland === 'function' && document.querySelector('a.island[href="island_food.html"]'), null, { timeout: 30000 });
    await page.waitForTimeout(800);
    const card = await page.evaluate(async () => { const el = document.querySelector('a.island[href="island_food.html"]'); el.scrollIntoView({ block: 'center' }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await page.touchscreen.tap(card.x, card.y);
    await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /island_food\.html$/.test(f.contentWindow.location.pathname) && f.contentWindow.HansenCanonical && typeof f.contentWindow.startListen === 'function'; } catch (e) { return false; } }, null, { timeout: 30000 });
    F = page.frames().find(f => /island_food\.html/.test(f.url()) && f.parentFrame() === page.mainFrame());
  } else {
    await page.goto(BASE + 'island_food.html', { waitUntil: 'domcontentloaded' });
    F = page.mainFrame();
  }
  await F.waitForFunction(() => window.HansenCanonical && window.S && typeof startListen === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  /* 欢迎弹窗之类先关掉（只关「开始冒险」，不碰别的） */
  await F.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
  await page.waitForTimeout(500);
  const tapIn = async sel => {
    const pt = await F.evaluate(async s => {
      const el = typeof s === 'string' ? document.querySelector(s) : null; if (!el) return null;
      el.scrollIntoView({ block: 'center' }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const b = el.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const h = document.elementFromPoint(x, y);
      return { x, y, hit: !!h && (h === el || el.contains(h)) };
    }, sel);
    if (!pt || !pt.hit) return false;
    await page.touchscreen.tap(pt.x, pt.y);   // 外壳 iframe 铺满全屏，坐标一致
    return true;
  };
  ok(await tapIn('.mode-card[onclick="startListen()"]'), '真点「听音辨义」');
  await F.waitForFunction(() => document.querySelector('#listenContent [onclick^="startListenLevel"]'), null, { timeout: 8000 });
  ok(await tapIn('#listenContent [onclick^="startListenLevel"]'), '真点第一档难度');
  await F.waitForFunction(() => typeof listenQ !== 'undefined' && listenQ && !listenQ.answered && document.querySelectorAll('#listenScreen .boss-opt').length === 4, null, { timeout: 8000 });

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const WRONG = new Set([2, 5, 8]);
  const handler = [], rebuilds = [];
  for (let n = 0; n < 10; n++) {
    await F.waitForFunction(() => typeof listenQ !== 'undefined' && listenQ && !listenQ.answered && document.querySelectorAll('#listenScreen .boss-opt').length === 4 && !document.getElementById('hml_lesson'), null, { timeout: 20000 });
    await page.waitForTimeout(350);
    const before = await F.evaluate(() => ({ big: window.__bigParse, rb: (window.HansenCanonical && HansenCanonical._perf) ? HansenCanonical._perf().rebuilds : null, evt: window.__evt.length, total: listenTotal, q: listenQ.idx }));
    const pick = await F.evaluate(wrong => listenQ.opts.findIndex(o => wrong ? o.cn !== listenQ.word.cn : o.cn === listenQ.word.cn), WRONG.has(n));
    const tapped = await tapIn(`#listenScreen .listen-opts .boss-opt:nth-child(${pick + 1})`);
    if (!tapped) { ok(false, `第 ${n + 1} 题选项点不到`); break; }
    if (WRONG.has(n)) {
      await F.waitForFunction(() => document.getElementById('hml_lesson'), null, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(300);
      await tapIn('#hml_lesson');
    }
    await F.waitForFunction(q => typeof listenQ !== 'undefined' && listenQ && (listenQ.idx !== q || !listenQ.answered) && !document.getElementById('hml_lesson'), before.q, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(400);
    const after = await F.evaluate(() => ({ big: window.__bigParse, rb: (window.HansenCanonical && HansenCanonical._perf) ? HansenCanonical._perf().rebuilds : null, evt: window.__evt.slice(), total: listenTotal }));
    const clicks = after.evt.slice(before.evt).filter(e => e.pe - e.ps > 0);
    const ms = clicks.length ? Math.max(...clicks.map(e => e.pe - e.ps)) : 0;   // 没进 Event Timing（<16ms）就记 0
    handler.push(+ms.toFixed(1));
    rebuilds.push(after.rb !== null && before.rb !== null ? after.rb - before.rb : (after.big - before.big) / 3);
    if (after.total !== before.total + 1) ok(false, `第 ${n + 1} 题没记上（listenTotal ${before.total}→${after.total}）`);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const avgRb = rebuilds.reduce((a, b) => a + b, 0) / Math.max(1, rebuilds.length);
  console.log(`    每题点击处理 ms: ${handler.join(', ')}`);
  console.log(`    每题账本重建: ${rebuilds.map(x => +x.toFixed(2)).join(', ')}`);
  ok(rebuilds.length === 10 && avgRb <= 1, `平均每题整份账本重建 ≤ 1 次（实测 ${avgRb.toFixed(2)}）`);
  const med = median(handler);
  ok(handler.length === 10 && med <= 120, `4 倍慢 CPU：点选项的主线程处理中位数 ≤ 120ms（实测 ${med.toFixed(1)}ms）`);
  ok(errs.length === 0, `页面无报错 ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
  return { med, avgRb };
}

try {
  const fx = await buildHeavyFixture();
  console.log(`孩子进度：已学 ${fx.learned}、错词 ${fx.wrongs}、复习计划 ${fx.srs}，账本 ${(fx.ledgerBytes / 1024).toFixed(0)}KB，${fx.saves} 个岛存档`);
  ok(fx.learned >= 850 && fx.wrongs >= 150 && fx.srs >= 250 && fx.saves >= 27, '夹具够「重」');
  await runCase('island_food 单独打开', false, fx.all);
  await runCase('island_food 在首页外壳里', true, fx.all);
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 每答一题不再整份重读账本');
process.exit(fails ? 1 : 0);
