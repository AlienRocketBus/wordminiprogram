/* test_cloze_askable_v1165.mjs —— 完形填空：例句里用变形的词也能出题；全对就是 100%；句中大写不被改成小写
 *
 * v1163：只认例句里的原词（\bword\b）。例句写的是 eyes / cooks / flown / Cows 的 48 个词永远出不了题，
 *        却照样算进总数：身体岛初级全对显示「答对 12 / 20 题 · 正确率 60%」、动物岛初级 77%。
 *        另外只有句首才大写：「I have a cat. It is white.」答完变成「… it is white.」，「Happy New Year!」变成「Happy New year!」。
 *
 * 合同：
 *   ① 27 个岛的每一档：卡片上的词个个都能挖空（没有被悄悄跳过的词）
 *   ② 身体岛初级全对 →「答对 N / N 题 · 正确率 100%」，N = 卡片上写的题数，题号一题一题走（不跳号）
 *   ③ 动物岛初级全对 → 100%
 *   ④ 「It is white」「New Year」答完保留原来的大写；变形词填回句子自己的写法（eyes）
 *   ⑤ Boss 完形用同一个找空规则（变形词也能当 Boss 完形题）
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
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof startCloze === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} });
  return { page, errs };
}
// 页面里自己的「能不能挖空」：有新函数用新函数；旧页面（v1163）用它当时的规则（只认原词）
const ASKABLE = () => {
  const m = (typeof window.__hsnClozeMatch === 'function') ? window.__hsnClozeMatch
    : (w => { const r = new RegExp('\\b' + w.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').exec(w.ex || ''); return r ? { index: r.index, text: r[0] } : null; });
  return m;
};

try {
  // ① 27 个岛：卡片上的词个个能挖空
  console.log('\n▶ ① 27 个岛的完形各档');
  const files = fs.readdirSync(ROOT).filter(f => /^island_[a-z0-9]+\.html$/.test(f)).sort();
  let lostAll = [];
  for (const f of files) {
    const { page, errs } = await open(f);
    const r = await page.evaluate((src) => {
      const match = (new Function('return (' + src + ')'))()();
      const out = {}; const lost = [];
      for (const k of Object.keys(CLOZE_LEVELS)) {
        const inIsland = CLOZE_LEVELS[k].words.filter(en => allW.some(w => w.en === en));
        const ask = inIsland.filter(en => match(allW.find(w => w.en === en)));
        inIsland.filter(en => !ask.includes(en)).forEach(en => lost.push(k + ':' + en));
        out[k] = { card: CLOZE_LEVEL_IDX[k].length, words: inIsland.length, ask: ask.length };
      }
      return { out, lost };
    }, ASKABLE.toString());
    const same = Object.values(r.out).every(x => x.card === x.ask && x.ask === x.words);
    if (!same || r.lost.length) lostAll.push(f + ' ' + JSON.stringify(r.out) + ' 缺 ' + r.lost.join(','));
    if (errs.length) lostAll.push(f + ' 报错 ' + errs.join(' | '));
    await page.close();
  }
  ok(lostAll.length === 0, `① 27 个岛每档卡片题数 = 能出题的词数 = 本档词数（没有被悄悄跳过的词）` + (lostAll.length ? '\n     ' + lostAll.join('\n     ') : ''));

  // ②③ 全对 → 100%（全真点选项；为了快，把读例句改成立刻读完）
  for (const [file, lv] of [['island_body.html', 'easy'], ['island_animal.html', 'easy']]) {
    console.log(`\n▶ ②③ ${file} 完形 ${lv} 全对`);
    const { page, errs } = await open(file);
    await page.evaluate(() => { window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); }; });
    await page.evaluate(() => showScreen('home'));
    await page.locator('.mode-card', { hasText: '完形填空' }).first().tap();
    await page.waitForTimeout(250);
    const cardTxt = await page.evaluate(lv => { const L = CLOZE_LEVELS[lv]; const c = [...document.querySelectorAll('#clozeContent [onclick^="startClozeLevel"]')].find(d => d.textContent.includes(L.name)); return c ? c.textContent : ''; }, lv);
    const cardN = +((cardTxt.match(/📚\s*(\d+)\s*题/) || [])[1] || -1);
    await page.locator('#clozeContent [onclick^="startClozeLevel"]').first().tap();
    const seen = [];
    for (let k = 0; k < 80; k++) {
      const st = await page.evaluate(() => ({ active: clozeActive, done: document.querySelectorAll('#clozeScreen .cloze-opt[data-done]').length, n: document.querySelectorAll('#clozeScreen .cloze-opt').length,
        prog: ((document.querySelector('#clozeContent [style*="margin-left:auto"]') || {}).textContent || ''), w: clozeQ && clozeQ.word && clozeQ.word.en }));
      if (!st.active) break;
      if (st.n === 4 && st.done === 0) {
        seen.push(st.prog);
        const ci = await page.evaluate(() => clozeQ.opts.findIndex(o => o.en === clozeQ.word.en));
        await page.locator('#clozeScreen .cloze-opt').nth(ci).tap();
      }
      await page.waitForTimeout(950);
    }
    const res = await page.evaluate(() => (document.getElementById('clozeContent').textContent || '').replace(/\s+/g, ' '));
    const m = res.match(/答对 (\d+) \/ (\d+) 题 · 正确率 (\d+)%/);
    ok(m && +m[1] === +m[2] && +m[3] === 100, `②③ 全对 → ${m ? m[0] : res.slice(0, 80)}`);
    ok(m && +m[2] === cardN, `②③ 结算总数 = 卡片上写的题数（卡片 ${cardN}，结算 ${m && m[2]}）`);
    const nums = seen.map(s => +((s.match(/(\d+)\s*\//) || [])[1] || 0));
    ok(nums.length === cardN && nums.every((x, i) => x === i + 1), `②③ 题号一题一题走、不跳号：${nums.join(',')}`);
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await page.close();
  }

  // ④ 大小写保留 + 变形填回原写法
  console.log('\n▶ ④ 大小写和变形');
  for (const [file, en] of [['island_question.html', 'it'], ['island_time.html', 'year'], ['island_body.html', 'eye'], ['island_animal.html', 'cow']]) {
    const { page, errs } = await open(file);
    const r = await page.evaluate(async (en) => {
      window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); };
      const i = allW.findIndex(w => w.en === en);
      const lv = Object.keys(CLOZE_LEVEL_IDX).find(k => CLOZE_LEVEL_IDX[k].includes(i)) || 'easy';
      startCloze(); startClozeLevel(lv);
      clozePool.length = 0; clozePool.push(i); clozeActive = true; nextClozeQ();
      const asked = clozeQ && clozeQ.word.en === en;
      const ci = clozeQ ? clozeQ.opts.findIndex(o => o.en === en) : -1;
      if (ci >= 0) document.querySelectorAll('#clozeScreen .cloze-opt')[ci].click();
      const s = (document.querySelector('#clozeScreen .cloze-sentence') || {}).textContent || '';
      const ex = allW[i].ex;
      stopCloze(); showScreen('home');
      return { asked, s: s.replace(/\s+/g, ' ').trim(), ex };
    }, en);
    ok(r.asked && r.s === r.ex, `④ ${en}：答完句子和原例句一字不差（「${r.s}」 vs 「${r.ex}」）`);
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await page.close();
  }

  // ⑤ Boss 完形：变形词也能出题，挖空/填回都对
  console.log('\n▶ ⑤ Boss 完形');
  {
    const { page, errs } = await open('island_body.html');
    const r = await page.evaluate(async () => {
      const i = allW.findIndex(w => w.en === 'eye');
      showScreen('boss'); startBoss();
      let q = null;
      for (let a = 0; a < 4; a++) {
        // 等这一题出来，再多等 1 秒：Boss 有「800ms 内不许换题」的防覆盖锁，太早调用会被它挡掉
        for (let k = 0; k < 60 && !window._bossQType; k++) await new Promise(r => setTimeout(r, 100));
        await new Promise(r => setTimeout(r, 1000));
        // 只让「抽题型」那一下走完形分支；其余照常随机（全部固定会让选项抽取永远抽到同一个词、死循环）
        const R = Math.random; let n = 0; Math.random = function () { return n++ === 0 ? 0.05 : R(); };
        bossPool.length = 0; bossPool.push(i);
        const bo = document.getElementById('bossOpts'); if (bo) bo.dataset.done = '1';   // 当作上一题已答完，放行出下一题
        try { nextBossQ(); } finally { Math.random = R; }
        q = { type: window._bossQType, word: window._bossWord && window._bossWord.en, prompt: (document.getElementById('bossQ') || {}).textContent || '' };
        if (q.type === 'cloze') break;
      }
      try { stopBoss(); } catch (e) {}
      showScreen('home');
      return q;
    });
    ok(r.type === 'cloze' && r.word === 'eye' && !/\beyes\b/i.test(r.prompt) && /Her\s+are bright/.test(r.prompt.replace(/ /g, ' ').replace(/\s+/g, ' ')), '⑤ Boss 完形能出「eyes」这一题，挖掉的是 eyes ' + JSON.stringify(r));
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await page.close();
  }
} finally { await ctx.close(); await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 完形填空：变形词能出题、全对 100%、大小写保留、Boss 完形同一规则');
