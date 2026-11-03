/* test_combo_badge_v1165.mjs —— 连胜小条离开游戏就收起来（连胜数照留）
 *
 * v1163：连胜小条「🎯3 · 🪙满」只有答错/断连时才收起；答对几题后回主页、去抽卡、去卡册，它一直挂在屏幕上挡住标题。
 * 合同（island_animal，真点）：听音辨义连对 3 题 → 小条显示；点「← 返回」回主页 → 小条收起，连胜数还是 3；
 *       再进游戏答对 → 小条又出来、连胜 4。
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

async function answerListen(page) {
  for (let k = 0; k < 30; k++) {
    const st = await page.evaluate(() => ({ ready: !!(listenActive && listenQ && !listenQ.answered && document.querySelectorAll('#listenScreen .listen-opts .boss-opt').length === 4), lesson: !!document.getElementById('hml_lesson') }));
    if (st.lesson) { await page.locator('#hml_lesson').tap().catch(() => {}); await page.waitForTimeout(300); continue; }
    if (st.ready) break;
    await page.waitForTimeout(200);
  }
  const i = await page.evaluate(() => listenQ.opts.findIndex(o => o.cn === listenQ.word.cn));
  await page.locator('#listenScreen .listen-opts .boss-opt').nth(i).tap();
}
const badge = page => page.evaluate(() => { const b = document.getElementById('comboBadge'); return { show: !!(b && b.classList.contains('show')), n: window._comboCount, txt: b ? b.textContent.replace(/\s+/g, ' ').trim() : '' }; });
try {
  const ctx = await newCtx();
  const { page, errs } = await open(ctx, 'island_animal.html', "typeof startListen === 'function'");
  await page.evaluate(() => { window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); }; showScreen('home'); });
  await page.locator('#homeScreen .mode-card[onclick="startListen()"]').first().tap();
  await page.waitForTimeout(300);
  await page.locator('#listenContent [onclick^="startListenLevel"]', { hasText: '初级' }).first().tap();
  await page.waitForTimeout(600);
  for (let k = 0; k < 3; k++) { await answerListen(page); await page.waitForTimeout(1400); }
  const a = await badge(page);
  ok(a.show && a.n === 3, '① 连对 3 题：连胜小条显示 ' + JSON.stringify(a));
  await page.locator('#listenScreen .back-btn').first().tap();
  await page.waitForTimeout(500);
  const b = await badge(page);
  ok(!b.show && b.n === 3, '② 回主页：小条收起来，连胜数还是 3 ' + JSON.stringify(b));
  await page.evaluate(() => showScreen('cards'));
  await page.waitForTimeout(300);
  const c = await badge(page);
  ok(!c.show, '② 去卡册：小条也不出来 ' + JSON.stringify(c));
  await page.evaluate(() => showScreen('home'));
  await page.locator('#homeScreen .mode-card[onclick="startListen()"]').first().tap();
  await page.waitForTimeout(300);
  await page.locator('#listenContent [onclick^="startListenLevel"]', { hasText: '初级' }).first().tap();
  await page.waitForTimeout(600);
  await answerListen(page);
  await page.waitForTimeout(600);
  const d = await badge(page);
  ok(d.show && d.n === 4, '③ 再进游戏答对：小条又出来，连胜 4 ' + JSON.stringify(d));
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 连胜小条离开游戏就收起来');
