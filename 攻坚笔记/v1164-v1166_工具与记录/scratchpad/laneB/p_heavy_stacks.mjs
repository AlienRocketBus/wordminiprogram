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
import { chromium } from '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt/playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.PROBE_ROOT || '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt';
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


const fx = await buildHeavyFixture();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
await ctx.addInitScript(seed => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); for (const k in seed) localStorage.setItem(k, seed[k]); sessionStorage.setItem('__s', '1'); } } catch (e) {} }, fx.all);
const page = await ctx.newPage();
await page.goto(BASE + (process.argv[2]||'island_food.html'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.HansenCanonical && window.S && document.readyState === 'complete', null, { timeout: 30000 });
await page.waitForTimeout(2500);
const mode = process.argv[3] || 'listen';
const r = await page.evaluate((mode) => {
  const orig = JSON.parse; const stacks = {}; let n = 0; const sizes={};
  JSON.parse = function (s) { if (typeof s === 'string' && s.length > 5000) { n++; sizes[s.length]=(sizes[s.length]||0)+1; const st = (new Error().stack || '').split('\n').slice(2, 10).map(l => l.trim().replace(/^at /,'').replace(/\(?https?:\/\/[^)]*\/([^/?)]+)(\?v=\d+)?:(\d+):\d+\)?/, '@$1:$3')).join(' < '); stacks[st] = (stacks[st] || 0) + 1; } return orig.apply(this, arguments); };
  const t0 = performance.now();
  if(mode==='mark'){ markAnswer(15, true); }
  else { startListen(); startListenLevel('easy'); const i=listenQ.opts.findIndex(o=>o.cn===listenQ.word.cn); const t1=performance.now(); listenAnswer(i); }
  const ms = performance.now() - t0;
  JSON.parse = orig;
  return { n, ms, sizes, stacks: Object.entries(stacks).sort((a, b) => b[1] - a[1]) };
}, mode);
console.log('big parses', r.n, 'ms', r.ms.toFixed(1), JSON.stringify(r.sizes));
for (const [s, c] of r.stacks) console.log(c, s);
await browser.close(); srv.close();
