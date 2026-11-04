/* test_land_listen_v1165.mjs —— 单词大陆 8 个岛的「听音辨义」每一档都有词、都能玩
 *
 * v1163：8 个大陆岛共用一张写死的词表（只有①②号岛的词）。③–⑧号岛三档都是「📚 0 个单词」，
 *        一点就报 TypeError（nextListenQ 读不到词），孩子看见的是「点了没反应」；①号岛 30 个词只练到 30 个里的一部分。
 *
 * 合同：
 *   ① land1~8 每一档都 >0 个词，三档合起来正好覆盖本岛 30 个词（不多不少、不重复）
 *   ② 每一档都能真点进去开始（出现 4 个选项），没有页面报错
 *   ③ 某一档真的没词时（常规岛也可能）：画成灰色 🔒 卡片、不能点；直接调用只提示、不报错
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

async function open(file) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof startListen === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(900);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} });
  return { page, errs };
}

try {
  for (let n = 1; n <= 8; n++) {
    const file = `island_land${n}.html`;
    console.log(`\n▶ ${file}`);
    const { page, errs } = await open(file);
    const lv = await page.evaluate(() => {
      const out = {}; const all = [];
      for (const k of Object.keys(LISTEN_LEVELS)) { out[k] = LISTEN_LEVEL_IDX[k].length; all.push(...LISTEN_LEVEL_IDX[k]); }
      return { out, union: new Set(all).size, sum: all.length, n: allW.length };
    });
    ok(Object.values(lv.out).every(c => c > 0), '① 三档都有词 ' + JSON.stringify(lv.out));
    ok(lv.union === lv.n && lv.sum === lv.n, `① 三档合起来正好覆盖本岛 ${lv.n} 个词（覆盖 ${lv.union}，合计 ${lv.sum}）`);
    for (const k of ['easy', 'medium', 'hard']) {
      // 真点：主页卡片 → 难度卡
      await page.evaluate(() => showScreen('home'));
      await page.locator('.mode-card', { hasText: '听音辨义' }).first().tap();
      await page.waitForTimeout(250);
      const name = await page.evaluate(k => LISTEN_LEVELS[k].name, k);
      const card = page.locator('#listenContent [onclick^="startListenLevel"]', { hasText: name });
      const can = await card.count();
      if (can) await card.first().tap();
      await page.waitForTimeout(500);
      const st = await page.evaluate(() => ({ active: listenActive, opts: document.querySelectorAll('#listenScreen .listen-opts .boss-opt').length, q: listenQ && listenQ.word && listenQ.word.en }));
      ok(can === 1 && st.active && st.opts === 4 && !!st.q, `② 「${name}」能点进去开始：4 个选项，第一题 ${st.q}`);
      await page.evaluate(() => { stopListen(); showScreen('home'); });
    }
    ok(errs.length === 0, '② 页面无报错 ' + errs.join(' | '));
    await page.close();
  }

  // ③ 真的没有词的一档：灰卡、不能点；直接调用只提示、不报错（用常规岛造一档空的）
  console.log('\n▶ 空档（造一档 0 个词）');
  {
    const { page, errs } = await open('island_animal.html');
    const r = await page.evaluate(async () => {
      const toasts = []; const T = window.showToast; window.showToast = m => { toasts.push(m); };
      LISTEN_LEVEL_IDX.hard.length = 0;
      startListen();
      const cards = [...document.querySelectorAll('#listenContent > div > div')].filter(d => /初级|中级|高级/.test(d.textContent));
      const hard = cards.find(d => /高级/.test(d.textContent));
      const locked = !!hard && /🔒/.test(hard.textContent) && !hard.getAttribute('onclick');
      startListenLevel('hard');
      await new Promise(r => setTimeout(r, 200));
      window.showToast = T;
      return { locked, active: listenActive, toasts, n: cards.length };
    });
    ok(r.locked, '③ 0 个词的「高级」画成 🔒 灰卡，没有点击事件');
    ok(!r.active && r.toasts.some(t => /本岛暂时没有这个难度的单词/.test(t)), '③ 直接开始 0 词档：只提示，不进游戏 ' + JSON.stringify(r.toasts));
    ok(errs.length === 0, '③ 页面无报错 ' + errs.join(' | '));
    await page.close();
  }
} finally { await ctx.close(); await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 单词大陆听音辨义：8 岛每档都有词、都能玩；空档画成 🔒');
