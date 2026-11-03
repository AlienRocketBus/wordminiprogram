/* test_gacha_share_v1165.mjs —— 抽卡揭晓页只在真的能分享时才显示「📤 分享给好友，免费再抽 1 次」
 *
 * 事故（v1163 审计 P2-17）：hansen_gacha.js 揭晓页只看「花钱抽 + 今天还能分享」，不看有没有分享桥 wxShareForGacha；
 *   网页（H5、微信里打开的网页）里根本分享不了，孩子点了只看到「暂不可用」。
 *
 * 合同（真岛页，金币够，真的花钱抽一次）：没有 wxShareForGacha → 没有分享按钮；有（小程序桥）→ 有分享按钮。
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
async function draw(withBridge) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(b => {
    try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hansen_wallet_coins', '5000'); sessionStorage.setItem('__s', '1'); } } catch (e) {}
    if (b) window.wxShareForGacha = function () { window.__shared = (window.__shared || 0) + 1; };
  }, withBridge);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.HansenGacha && typeof window.__hsnDoDraw === 'function' && window.HansenCoins, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  const coins0 = await page.evaluate(() => HansenCoins.get());
  await page.evaluate(() => { HansenGacha.open(); window.__hsnDoDraw(); });
  const shown = await page.waitForSelector('.gacha-reveal-overlay', { timeout: 8000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({ btn: !!document.querySelector('.gr-share-btn'), coins: HansenCoins.get() }));
  await ctx.close();
  return { shown, coins0, ...r, errs };
}
try {
  console.log('\n▶ 网页里（没有分享桥）');
  let r = await draw(false);
  ok(r.shown && r.coins < r.coins0, `真的花钱抽了一次（${r.coins0}→${r.coins}），揭晓页出来了`);
  ok(!r.btn, '没有「分享给好友，免费再抽 1 次」按钮');
  ok(r.errs.length === 0, '零脚本错误' + (r.errs.length ? '：' + r.errs[0] : ''));
  console.log('\n▶ 小程序里（有分享桥）');
  r = await draw(true);
  ok(r.shown, '揭晓页出来了');
  ok(r.btn, '有分享按钮');
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 能分享才显示分享按钮');
process.exit(fails ? 1 : 0);
