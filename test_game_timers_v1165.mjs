/* test_game_timers_v1165.mjs —— 小游戏「下一题」的定时器：离开或换难度以后，旧的那一局不能再动
 *
 * v1163（全部真点复现过）：
 *   · 打字大师答完一个词马上点「← 返回」：0.9 秒后又给页面加上 type-lock（主页滑不动）、typeActive 变回 true，
 *     还在主页读下一个词；点「换难度」：难度菜单 2 秒后被旧局的下一个词顶掉。
 *   · 听音辨义 / 完形填空 / 泡泡：答完第 1 题马上换难度、再点同一档 → 新一局的第 1 题几秒后被旧局的「下一题」换掉，
 *     那个词永远没被问到。
 *   · 字母拼拼乐：拼对后马上返回，1.2 秒后下一个词在主页被读出来（它连「正在玩」的标记都没有）。
 *
 * 合同：开局 / 换难度 / 停下 都换一个「局号」；延时回调只认自己那一局、而且游戏屏还在前台。
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
await ctx.addInitScript(() => {
  try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {}
  // 记下所有出声（mp3 播放 + 手机朗读），连同当时在哪个屏
  window.__sounds = [];
  const scr = () => { try { return (document.querySelector('.screen.active') || {}).id || ''; } catch (e) { return ''; } };
  const P = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { try { window.__sounds.push({ t: Date.now(), src: String(this.src || '').split('/').pop().slice(0, 40), scr: scr() }); } catch (e) {} return P.apply(this, arguments); };
  try { const S0 = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = function (u) { window.__sounds.push({ t: Date.now(), tts: u && u.text, scr: scr() }); return S0(u); }; } catch (e) {}
});

async function open(file) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof showScreen === 'function' && typeof startScramble === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} });
  return { page, errs };
}
const active = page => page.evaluate(() => (document.querySelector('.screen.active') || {}).id || '');
const tapMode = (page, fn) => page.locator(`#homeScreen .mode-card[onclick="${fn}"]`).first().tap();
async function tapLevel(page, box, fn, name) {
  await page.locator(`#${box} [onclick^="${fn}"]`, { hasText: name }).first().tap();
}
// 用屏幕键盘一个一个字母点出来（空格会自动跳过）
async function typeWordByTaps(page, word) {
  for (const ch of word.toLowerCase()) {
    if (ch === ' ') continue;
    await page.locator('#typingContent .keyboard .key', { hasText: new RegExp('^' + ch + '$') }).first().tap();
  }
}
async function homeScrolls(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(195, 500);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(400);
  return page.evaluate(() => window.scrollY || document.documentElement.scrollTop || 0);
}

try {
  // ───────────── ① 打字大师 ─────────────
  console.log('\n▶ ① 打字大师（island_food）');
  try {
    const { page, errs } = await open('island_food.html');
    // ①a 拼对一个词 → 0.2 秒内点「← 返回」
    await tapMode(page, 'showTypingMenu()');
    await page.waitForTimeout(300);
    await page.locator('#typingContent [onclick="startTyping(1)"]').first().tap();
    await page.waitForTimeout(400);
    const w1 = await page.evaluate(() => typeWord && typeWord.en);
    await typeWordByTaps(page, w1);
    await page.locator('#typingScreen .back-btn').first().tap();
    await page.evaluate(() => { window.__sounds.length = 0; });
    await page.waitForTimeout(3000);
    const a = await page.evaluate(() => ({ lock: document.body.classList.contains('type-lock'), pos: getComputedStyle(document.body).position, typeActive, scr: (document.querySelector('.screen.active') || {}).id, sounds: window.__sounds.slice() }));
    ok(a.scr === 'homeScreen' && !a.lock && a.pos !== 'fixed' && a.typeActive === false, `①a 拼对「${w1}」后马上返回：3 秒后没有被重新锁屏、typeActive 仍是 false ` + JSON.stringify({ lock: a.lock, pos: a.pos, typeActive: a.typeActive, scr: a.scr }));
    ok(a.sounds.length === 0, '①a 返回主页后 3 秒内没有读任何词 ' + JSON.stringify(a.sounds).slice(0, 200));
    const y = await homeScrolls(page);
    ok(y > 0, `①a 主页还能往下滑（scrollY=${y}）`);

    // ①b 拼对一个词 → 马上点顶部「换难度」：菜单要一直留着
    await page.evaluate(() => window.scrollTo(0, 0));
    await tapMode(page, 'showTypingMenu()');
    await page.waitForTimeout(300);
    await page.locator('#typingContent [onclick="startTyping(1)"]').first().tap();
    await page.waitForTimeout(400);
    const w2 = await page.evaluate(() => typeWord && typeWord.en);
    await typeWordByTaps(page, w2);
    await page.locator('#typingContent [onclick="showTypingMenu()"]').first().tap();
    await page.evaluate(() => { window.__sounds.length = 0; });
    await page.waitForTimeout(3000);
    const b = await page.evaluate(() => ({ menu: /我的最快记录/.test(document.getElementById('typingContent').textContent), slots: !!document.getElementById('typeSlots'), lock: document.body.classList.contains('type-lock'), typeActive, sounds: window.__sounds.slice() }));
    ok(b.menu && !b.slots && !b.lock && b.typeActive === false, `①b 拼对「${w2}」后马上换难度：3 秒后还是难度菜单、没被旧局的下一个词顶掉 ` + JSON.stringify({ menu: b.menu, slots: b.slots, lock: b.lock, typeActive: b.typeActive }));
    ok(b.sounds.length === 0, '①b 菜单上没有读旧局的下一个词 ' + JSON.stringify(b.sounds).slice(0, 200));

    // （拼错时会盖上一张「再听一遍」小课卡，整屏都点不到别处；孩子一点卡片就直接进下一题，所以没有「拼错后马上换难度」这条路）
    ok(errs.length === 0, '① 页面无报错 ' + errs.join(' | '));
    await page.close();
  } catch (e) { ok(false, '① 打字大师这一段没能走完：' + String(e.message).split('\n')[0]); }

  // ───────────── ② 听音辨义 / 完形填空 / 泡泡：换难度后新一局的第 1 题不被换掉 ─────────────
  for (const g of [
    { name: '听音辨义', start: 'startListen()', box: 'listenContent', lvl: 'startListenLevel', change: '#listenContent [onclick="startListen()"]',
      cur: () => listenQ && !listenQ.answered ? listenQ.word.en : null,
      answer: async page => { const i = await page.evaluate(() => listenQ.opts.findIndex(o => o.cn === listenQ.word.cn)); await page.locator('#listenScreen .listen-opts .boss-opt').nth(i).tap(); } },
    { name: '完形填空', start: 'startCloze()', box: 'clozeContent', lvl: 'startClozeLevel', change: '#clozeContent [onclick="startCloze()"]',
      cur: () => clozeQ && !document.querySelector('#clozeScreen .cloze-opt[data-done]') ? clozeQ.word.en : null,
      answer: async page => { const i = await page.evaluate(() => clozeQ.opts.findIndex(o => o.en === clozeQ.word.en)); await page.locator('#clozeScreen .cloze-opt').nth(i).tap(); } },
    { name: '泡泡', start: 'startBubble()', box: 'bubbleContent', lvl: 'startBubbleLevel', change: '#bubbleContent button[onclick="startBubble()"]',
      cur: () => bubbleActive && bubbleTarget && document.querySelector('#bbArea .bubble') ? bubbleTarget.en : null,
      answer: async page => {
        // 泡泡一直在飘：取它此刻的中心点，直接在那里真点一下
        const box = await page.evaluate(() => { const b = [...document.querySelectorAll('#bbArea .bubble')].find(x => x.dataset.en === bubbleTarget.en); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        await page.touchscreen.tap(box.x, box.y);
      } },
  ]) {
    console.log(`\n▶ ② ${g.name}（island_animal）：答完第 1 题 → 换难度 → 再点初级 → 9 秒不动`);
    try {
    const { page, errs } = await open('island_animal.html');
    await tapMode(page, g.start);
    await page.waitForTimeout(300);
    await tapLevel(page, g.box, g.lvl, '初级');
    await page.waitForTimeout(700);
    await g.answer(page);
    await page.waitForTimeout(350);
    await page.locator(g.change).first().tap();
    await page.waitForTimeout(250);
    await tapLevel(page, g.box, g.lvl, '初级');
    await page.waitForTimeout(500);
    const first = await page.evaluate(g.cur);
    const seen = [first];
    for (let k = 0; k < 9; k++) { await page.waitForTimeout(1000); seen.push(await page.evaluate(g.cur)); }
    ok(!!first && seen.every(x => x === first), `② ${g.name}：新一局第 1 题「${first}」9 秒内没被旧局换掉 ` + JSON.stringify(seen));
    ok(errs.length === 0, '② 页面无报错 ' + errs.join(' | '));
    await page.close();
    } catch (e) { ok(false, `② ${g.name}这一段没能走完：` + String(e.message).split('\n')[0]); }
  }

  // ───────────── ③ 字母拼拼乐 ─────────────
  console.log('\n▶ ③ 字母拼拼乐（island_school）');
  try {
    const { page, errs } = await open('island_school.html');
    const spell = async () => {
      const w = await page.evaluate(() => scrWord.en);
      for (const ch of w.replace(/ /g, '')) {
        const id = await page.evaluate(ch => { const el = [...document.querySelectorAll('#scrLetters .scramble-letter')].find(e => !e.classList.contains('used') && e.textContent === ch); return el ? el.id : null; }, ch);
        await page.locator('#' + id).tap();
      }
      return w;
    };
    // ③a 拼对 → 0.25 秒内返回 → 主页不读词
    await tapMode(page, 'startScramble()');
    await page.waitForTimeout(300);
    await tapLevel(page, 'scrambleContent', 'startScrambleLevel', '初级');
    await page.waitForTimeout(500);
    const w1 = await spell();
    await page.locator('#scrambleScreen .back-btn').first().tap();
    await page.evaluate(() => { window.__sounds.length = 0; });
    await page.waitForTimeout(2600);
    const a = await page.evaluate(() => ({ scr: (document.querySelector('.screen.active') || {}).id, sounds: window.__sounds.slice() }));
    ok(a.scr === 'homeScreen' && a.sounds.length === 0, `③a 拼对「${w1}」后马上返回：主页上 2.6 秒内没读下一个词 ` + JSON.stringify(a).slice(0, 220));
    // ③b 拼对 → 马上点顶部「换难度」→ 菜单留着
    await tapMode(page, 'startScramble()');
    await page.waitForTimeout(300);
    await tapLevel(page, 'scrambleContent', 'startScrambleLevel', '初级');
    await page.waitForTimeout(500);
    const w2 = await spell();
    await page.locator('#scrambleContent [onclick="startScramble()"]').first().tap();
    await page.evaluate(() => { window.__sounds.length = 0; });
    await page.waitForTimeout(2600);
    const b = await page.evaluate(() => ({ menu: !!document.querySelector('#scrambleContent [onclick^="startScrambleLevel"]'), letters: !!document.getElementById('scrLetters'), sounds: window.__sounds.slice() }));
    ok(b.menu && !b.letters && b.sounds.length === 0, `③b 拼对「${w2}」后马上换难度：2.6 秒后还是难度菜单、没读旧局的词 ` + JSON.stringify(b).slice(0, 220));
    ok(errs.length === 0, '③ 页面无报错 ' + errs.join(' | '));
    await page.close();
  } catch (e) { ok(false, '③ 字母拼拼乐这一段没能走完：' + String(e.message).split('\n')[0]); }
} finally { await ctx.close(); await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 小游戏定时器：离开或换难度后旧局不再锁屏、不再读词、不再顶掉新一局的题');
