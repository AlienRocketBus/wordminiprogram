/* test_quiz_pic_raster_v1165.mjs —— 拼写类题目里不放「自己印着答案」的位图（酸奶杯上写着 YOGURT）
 *
 * v1163：__hsnQuizPic 只会去掉 SVG 图里的英文字；食物岛酸奶的配图是一张位图，杯子上印着「YOGURT」，
 *        打字大师 / 字母拼拼乐出 yogurt 这题时等于直接告诉答案。
 * 合同（island_food）：打字大师、字母拼拼乐出 yogurt 时页面里没有 yogurt 那张图；探索单词的卡片照样有图。
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

try {
  const ctx = await newCtx();
  const { page, errs } = await open(ctx, 'island_food.html', "typeof startScramble === 'function'");
  const r = await page.evaluate(() => {
    window.speak = function () {};
    const i = allW.findIndex(w => w.en === 'yogurt');
    const out = { i, hasPic: /yogurt\.webp/.test(allW[i].emoji) };
    // 打字大师：这一题是 yogurt
    const k = [1, 2, 3].find(k => TYPING_LEVELS[k].filter(i)) || 1;
    startTyping(k); typePool = [i]; typeIdx = 0; typeActive = true; nextTypeQ();
    out.typing = { word: typeWord && typeWord.en, img: !!document.querySelector('#typingContent img[src*="yogurt"]') };
    stopTyping(); showScreen('home');
    // 字母拼拼乐：这一题是 yogurt
    const lv = ['easy', 'medium', 'hard'].find(k => SCRAMBLE_LEVELS[k].filter(i)) || 'medium';
    startScramble(); startScrambleLevel(lv); scrPool = [i]; scrIdx = 0; nextScramble();
    out.scramble = { word: scrWord && scrWord.en, img: !!document.querySelector('#scrambleContent img[src*="yogurt"]') };
    showScreen('home');
    // 探索单词：卡片照样有图
    showScreen('explore');
    out.explore = !!document.querySelector('#exploreScreen img[src*="yogurt"]');
    showScreen('home');
    return out;
  });
  ok(r.i >= 0 && r.hasPic, '食物岛有 yogurt，配图是 yogurt.webp');
  ok(r.typing.word === 'yogurt' && !r.typing.img, '打字大师出 yogurt：不放印着 YOGURT 的图 ' + JSON.stringify(r.typing));
  ok(r.scramble.word === 'yogurt' && !r.scramble.img, '字母拼拼乐出 yogurt：不放那张图 ' + JSON.stringify(r.scramble));
  ok(r.explore, '探索单词的卡片照样有图');
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 拼写类题目不放印着答案的位图');
