/* test_island_welcome_v1165.mjs —— 全套欢迎弹窗只在这台设备第一次进岛时出现；以后的新岛只打个招呼
 *
 * v1163：只要这个岛还没答过题，每个新岛都弹一遍全套「欢迎来到…」大弹窗（宠物、宝箱、成就……一模一样的介绍），
 *        孩子每进一个新岛都得再点一次「开始冒险！」，像进了另一个 App。
 * 合同：
 *   ① 第一次进岛（动物）：弹全套欢迎，点「开始冒险！」关掉
 *   ② 再进一个没玩过的新岛（食物、单词大陆①）：不弹大弹窗，只出一句「欢迎来到…！这里有 N 个单词」
 *   ③ 藏在后台的预热页（?warm=1）不占用「第一次」：之后真进岛照样有全套欢迎
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

const modal = page => page.evaluate(() => { const m = document.getElementById('alertModal'); const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); return { show: !!(m && m.classList.contains('show')), btn: !!b, txt: ((document.getElementById('alertInner') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 40) }; });
const toasts = page => page.evaluate(() => [...document.querySelectorAll('#hsnToastHost > div, .hsn-island-toast')].map(e => e.textContent));
async function openRaw(ctx, file) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof showScreen === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  return { page, errs };
}
try {
  // 同一台设备上先后开几个页面：只在第一个页面清一次存档（每个新标签页的 sessionStorage 是空的，不能拿它做标记）
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.addInitScript(() => { try { if (window.top === window && !localStorage.getItem('__t_init')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); localStorage.setItem('__t_init', '1'); } } catch (e) {} });
  console.log('\n▶ ③ 先有一个藏在后台的预热页');
  const W = await openRaw(ctx, 'island_season.html?warm=1');
  const w = await modal(W.page);
  await W.page.close();
  const flag0 = await (async () => { const p = await ctx.newPage(); await p.goto(BASE + 'VERSION'); const v = await p.evaluate(() => localStorage.getItem('hansen_island_intro_seen_v1165')); await p.close(); return v; })();
  ok(flag0 !== '1', '③ 预热页没有占用「第一次进岛」 ' + JSON.stringify({ flag: flag0, modalInWarm: w.show }));

  console.log('\n▶ ① 第一次进岛：island_animal');
  const A = await openRaw(ctx, 'island_animal.html');
  const a = await modal(A.page);
  ok(a.show && a.btn && /欢迎来到动物大冒险/.test(a.txt), '① 全套欢迎弹窗 ' + JSON.stringify(a));
  if (a.btn) await A.page.locator('button', { hasText: '开始冒险' }).first().tap();
  await A.page.waitForTimeout(300);
  ok(!(await modal(A.page)).show, '① 点「开始冒险！」关掉了');
  ok(A.errs.length === 0, '① 页面无报错 ' + A.errs.join(' | '));
  await A.page.close();

  for (const [file, name] of [['island_food.html', '食物大冒险'], ['island_land1.html', '单词大陆·①迷雾心湖']]) {
    console.log(`\n▶ ② 新岛 ${file}`);
    const B = await openRaw(ctx, file);
    const b = await modal(B.page);
    const t = await toasts(B.page);
    const n = await B.page.evaluate(() => allW.length);
    ok(!b.show && !b.btn, '② 不再弹全套欢迎弹窗 ' + JSON.stringify(b));
    ok(t.some(x => x.includes('欢迎来到' + name + '！这里有 ' + n + ' 个单词')), `② 只打个招呼：「欢迎来到${name}！这里有 ${n} 个单词」 ` + JSON.stringify(t));
    ok(B.errs.length === 0, '② 页面无报错 ' + B.errs.join(' | '));
    await B.page.close();
  }
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 全套欢迎只在第一次进岛时出现');
