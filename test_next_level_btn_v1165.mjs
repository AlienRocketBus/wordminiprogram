/* test_next_level_btn_v1165.mjs —— 结算页「⚡ 挑战中级 / 🔥 挑战高级」只带孩子去有词的那一档
 *
 * 复查（v1165 第 2 轮 R2-LVL1）：动作岛的打地鼠、钓鱼、泡泡、字母拼拼乐、火眼金睛「高级」一个词都没有（菜单里画成灰色 🔒），
 *   可中级结算页照样给「🔥 挑战高级」：火眼金睛点了完全没反应，别的只弹「本岛暂时没有这个难度的单词」。
 *
 * 合同（island_action，每个游戏开一局中级、直接结算；再看一个高级有词的岛做对照）：
 *   ① 这 5 个游戏的中级结算页：没有「挑战高级」按钮，写「🏆 你完成了最高难度」
 *   ② 动物岛（高级有词）：中级结算页照旧有「🔥 挑战高级」，点它真的开始高级
 *   ③ 火眼金睛没词的那一档：点了会说「本岛暂时没有这个难度的单词」（以前一点反应都没有）
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
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
/* 每个游戏：开中级、把题池清空、调结算；返回结算区的文字和按钮 */
const GAMES = [
  ['moles', 'MOLES_LEVELS', 'startMolesLevel', 'molesPool', 'molesComplete', 'molesContent'],
  ['fish', 'FISH_LEVELS', 'startFishLevel', 'fishPool', 'fishComplete', 'fishContent'],
  ['bubble', 'BUBBLE_LEVELS', 'startBubbleLevel', 'bubblePool', 'bubbleComplete', 'bubbleContent'],
  ['scramble', 'SCRAMBLE_LEVELS', 'startScrambleLevel', 'scrPool', 'scrComplete', 'scrambleContent'],
  ['eagle', 'EAGLE_LEVELS', 'startEagleLevel', 'eaglePool', 'eagleComplete', 'eagleContent'],
];
async function finishMedium(page, g) {
  return page.evaluate(([name, LV, start, pool, done, box]) => {
    const L = eval(LV), keys = [...Array(allW.length).keys()];
    const hard = keys.filter(L.hard.filter).length;
    try { eval(start)('medium'); } catch (e) { return { name, err: 'start: ' + e.message }; }
    try { const P = eval(pool); if (Array.isArray(P)) P.length = 0; } catch (e) {}
    if (name === 'scramble') scrCorrect = scrTotal;   // 字母拼拼乐只有过关（≥60%）的结算页才给「挑战下一档」：当作全拼对了
    try { eval(done)(); } catch (e) { return { name, err: 'done: ' + e.message }; }
    const el = document.getElementById(box) || document.querySelector('.screen.active');
    const btns = el ? [...el.querySelectorAll('button')].map(b => ({ t: b.textContent.trim(), on: b.getAttribute('onclick') || '' })) : [];
    return { name, hard, txt: el ? el.innerText.replace(/\s+/g, ' ') : '', btns };
  }, g);
}
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const open = async file => {
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 160))); page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.readyState !== 'loading' && typeof startEagleLevel === 'function' && typeof molesComplete === 'function', null, { timeout: 30000 });
    await sleep(1200);
    await page.evaluate(() => { try { closeAlert(); } catch (e) {} window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); }; window.__toasts = []; const o = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); try { return o.apply(this, arguments); } catch (e) {} }; });
    return { page, errs };
  };

  console.log('\n▶ ① island_action：高级 0 个词的 5 个游戏');
  const A = await open('island_action.html');
  for (const g of GAMES) {
    const r = await finishMedium(A.page, g);
    if (r.err) { ok(false, `${g[0]} 结算出错：${r.err}`); continue; }
    const hasHardBtn = r.btns.some(b => /挑战高级/.test(b.t));
    ok(r.hard === 0 && !hasHardBtn && /你完成了最高难度/.test(r.txt), `① ${r.name}（高级 ${r.hard} 个词）：中级结算页没有「挑战高级」（${r.btns.map(b => b.t).join(' / ')}），写「完成了最高难度」`);
    await A.page.evaluate(() => showScreen('home')); await sleep(200);
  }
  console.log('\n▶ ③ 火眼金睛没词的那一档');
  const t3 = await A.page.evaluate(() => { window.__toasts.length = 0; const before = (document.querySelector('.screen.active') || {}).id; startEagleLevel('hard'); return { before, after: (document.querySelector('.screen.active') || {}).id, toasts: window.__toasts.slice(), active: !!eagleActive }; });
  ok(t3.toasts.some(t => /本岛暂时没有这个难度的单词/.test(t)) && !t3.active, `③ 点了会说「本岛暂时没有这个难度的单词」，不开局（${JSON.stringify(t3.toasts)}）`);
  ok(A.errs.length === 0, 'action 页面无报错 ' + A.errs.join(' | '));
  await A.page.close();

  console.log('\n▶ ② 对照：island_animal（高级有词）');
  const B = await open('island_animal.html');
  for (const g of GAMES) {
    const r = await finishMedium(B.page, g);
    if (r.err) { ok(false, `${g[0]} 结算出错：${r.err}`); continue; }
    const btn = r.btns.find(b => /挑战高级/.test(b.t));
    ok(r.hard > 0 && btn && /'hard'/.test(btn.on), `② ${r.name}（高级 ${r.hard} 个词）：中级结算页照旧有「🔥 挑战高级」（${btn ? btn.on : '没有'}）`);
    if (g[0] === 'eagle' && btn) {
      await B.page.evaluate(on => { eval(on); }, btn.on);
      await sleep(400);
      const st = await B.page.evaluate(() => ({ lvl: eagleLevel, active: !!eagleActive }));
      ok(st.lvl === 'hard' && st.active, `② 点「挑战高级」真的开始高级（${JSON.stringify(st)}）`);
      await B.page.evaluate(() => { try { stopEagle && stopEagle(); } catch (e) {} showScreen('home'); });
    }
    await B.page.evaluate(() => showScreen('home')); await sleep(200);
  }
  ok(B.errs.length === 0, 'animal 页面无报错 ' + B.errs.join(' | '));
  await B.page.close();
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 结算页只带孩子去有词的那一档');
