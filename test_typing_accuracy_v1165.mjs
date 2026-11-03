/* test_typing_accuracy_v1165.mjs —— 打字大师的「拼对率」按词算，超时也算没拼对
 *
 * v1163：「准确率」= 打对的字母数 /（打对的字母数 + 拼错的词数），字母和词混在一起算：6 个词拼对、2 个拼错显示 92%；
 *        30 秒超时跳过的词根本不记。
 * 合同（island_action 初级，真点屏幕键盘）：6 个拼对、2 个拼错、1 个超时 → 结算「拼对率 67%」。
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

async function typeWordByTaps(page, word) {
  for (const ch of word.toLowerCase()) {
    if (ch === ' ') continue;
    await page.locator('#typingContent .keyboard .key', { hasText: new RegExp('^' + ch + '$') }).first().tap();
  }
}
async function waitWord(page) {
  for (let k = 0; k < 40; k++) {
    const st = await page.evaluate(() => ({ a: typeActive, w: typeWord && typeWord.en, slots: !!document.getElementById('typeSlots'), lesson: !!document.getElementById('hml_lesson') }));
    if (st.lesson) { await page.locator('#hml_lesson').tap().catch(() => {}); await page.waitForTimeout(400); continue; }
    if (st.a && st.slots && st.w) return st.w;
    await page.waitForTimeout(150);
  }
  return null;
}
try {
  const ctx = await newCtx();
  const { page, errs } = await open(ctx, 'island_action.html', "typeof showTypingMenu === 'function'");
  await page.evaluate(() => { window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); }; showScreen('home'); });
  await page.locator('#homeScreen .mode-card[onclick="showTypingMenu()"]').first().tap();
  await page.waitForTimeout(300);
  await page.locator('#typingContent [onclick="startTyping(1)"]').first().tap();
  const plan = ['ok', 'ok', 'bad', 'ok', 'ok', 'timeout', 'ok', 'bad', 'ok'];
  for (const p of plan) {
    const w = await waitWord(page);
    if (!w) { ok(false, '没等到下一个词'); break; }
    if (p === 'ok') await typeWordByTaps(page, w);
    else if (p === 'bad') await typeWordByTaps(page, w.toLowerCase().split('').map(c => c === ' ' ? ' ' : (c === 'z' ? 'x' : 'z')).join(''));
    else await page.evaluate(() => { typeWordStart = Date.now() - 30500; updateTypeTimer(); });   // 30 秒没打完 → 超时跳过
    await page.waitForTimeout(250);
  }
  await waitWord(page);
  const r = await page.evaluate(() => { const c = { done: typeDone, errors: typeErrors }; typeComplete(); return Object.assign(c, { txt: (document.getElementById('typingContent').textContent || '').replace(/\s+/g, ' ') }); });
  const m = r.txt.match(/(拼对率|准确率)\s*(\d+)%/);
  console.log('     ' + JSON.stringify({ done: r.done, errors: r.errors, shown: m && m[0] }));
  ok(r.done === 6 && r.errors === 2, `真点：拼对 ${r.done} 个、拼错 ${r.errors} 个、超时 1 个`);
  ok(m && m[1] === '拼对率' && m[2] === '67', `结算写「拼对率 67%」（实际「${m ? m[0] : '没找到'}」）`);
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 打字大师拼对率按词算');
