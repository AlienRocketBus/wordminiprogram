/* test_util_order_v1165.mjs —— 岛里工具菜单「主题商店 / 装备」的顺序固定，不看谁的脚本先跑完
 *
 * 事故（v1163 审计 VC-21）：hansen_gear.js（300ms 定时器）和 hansen_diamond_shop.js（450ms 定时器）都把自己的入口
 *   插到「第一张卡」前面 —— 谁后到谁排最前，手机一慢顺序就可能对调。
 *
 * 合同：三种时序（正常 / 装备那支晚到 / 主题商店那支先到）下，工具菜单的卡片顺序一模一样，主题商店在装备前面。
 *   （用服务器改写下发的脚本里那一个定时器的毫秒数来模拟时序，其余代码一字不改。）
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
let PATCH = null;   // {file, from, to}
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    if (PATCH && p === '/' + PATCH.file) { const s = d.toString('utf8'); if (!s.includes(PATCH.from)) throw new Error('patch anchor missing ' + PATCH.from); d = Buffer.from(s.replace(PATCH.from, PATCH.to)); }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(d);
  });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
async function order(patch) {
  PATCH = patch;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('hsnGearEntry') && document.getElementById('hsnDiaEntry'), null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const o = await page.evaluate(() => { const row = document.getElementById('hsnGearEntry').parentElement; return [...row.querySelectorAll(':scope > .util-card')].map(c => c.id || (c.textContent || '').trim().slice(0, 6)); });
  await ctx.close();
  return o;
}
try {
  const normal = await order(null);
  const gearLate = await order({ file: 'hansen_gear.js', from: 'setTimeout(injectEntry,300); }); }', to: 'setTimeout(injectEntry,1100); }); }' });
  const diaEarly = await order({ file: 'hansen_diamond_shop.js', from: "document.addEventListener('DOMContentLoaded', function(){ setTimeout(start,450); });", to: "document.addEventListener('DOMContentLoaded', function(){ setTimeout(start,20); });" });
  console.log('    正常：' + normal.join(' , '));
  console.log('    装备晚到：' + gearLate.join(' , '));
  console.log('    主题商店先到：' + diaEarly.join(' , '));
  ok(JSON.stringify(normal) === JSON.stringify(gearLate) && JSON.stringify(normal) === JSON.stringify(diaEarly), '三种时序下顺序一模一样');
  ok(normal.indexOf('hsnDiaEntry') >= 0 && normal.indexOf('hsnDiaEntry') < normal.indexOf('hsnGearEntry'), '主题商店在装备前面');
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 工具菜单顺序固定');
process.exit(fails ? 1 : 0);
