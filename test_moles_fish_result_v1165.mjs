/* test_moles_fish_result_v1165.mjs —— 打地鼠/钓鱼结算照实说：漏了就是「打中 7 / 8 个」，全中才是「全部」
 *
 * v1163：只要这一档打完，结算页就写「打中全部 N 个」「钓上全部 N 条」，哪怕中间打错过（错的词在本轮末再考时答对，
 *        不算进打中数）。孩子和老师看到的是假话。
 *
 * 合同（island_city 初级，8 个词）：
 *   ① 打地鼠：真点，中间打错 1 次 →「打中 7 / 8 个 · 打错 1 次」；全对 →「打中全部 8 个」
 *   ② 钓鱼：中间钓错 1 次 →「钓上 7 / 8 条 · 钓错 1 次」；全对 →「钓上全部 8 条」
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

async function playMoles(page, wrongOnce) {
  await page.evaluate(() => { showScreen('home'); startMoles(); startMolesLevel('easy'); });
  let wrongDone = !wrongOnce;
  for (let k = 0; k < 60; k++) {
    const st = await page.evaluate(() => ({ active: molesActive, ready: !!(molesTarget && document.querySelector('#molesGrid .mole-card') && ![...document.querySelectorAll('[id^="moleSlot"]')].some(s => s.dataset.locked)), lesson: !!document.getElementById('hml_lesson') }));
    if (!st.active) break;
    if (st.lesson) { await page.locator('#hml_lesson').tap().catch(() => {}); await page.waitForTimeout(400); continue; }
    if (!st.ready) { await page.waitForTimeout(150); continue; }
    const slot = await page.evaluate(w => [...document.querySelectorAll('[id^="moleSlot"]')].findIndex(s => s.dataset.en && (w ? s.dataset.en !== molesTarget.en : s.dataset.en === molesTarget.en)), !wrongDone);
    await page.locator('#moleSlot' + slot).tap();
    wrongDone = true;
    await page.waitForTimeout(1050);
  }
  return page.evaluate(() => (document.getElementById('molesContent').textContent || '').replace(/\s+/g, ' '));
}
async function playFish(page, wrongOnce) {
  await page.evaluate(() => { showScreen('home'); startFish(); startFishLevel('easy'); });
  let wrongDone = !wrongOnce;
  for (let k = 0; k < 160; k++) {
    const st = await page.evaluate(() => ({ active: fishActive, lesson: !!document.getElementById('hml_lesson'), locked: !!window.fishLocked, t: fishTarget && fishTarget.en }));
    if (!st.active) break;
    if (st.lesson) { await page.locator('#hml_lesson').tap().catch(() => {}); await page.waitForTimeout(400); continue; }
    const hit = await page.evaluate(w => { if (window.fishLocked || !fishTarget) return false; const f = [...document.querySelectorAll('#fishPond [data-en]')].find(x => !x.dataset.done && (w ? x.dataset.en !== fishTarget.en : x.dataset.en === fishTarget.en)); if (!f) return false; f.click(); return true; }, !wrongDone);
    if (hit) { wrongDone = true; await page.waitForTimeout(700); } else await page.waitForTimeout(250);
  }
  return page.evaluate(() => (document.getElementById('fishContent').textContent || '').replace(/\s+/g, ' '));
}

try {
  const ctx = await newCtx();
  const { page, errs } = await open(ctx, 'island_city.html', "typeof startMoles === 'function'");
  const n = await page.evaluate(() => [...Array(allW.length).keys()].filter(MOLES_LEVELS.easy.filter).length);
  console.log('\n▶ ① 打地鼠（island_city 初级，' + n + ' 个词）');
  const m1 = await playMoles(page, true);
  ok(new RegExp('打中 ' + (n - 1) + ' / ' + n + ' 个').test(m1) && /打错 1 次/.test(m1) && !/打中全部/.test(m1), '① 打错 1 次 → ' + (m1.match(/打中[^·]*个(\s*·\s*打错 \d+ 次)?/) || [m1.slice(0, 80)])[0]);
  const m2 = await playMoles(page, false);
  ok(new RegExp('打中全部 ' + n + ' 个').test(m2) && !/打错/.test(m2), '① 全对 → ' + (m2.match(/打中[^·]*个/) || [m2.slice(0, 80)])[0]);
  const nf = await page.evaluate(() => [...Array(allW.length).keys()].filter(FISH_LEVELS.easy.filter).length);
  console.log('\n▶ ② 钓鱼（island_city 初级，' + nf + ' 条）');
  const f1 = await playFish(page, true);
  ok(new RegExp('钓上 ' + (nf - 1) + ' / ' + nf + ' 条').test(f1) && /钓错 1 次/.test(f1) && !/钓上全部/.test(f1), '② 钓错 1 次 → ' + (f1.match(/钓上[^·]*条(\s*·\s*钓错 \d+ 次)?/) || [f1.slice(0, 80)])[0]);
  const f2 = await playFish(page, false);
  ok(new RegExp('钓上全部 ' + nf + ' 条').test(f2) && !/钓错/.test(f2), '② 全对 → ' + (f2.match(/钓上[^·]*条/) || [f2.slice(0, 80)])[0]);
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 打地鼠/钓鱼结算照实说打中几个');
