/* test_typing_freeze_v1165.mjs —— 打字大师：拼到一半离开 App（回微信 / 锁屏）30 多秒，回来这个词不算拼错
 *
 * 复查（v1165 第 2 轮 R2-TY1）：30 秒超时按墙上时钟算（Date.now() - 这个词开始的时间）。孩子拼到一半切去回微信、锁屏，
 *   页面被冻住、计时器不走；回来那一下已经过了 30 秒 → 直接记成超时拼错：进错题本、进复习计划、拼对率下降、出答错小课。
 *   孩子什么都没做错，只是离开了一下（泡泡、火眼金睛、极速是按计时器跳的，冻住时本来就不走）。
 *
 * 合同（动物岛打字大师初级，真点第一个字母后离开 32 秒）：
 *   A. 页面被冻住（微信切到后台时 JS 停住：这里让主线程整整 32 秒不跑任何计时器，墙上时钟照走）
 *   B. 页面藏起来但还在跑（安卓浏览器切到后台：document.hidden，计时器照跑）
 *   两种都要：
 *   ① 回来以后：没有记超时（typeTimeouts 0）、错题本 / 复习计划里没有这个词、没出答错小课
 *   ② 计时从离开时的地方接着走（顶上的秒数 < 5 秒），还在拼同一个词、已经打的字母还在
 *   ③ 接着把这个词拼完：照常算拼对
 *   C. 回主页停 4 秒（打字计时停了）、再进打字大师开一局：新一局的计时从 0 开始正常走（上一局最后那一下走表不能当成「冻住」）
 *   ⚠️ CDP 的 Page.setWebLifecycleState('frozen') 在无头 Chromium 里不停计时器（实测 6 秒照样每 87ms 一跳），不能拿来模拟。
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
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof showTypingMenu === 'function' && window.HansenReview, null, { timeout: 30000 });
  await sleep(1500);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); }; showScreen('home'); });
  await sleep(400);
  const card = page.locator('#homeScreen .mode-card[onclick="showTypingMenu()"]').first();
  await card.scrollIntoViewIfNeeded(); await card.tap(); await sleep(500);
  await page.locator('#typingContent [onclick^="startTyping("]').first().tap();
  await page.waitForFunction(() => typeActive && typeWord && document.getElementById('typeSlots'), null, { timeout: 10000 });
  await sleep(600);
  async function away(label, how, expectDone) {
    console.log(`\n▶ ${label}`);
    await page.waitForFunction(() => typeActive && typeWord && document.getElementById('typeSlots') && !typeInput, null, { timeout: 10000 });
    await sleep(500);
    const w = await page.evaluate(() => typeWord.en);
    await page.locator('#typingContent .keyboard .key', { hasText: new RegExp('^' + w[0].toLowerCase() + '$') }).first().tap();
    await sleep(1200);
    const before = await page.evaluate(() => ({ t: parseFloat((document.getElementById('typeTimer') || {}).textContent) || 0, input: typeInput, timeouts: typeTimeouts }));
    console.log(`    在拼「${w}」，打了「${before.input}」，计时 ${before.t}s；离开 32 秒`);
    await how();
    await sleep(1500);
    const r = await page.evaluate(() => ({ lesson: !!document.getElementById('hml_lesson'), timeouts: typeTimeouts, wrongs: Object.keys(S.wrongs || {}).length, srs: Object.keys(S.srs || {}).length,
      words: typeWrongWords.slice(), en: typeWord && typeWord.en, input: typeInput, t: parseFloat((document.getElementById('typeTimer') || {}).textContent) || 0 }));
    console.log('    回来以后：' + JSON.stringify(r));
    ok(r.timeouts === before.timeouts && r.words.length === 0 && !r.lesson, `① 没有记超时（超时 ${r.timeouts} 次、拼错的词 ${JSON.stringify(r.words)}、小课 ${r.lesson}）`);
    ok(r.wrongs === 0 && r.srs === 0, `① 错题本 ${r.wrongs} 个、复习计划 ${r.srs} 个（都应是 0）`);
    ok(r.en === w && r.input === before.input && r.t >= before.t && r.t < 5, `② 还在拼「${r.en}」、打的「${r.input}」还在，计时接着走：${before.t}s → ${r.t}s（< 5 秒）`);
    if (r.en === w) {
      for (const ch of w.toLowerCase().slice(before.input.length)) {
        if (ch === ' ') { await page.locator('#typingContent .keyboard .key.space').first().tap(); continue; }
        await page.locator('#typingContent .keyboard .key', { hasText: new RegExp('^' + ch + '$') }).first().tap(); await sleep(60);
      }
    }
    await sleep(1300);
    const done = await page.evaluate(() => ({ done: typeDone, wrongs: Object.keys(S.wrongs || {}).length }));
    ok(done.done === expectDone && done.wrongs === 0, `③ 接着拼完照常算拼对（拼对 ${done.done} 个，应为 ${expectDone}；错题本 ${done.wrongs}）`);
  }
  /* A. 主线程 32 秒一个计时器都不跑（页面被冻住），墙上时钟照走 */
  await away('A. 页面被冻住 32 秒', () => page.evaluate(() => { const end = Date.now() + 32000; while (Date.now() < end) {} }), 1);
  /* B. 页面藏起来 32 秒（document.hidden，计时器照跑）再回来 */
  await away('B. 页面藏起来 32 秒（计时器照跑）', async () => {
    await page.evaluate(() => {
      Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get() { return window.__fakeHidden === true; } });
      Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get() { return window.__fakeHidden ? 'hidden' : 'visible'; } });
      window.__fakeHidden = true; document.dispatchEvent(new Event('visibilitychange'));
    });
    await sleep(32000);
    await page.evaluate(() => { window.__fakeHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  }, 2);
  /* C. 回到难度菜单停 4 秒，再开一局 */
  console.log('\n▶ C. 回主页停 4 秒，再进打字大师开一局');
  await page.evaluate(() => showScreen('home'));   // 离开打字屏：计时器停了
  await sleep(4000);
  await page.evaluate(() => showTypingMenu());
  await sleep(400);
  await page.locator('#typingContent [onclick^="startTyping("]').first().tap();
  await page.waitForFunction(() => typeActive && typeWord && document.getElementById('typeTimer'), null, { timeout: 10000 });
  await sleep(1200);
  const c1 = await page.evaluate(() => parseFloat((document.getElementById('typeTimer') || {}).textContent));
  await sleep(1000);
  const c2 = await page.evaluate(() => parseFloat((document.getElementById('typeTimer') || {}).textContent));
  ok(c1 >= 0.5 && c1 < 3 && c2 > c1, `新一局的计时从 0 开始正常走（${c1}s → ${c2}s）`);
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 打字大师：离开 App 的时间不算进 30 秒');
