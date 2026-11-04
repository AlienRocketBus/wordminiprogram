/* test_scramble_shuffle_v1165.mjs —— 字母拼拼乐的字母不会一出来就是正确顺序
 *
 * v1163：用 sort(()=>Math.random()-.5) 打乱字母，不均匀、也不检查，短词常常一出来就拼好了（3 个字母的词约 15%）。
 * 合同：island_question 初级抽 500 次，有两个以上不同字母的词，一次都不会一出来就是答案；字母还是那几个。
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
  const { page, errs } = await open(ctx, 'island_question.html', "typeof startScramble === 'function'");
  const r = await page.evaluate(() => {
    window.speak = function () {};                  // 只看字母怎么摆，不用出声
    startScramble(); startScrambleLevel('easy');
    let solved = 0, checked = 0, wrongSet = 0; const ex = [];
    for (let n = 0; n < 500; n++) {
      scrIdx = Math.floor(Math.random() * scrPool.length);
      nextScramble();
      const tiles = [...document.querySelectorAll('#scrLetters .scramble-letter')].map(e => e.textContent).join('');
      const ans = scrWord.en.replace(/ /g, '');
      if (tiles.split('').sort().join('') !== ans.split('').sort().join('')) wrongSet++;
      if (new Set(ans.split('')).size < 2) continue;
      checked++;
      if (tiles === ans) { solved++; if (ex.length < 6) ex.push(ans); }
    }
    showScreen('home');
    return { solved, checked, wrongSet, ex, pool: scrPool.length };
  });
  ok(r.checked > 400, `抽了 ${r.checked} 次（本档 ${r.pool} 个词）`);
  ok(r.solved === 0, `一出来就是答案的：${r.solved} 次 ${r.ex.join(',')}`);
  ok(r.wrongSet === 0, `字母还是这个词自己的字母（不对的：${r.wrongSet} 次）`);
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 字母拼拼乐：字母一定是打乱的');
