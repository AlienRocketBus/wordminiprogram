/* test_island_toast_v1165.mjs —— 岛里的提示条居中、不被截断、留够时间读完
 *
 * v1163：showToast 借飘字显示：左边缘从屏幕正中开始、不换行，长句的后半截跑到屏幕外；1.2 秒就消失。
 *        例如签到账本没加载时的提醒「⚠️ 签到账本尚未加载，本次未扣/发任何奖励，请稍后重试」在手机上只能看到前半句。
 * 合同（390 和 360 宽）：这句提醒整句都在屏幕里、左右居中（误差 2px 内）、2.4 秒时还看得见；「+N」飘字照旧。
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

const MSG = '⚠️ 签到账本尚未加载，本次未扣/发任何奖励，请稍后重试';
try {
  for (const vw of [390, 360]) {
    console.log('\n▶ 宽 ' + vw);
    const ctx = await newCtx({ width: vw, height: 780 });
    const { page, errs } = await open(ctx, 'island_animal.html', "typeof showToast === 'function'");
    await page.waitForTimeout(800);
    const t0 = Date.now();
    await page.evaluate(m => showToast(m), MSG);
    const find = () => page.evaluate(m => {
      const els = [...document.querySelectorAll('body *')].filter(e => (e.textContent || '').trim() === m && e.children.length === 0);
      const e = els[els.length - 1]; if (!e) return null;
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, op: +cs.opacity, vis: cs.visibility !== 'hidden' && cs.display !== 'none', vw: innerWidth, vh: innerHeight };
    }, MSG);
    await page.waitForTimeout(450);
    const a = await find();
    ok(!!a && a.l >= 0 && a.r <= a.vw && a.t >= 0 && a.b <= a.vh, '整句都在屏幕里 ' + JSON.stringify(a));
    ok(!!a && Math.abs((a.l + a.r) / 2 - a.vw / 2) <= 2, `左右居中（中心 ${a && ((a.l + a.r) / 2).toFixed(1)}，屏幕中线 ${vw / 2}）`);
    await page.waitForTimeout(Math.max(0, 2400 - (Date.now() - t0)));
    const b = await find();
    ok(!!b && b.vis && b.op > 0.5, '2.4 秒时还看得见 ' + JSON.stringify(b && { op: b.op, vis: b.vis }));
    // 页内提示模块还没加载时（刚开岛的头一两秒）：自己画的提示框也一样居中、整句可见、留够时间
    const MSG2 = '⚠️ 奖励暂未安全入账，成就仍保留待领取，请稍后重试';
    const fb = await page.evaluate(async m => {
      const H = window.HansenToast; window.HansenToast = null;
      try { showToast(m); } finally { window.HansenToast = H; }
      const pick = () => { const e = [...document.querySelectorAll('body *')].filter(x => (x.textContent || '').trim() === m && x.children.length === 0).pop(); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, c: (r.left + r.right) / 2, vw: innerWidth }; };
      const a = pick(); await new Promise(r => setTimeout(r, 2400)); const b = pick();
      return { a, b };
    }, MSG2);
    ok(!!fb.a && fb.a.l >= 0 && fb.a.r <= fb.a.vw && Math.abs(fb.a.c - fb.a.vw / 2) <= 2 && !!fb.b, '模块没加载时的提示框：居中、整句可见、2.4 秒还在 ' + JSON.stringify(fb.a));
    // 「+N」飘字照旧（floatText 不变）
    const f = await page.evaluate(() => { floatText(100, 300, '+5', '#fbbf24'); const e = [...document.querySelectorAll('.float-text')].pop(); return e ? { cls: e.className, txt: e.textContent } : null; });
    ok(!!f && f.txt === '+5', '「+5」飘字照旧 ' + JSON.stringify(f));
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 岛里的提示条居中、整句可见、留够时间');
