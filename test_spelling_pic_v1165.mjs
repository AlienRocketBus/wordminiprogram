/* test_spelling_pic_v1165.mjs —— 拼写 / 找英文类题目的配图不能印着答案
 *
 * 事故（v1163 实测）：身体岛打字大师「脚趾」的配图上写着 TOE，孩子照着抄就「拼对」了。
 * 岛屿数据里 34 个 SVG 图标把英文单词直接画在图上（身体岛 15 个、动作岛 9 个、学校岛 7 个……）。
 *
 * 合同（真浏览器、真游戏）：
 *   P1 拼词 / 打字 / 完形 / 火眼金睛 / 泡泡 / 钓鱼 / 看汉意拼 / 宠物掌握冲刺 的题面里，
 *      图上没有答案单词（也没有任何英文标签）；标题里也不印英文答案
 *   P2 图不是被整个删掉：去掉文字后还有图形的照样显示
 *   P3 认词的地方不变：单词卡、答对揭晓卡照样显示原图（带英文）
 *   P4 没写答案的图不删（色彩岛色块、数字牌）；不是答案的英文标签照留（1st、N/S/E/W）；写着答案一部分的照样去掉（SAME CLASS）
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

async function island(file, word) {
  console.log(`\n▶ ${file}（${word}）`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof startTyping === 'function' && window.HansenReview && document.readyState !== 'loading', null, { timeout: 20000 });
  await page.waitForTimeout(700);
  const r = await page.evaluate(async (word) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click();
    const i = allW.findIndex(w => w.en === word), W = allW[i], up = word.toUpperCase();
    const labels = sel => [...document.querySelectorAll(sel + ' svg text')].map(t => t.textContent).join(' ');
    const hasWord = sel => labels(sel).toUpperCase().includes(up);
    const shapes = sel => document.querySelectorAll(sel + ' svg circle,' + sel + ' svg rect,' + sel + ' svg path,' + sel + ' svg ellipse,' + sel + ' svg line,' + sel + ' svg polygon').length;
    const out = { idx: i, rawHas: /<text/.test(W.emoji) && W.emoji.toUpperCase().includes(up) };
    // 打字大师
    startTyping(1); typePool = [i]; typeIdx = 0; nextTypeQ(); await sleep(150);
    out.typing = { word: hasWord('#typingScreen .typing-emoji'), anyLatin: /[A-Za-z]/.test(labels('#typingScreen .typing-emoji')), shapes: shapes('#typingScreen .typing-emoji') };
    stopTyping();
    // 拼词
    startScramble(); startScrambleLevel('easy'); scrPool[scrIdx] = i; nextScramble(); await sleep(150);
    out.scramble = { word: hasWord('#scrambleScreen .scramble-emoji'), shapes: shapes('#scrambleScreen .scramble-emoji') };
    // 完形填空（只要例句里有这个词）
    startCloze(); startClozeLevel('easy'); clozePool.push(i); nextClozeQ(); await sleep(150);
    out.cloze = { word: hasWord('#clozeScreen .cloze-emoji'), asked: clozeQ && clozeQ.idx === i };
    clozeActive = false;
    // 火眼金睛
    startEagle(); startEagleLevel('easy'); await sleep(500); eaglePool.push(i); eagleNextRound(); await sleep(150);
    out.eagle = { word: hasWord('#eaglePrompt') };
    stopEagle();
    // 泡泡 / 钓鱼 的题面
    startBubble(); startBubbleLevel('easy'); bubblePool.push(i); nextBubble(); await sleep(150);
    out.bubble = { word: hasWord('#bbPrompt') }; stopBubble();
    startFish(); startFishLevel('easy'); fishPool.push(i); pickFishTarget(); await sleep(150);
    out.fish = { word: hasWord('#fishPrompt') }; stopFish();
    showScreen('home');
    // 看汉意拼（复习中心）
    S.wrongs = {}; S.wrongs[i] = 1; save();
    HansenReview._open(); await sleep(300); HansenReview._openSpellByCn(); await sleep(700);
    const sp = document.querySelector('.typing-emoji');
    out.spellCn = { found: !!sp, word: sp ? [...sp.querySelectorAll('svg text')].map(t => t.textContent).join(' ').toUpperCase().includes(up) : null };
    document.querySelectorAll('[id^="hsp"],#hr_center').forEach(e => { try { e.remove(); } catch (x) {} });
    window._huReviewContext = null; window._huFromReview = false;
    // 宠物掌握冲刺（定向打字）
    let focus = null;
    try { if (window.HansenTypingMasterV946 && HansenTypingMasterV946.openFocus(i)) { await sleep(300); const t = document.querySelector('#typingContent .htm-title'); focus = { title: t ? t.textContent : '', word: hasWord('#typingContent .typing-emoji') }; HansenTypingMasterV946.exit(); } } catch (e) { focus = { err: String(e) }; }
    out.focus = focus;
    // 认词：单词卡照旧显示原图（带英文）
    showScreen('explore'); showWord(i); await sleep(200);
    out.card = { word: hasWord('#modalInner .m-emoji') };
    closeModal();
    return out;
  }, word);
  ok(r.idx >= 0 && r.rawHas, `数据里「${word}」的图确实写着英文（被测对象成立）`);
  ok(!r.typing.word && !r.typing.anyLatin && r.typing.shapes >= 3, 'P1/P2 打字大师：图上没有答案、没有英文标签，但图还在 ' + JSON.stringify(r.typing));
  ok(!r.scramble.word && r.scramble.shapes >= 3, 'P1/P2 拼词：图上没有答案，图还在 ' + JSON.stringify(r.scramble));
  if (r.cloze.asked) ok(!r.cloze.word, 'P1 完形填空：图上没有答案');
  ok(!r.eagle.word, 'P1 火眼金睛：题面图上没有正确拼写');
  ok(!r.bubble.word, 'P1 泡泡：题面图上没有答案');
  ok(!r.fish.word, 'P1 钓鱼：题面图上没有答案');
  ok(r.spellCn.found && r.spellCn.word === false, 'P1 看汉意拼：图上没有答案 ' + JSON.stringify(r.spellCn));
  if (r.focus && !r.focus.err) ok(!r.focus.word && !new RegExp('\\b' + word + '\\b', 'i').test(r.focus.title), 'P1 宠物掌握冲刺：标题和图都不印英文答案 ' + JSON.stringify(r.focus));
  ok(r.card.word, 'P3 单词卡（认词）照旧显示原图带英文');
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
}

/* P4（v1165 复查 C1）：没写答案的图不能被删掉。色彩岛的红色圆点（2 个圆）、数字牌（1 个方块 + 数字）本来就不写英文，
   以前「去掉后少于 3 个图形就不放图」连它们也查 → 打字/拼拼乐/泡泡里整张图没了，颜色词只剩中文。
   不是答案的英文标签（1st、N/S/E/W）照留；写着答案的一部分（SAME CLASS 里的 class）照样去掉。 */
async function keep(file, cases) {
  console.log(`\n▶ P4 ${file}（${cases.map(c => c.word).join(' / ')}）`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof startTyping === 'function' && document.readyState !== 'loading', null, { timeout: 20000 });
  await page.waitForTimeout(700);
  const rs = await page.evaluate(async (cases) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); };
    const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click();
    const look = sel => { const el = document.querySelector(sel); const svg = el && el.querySelector('svg'); return { svg: !!svg, labels: svg ? [...svg.querySelectorAll('text')].map(t => t.textContent.trim()) : [] }; };
    const out = [];
    for (const c of cases) {
      const i = allW.findIndex(w => w.en === c.word);
      const r = { word: c.word, idx: i, rawLabels: i >= 0 ? (allW[i].emoji.match(/<text\b[^>]*>[\s\S]*?<\/text>/g) || []).map(t => t.replace(/<[^>]*>/g, '').trim()) : [] };
      startTyping(1); typePool = [i]; typeIdx = 0; nextTypeQ(); await sleep(120);
      r.typing = look('#typingScreen .typing-emoji'); stopTyping();
      startScramble(); startScrambleLevel('easy'); scrPool[scrIdx] = i; nextScramble(); await sleep(120);
      r.scramble = look('#scrambleScreen .scramble-emoji');
      startBubble(); startBubbleLevel('easy'); bubblePool.push(i); nextBubble(); await sleep(120);
      r.bubble = look('#bbPrompt'); stopBubble();
      showScreen('home');
      out.push(r);
    }
    return out;
  }, cases);
  for (const r of rs) {
    const c = cases.find(x => x.word === r.word);
    ok(r.idx >= 0, `「${r.word}」在这个岛上（图上原有的字：${r.rawLabels.join(' | ') || '无'}）`);
    for (const g of ['typing', 'scramble', 'bubble']) {
      const v = r[g];
      ok(v.svg, `P4 ${g}：「${r.word}」的图还在`);
      if (c.keepLabels) ok(c.keepLabels.every(l => v.labels.includes(l)), `P4 ${g}：不是答案的标签照留（应有 ${c.keepLabels.join(' ')}，实际 ${v.labels.join(' ') || '无'}）`);
      if (c.dropLabels) ok(c.dropLabels.every(l => !v.labels.includes(l)), `P4 ${g}：写着答案的标签去掉了（${c.dropLabels.join(' ')}，实际 ${v.labels.join(' ') || '无'}）`);
    }
  }
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
}

try {
  await island('island_body.html', 'toe');
  await island('island_body.html', 'knee');
  await island('island_school.html', 'eraser');
  await keep('island_color.html', [{ word: 'red' }, { word: 'seven', keepLabels: ['7'] }, { word: 'thousand' }, { word: 'first', keepLabels: ['1st'] }]);
  await keep('island_traffic.html', [{ word: 'direction', keepLabels: ['N', 'S', 'E', 'W'] }]);
  await keep('island_job.html', [{ word: 'classmate', dropLabels: ['SAME CLASS'] }]);
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 拼写/找英文题目的配图不再印着答案；认词卡片照旧');
