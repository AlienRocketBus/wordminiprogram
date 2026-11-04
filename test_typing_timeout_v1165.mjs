/* test_typing_timeout_v1165.mjs —— 打字大师：30 秒没拼出来 = 没拼对（记错、出小课、本轮末再考、结算列出来）；题号分母不跟着再考题涨
 *
 * 复查（v1165 第 1 轮）：
 *   G4 typeTimeout 只把「超时」记进拼对率，就悄悄跳到下一个词：不进错题本、不出答错小课、本轮末不再考、
 *      结算「这次答错的词」里也没有它（泡泡、火眼金睛的超时都会）。
 *   G7 本轮末再考的题是 push 进题池的，题头直接写 typePool.length：17 个词的档出现「18 / 18」「19 / 19」。
 *
 * 合同（island_animal 打字大师初级，真点屏幕键盘；「等 30 秒」用把这道题的开始时间往前拨 30.5 秒代替）：
 *   ① 第 1 个词超时：马上出答错小课卡（写着这个词），错题本里这个词 +1
 *   ② 第 2 个词故意拼错（再考题里也有它）；其余词全部真点拼对
 *   ③ 本轮末再考：超时的词和拼错的词都再考一次；整轮题头的分母一直是本档词数，分子不超过分母
 *   ④ 结算：「这次答错的词」列出超时的词和拼错的词；拼对率 = 拼对 /（拼对 + 拼错 + 超时）
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

async function typeWordByTaps(page, word) {
  for (const ch of word.toLowerCase()) {
    if (ch === ' ') continue;
    await page.locator('#typingContent .keyboard .key', { hasText: new RegExp('^' + ch + '$') }).first().tap();
  }
}
/* 等到下一道题能打字；途中出现答错小课就记下卡上写的词再点掉 */
async function waitWord(page, cards) {
  for (let k = 0; k < 80; k++) {
    const st = await page.evaluate(() => {
      const L = document.getElementById('hml_lesson'), head = (document.querySelector('#typingContent [style*="margin-left:auto"]') || {}).textContent || '';
      return { a: typeActive, w: typeWord && typeWord.en, slots: !!document.getElementById('typeSlots'), lesson: L ? (L.querySelector('.lr-en') || {}).textContent : null, head, done: !document.getElementById('typeSlots') && /拼对率/.test(document.getElementById('typingContent').textContent || '') };
    });
    if (st.done) return { done: true };
    if (st.lesson) { cards.push(st.lesson); await page.locator('#hml_lesson').tap().catch(() => {}); await page.waitForTimeout(400); continue; }
    if (st.a && st.slots && st.w) return st;
    await page.waitForTimeout(150);
  }
  return null;
}

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.addInitScript(() => { try { if (window.top === window && !sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof showTypingMenu === 'function' && !!window.HansenMistakeLesson, null, { timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); }; showScreen('home'); });
  await page.locator('#homeScreen .mode-card[onclick="showTypingMenu()"]').first().tap();
  await page.waitForTimeout(300);
  await page.locator('#typingContent [onclick="startTyping(1)"]').first().tap();

  const cards = [], heads = [], asked = [];
  let total = 0, timedOut = '', badWord = '', wrongBefore = 0, wrongAfter = 0, cardAfterTimeout = '';
  for (let n = 0; n < 60; n++) {
    const st = await waitWord(page, cards);
    if (!st) { ok(false, '没等到下一道题'); break; }
    if (st.done) break;
    if (!total) total = await page.evaluate(() => typePool.length);
    heads.push(st.head.trim()); asked.push(st.w);
    if (n === 0) {
      timedOut = st.w;
      wrongBefore = await page.evaluate(en => { const i = allW.findIndex(w => w.en === en); return (S.wrongs && S.wrongs[i]) | 0; }, st.w);
      await page.evaluate(() => { typeWordStart = Date.now() - 30500; updateTypeTimer(); });   // 30 秒没打完
      await page.waitForTimeout(600);
      cardAfterTimeout = await page.evaluate(() => { const L = document.getElementById('hml_lesson'); return L ? (L.querySelector('.lr-en') || {}).textContent : ''; });
      wrongAfter = await page.evaluate(en => { const i = allW.findIndex(w => w.en === en); return (S.wrongs && S.wrongs[i]) | 0; }, st.w);
    } else if (n === 1) {
      badWord = st.w;
      await typeWordByTaps(page, st.w.toLowerCase().split('').map(c => c === ' ' ? ' ' : (c === 'z' ? 'x' : 'z')).join(''));
    } else {
      await typeWordByTaps(page, st.w);
    }
    await page.waitForTimeout(250);
  }
  const res = await page.evaluate(() => {
    const box = document.querySelector('#typingContent .hml-result');
    return { txt: (document.getElementById('typingContent').textContent || '').replace(/\s+/g, ' '), missed: box ? [...box.querySelectorAll('.hml-r-word')].map(b => (b.textContent || '').replace('🔊', '').trim().split(' ')[0]) : [] };
  });
  console.log('     ' + JSON.stringify({ total, timedOut, badWord, wrongBefore, wrongAfter, cards, asked: asked.length, lastHeads: heads.slice(-3), missed: res.missed }));

  console.log('\n▶ ① 超时那一刻');
  ok(cardAfterTimeout === timedOut, `超时后马上出答错小课，卡上写「${timedOut}」（实际「${cardAfterTimeout}」）`);
  ok(wrongAfter === wrongBefore + 1, `超时的词进了错题本（错题数 ${wrongBefore} → ${wrongAfter}）`);
  console.log('\n▶ ③ 本轮末再考 / 题号');
  const tail = asked.slice(total);
  ok(tail.includes(timedOut) && tail.includes(badWord), `本轮末再考了超时的词和拼错的词（再考：${tail.join(', ') || '无'}）`);
  const parsed = heads.map(h => (h.match(/(\d+)\s*\/\s*(\d+)/) || []).slice(1).map(Number));
  ok(parsed.length >= total && parsed.every(([a, b]) => b === total && a <= b), `整轮题头分母一直是本档 ${total} 个词、分子不超过分母（最后几题：${heads.slice(-3).join(' | ')}）`);
  console.log('\n▶ ④ 结算');
  ok(res.missed.includes(timedOut) && res.missed.includes(badWord), `「这次答错的词」列出超时的「${timedOut}」和拼错的「${badWord}」（实际：${res.missed.join(', ') || '没有这一块'}）`);
  const m = res.txt.match(/拼对率\s*(\d+)%/);
  const want = Math.round((total - 2) / total * 100);
  ok(m && +m[1] === want, `拼对率 ${want}%（${total - 2} 个拼对 / ${total} 个词；实际「${m ? m[0] : '没找到'}」）`);
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 打字大师超时算没拼对、会再考会列出来；题号分母不涨');
