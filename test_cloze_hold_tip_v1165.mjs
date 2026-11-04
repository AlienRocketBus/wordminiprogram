/* test_cloze_hold_tip_v1165.mjs —— 完形填空：病句先不出题；要填变形时提示孩子「这个词要变个样子」
 *
 * 复查（v1165 第 1 轮）：
 *   C4 完形认变形词以后，时间岛的 minute 也能出题了 —— 可它的例句「Wait for me ten minutes.」内容校对标成病句（高）。
 *      孩子在完形 / Boss 完形里反复做这道病句，答错小课还把它读一遍。改句子要重新录音，先不拿它出题（单词卡照常显示）。
 *   C6 句子里要的是变形（Have you ever ____ on a plane? 要填 flown），选项却是原词 fly / walk / ride ——
 *      孩子看到的是「Have you ever fly」，以为没有一个选项填得进去。
 *
 * 合同：
 *   ① island_time：minute 不在任何一档完形的题里；把它放进题池也出不了完形题；Boss 完形抽到它退成别的题型
 *   ② minute 的单词卡照常显示例句（只是不拿来出完形题）
 *   ③ island_action 完形：fly（例句用 flown）的题下面有一句「这个词要变个样子」的提示；例句用原词的题没有
 *   ④ Boss 完形（island_body 的 eye，例句用 eyes）题目下面也有这句提示
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
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof startCloze === 'function' && typeof nextBossQ === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); }; });
  return { page, errs };
}
/* Boss 题：只让「抽题型」那一下走完形分支（其余照常随机），题池里只放这个词 */
const bossAsk = async (page, en) => page.evaluate(async (en) => {
  const i = allW.findIndex(w => w.en === en);
  showScreen('boss'); startBoss();
  const seen = [];
  for (let a = 0; a < 4; a++) {
    for (let k = 0; k < 60 && !window._bossQType; k++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 1000));   // Boss 有「800ms 内不许换题」的防覆盖锁
    const R = Math.random; let n = 0; Math.random = function () { return n++ === 0 ? 0.05 : R(); };
    bossPool.length = 0; bossPool.push(i);
    const bo = document.getElementById('bossOpts'); if (bo) bo.dataset.done = '1';
    try { nextBossQ(); } finally { Math.random = R; }
    seen.push({ type: window._bossQType, word: window._bossWord && window._bossWord.en, sub: (document.getElementById('bossSub') || document.querySelector('#bossScreen .boss-sub') || {}).innerHTML || '', html: (document.getElementById('bossScreen') || {}).innerHTML || '' });
  }
  try { stopBoss(); } catch (e) {}
  showScreen('home');
  return seen.map(s => ({ type: s.type, word: s.word, tip: /cloze-form-tip/.test(s.html) }));
}, en);

try {
  console.log('\n▶ ①② island_time 的 minute');
  {
    const { page, errs } = await open('island_time.html');
    const r = await page.evaluate(async () => {
      const i = allW.findIndex(w => w.en === 'minute');
      const inCard = Object.keys(CLOZE_LEVEL_IDX).filter(k => CLOZE_LEVEL_IDX[k].includes(i));
      const listed = Object.keys(CLOZE_LEVELS).filter(k => CLOZE_LEVELS[k].words.includes('minute'));
      let asked = 0;
      for (const lv of listed) { startCloze(); startClozeLevel(lv); clozePool.length = 0; clozePool.push(i); clozeActive = true; nextClozeQ(); if (clozeQ && clozeQ.word.en === 'minute') asked++; stopCloze(); }
      showScreen('explore'); showWord(i); await new Promise(r => setTimeout(r, 200));
      const card = (document.getElementById('modalInner') || {}).textContent || '';
      closeModal(); showScreen('home');
      return { i, ex: allW[i].ex, listed, inCard, asked, cardHasEx: card.includes(allW[i].ex) };
    });
    console.log('     ' + JSON.stringify(r));
    ok(r.i >= 0 && r.listed.length > 0, `minute 在时间岛、列在完形 ${r.listed.join('/')} 档（被测对象成立，例句「${r.ex}」）`);
    ok(r.inCard.length === 0, `① 完形卡片的题里没有 minute（在 ${r.inCard.join('/') || '无'}）`);
    ok(r.asked === 0, `① 把 minute 放进题池也出不了完形题（出了 ${r.asked} 次）`);
    const b = await bossAsk(page, 'minute');
    ok(b.every(q => !(q.type === 'cloze' && q.word === 'minute')), `① Boss 完形抽到 minute 退成别的题型（${b.map(q => q.type + ':' + q.word).join(', ')}）`);
    ok(r.cardHasEx, '② minute 的单词卡照常显示例句');
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await page.close();
  }

  console.log('\n▶ ③ island_action 完形：要填变形的题有提示');
  {
    const { page, errs } = await open('island_action.html');
    const r = await page.evaluate(() => {
      const ask = en => {
        const i = allW.findIndex(w => w.en === en);
        const lv = Object.keys(CLOZE_LEVEL_IDX).find(k => CLOZE_LEVEL_IDX[k].includes(i));
        if (!lv) return { en, lv: null };
        startCloze(); startClozeLevel(lv); clozePool.length = 0; clozePool.push(i); clozeActive = true; nextClozeQ();
        const tip = document.querySelector('#clozeScreen .cloze-form-tip');
        const out = { en, lv, asked: !!(clozeQ && clozeQ.word.en === en), fill: clozeQ && clozeQ.fill, tip: tip ? tip.textContent : '' };
        stopCloze(); return out;
      };
      /* 例句用原词的：找一个本岛完形里 fill 和原词一样的 */
      const plain = allW.find(w => { const i = allW.indexOf(w); return Object.keys(CLOZE_LEVEL_IDX).some(k => CLOZE_LEVEL_IDX[k].includes(i)) && window.__hsnClozeMatch(w) && window.__hsnClozeMatch(w).text.toLowerCase() === w.en.toLowerCase(); });
      const res = { fly: ask('fly'), cook: ask('cook'), plain: plain ? ask(plain.en) : null };
      showScreen('home');
      return res;
    });
    console.log('     ' + JSON.stringify(r));
    ok(r.fly.asked && r.fly.fill === 'flown' && /变个样子/.test(r.fly.tip), `③ fly（要填 ${r.fly.fill}）：选项下面有提示「${r.fly.tip}」`);
    ok(r.cook.asked && r.cook.fill === 'cooks' && /变个样子/.test(r.cook.tip), `③ cook（要填 ${r.cook.fill}）：有提示`);
    ok(r.plain && r.plain.asked && !r.plain.tip, `③ 例句用原词的（${r.plain && r.plain.en} → ${r.plain && r.plain.fill}）：没有这句提示`);
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await page.close();
  }

  console.log('\n▶ ④ Boss 完形（island_body 的 eye → eyes）');
  {
    const { page, errs } = await open('island_body.html');
    const b = await bossAsk(page, 'eye');
    const q = b.find(x => x.type === 'cloze' && x.word === 'eye');
    ok(!!q, `④ 抽到了 eye 的 Boss 完形题（${b.map(x => x.type + ':' + x.word).join(', ')}）`);
    ok(q && q.tip, '④ Boss 完形题下面有「这个词要变个样子」的提示');
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await page.close();
  }
} finally { await ctx.close(); await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 完形：病句先不出题；要填变形时有提示');
