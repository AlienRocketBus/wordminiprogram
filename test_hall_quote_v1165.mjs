/* test_hall_quote_v1165.mjs —— 单词大陆 Boss 殿堂卡片下面写台词，不再写「undefined」
 *
 * 事故（v1163 审计 P2-08）：boss_hall.html?land=1 把 HansenLandCards 的卡映射成殿堂条目时没带台词 d，
 *   卡片下面的引号里写着「undefined」。
 *
 * 合同：boss_hall.html?land=1&card=L12&lown=L11,L12,L13 显示 L12 的台词；切到 L11、L13 也是各自的台词；整页没有 undefined。
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
const src = fs.readFileSync(path.join(ROOT, 'hansen_land_cards.js'), 'utf8');
const desc = id => (src.match(new RegExp(`id:'${id}'[^}]*desc:'([^']*)'`)) || [])[1];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await page.goto(BASE + 'boss_hall.html?land=1&card=L12&lown=L11,L12,L13', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('pname') && document.getElementById('pname').textContent, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => ({ name: document.getElementById('pname').textContent, flavor: document.getElementById('flavor').textContent, body: document.body.innerText }));
  ok(/万形之胚/.test(r.name), `打开的是 L12（${r.name}）`);
  ok(r.flavor.includes(desc('L12')), `卡片下面是 L12 的台词（${r.flavor}）`);
  ok(!/undefined/.test(r.body), '整页没有 undefined');
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 单词大陆 Boss 殿堂卡片写的是台词');
process.exit(fails ? 1 : 0);
