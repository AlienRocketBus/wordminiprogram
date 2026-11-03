/* test_bee_tip_v1165.mjs —— 拼写蜂设置页「单词难度」旁写的是本岛词库
 *
 * 事故（v1163 审计 MG-07 / P2-06）：spelling_bee.html 设置页的小字写死「动物大冒险词库」，在哪个岛打开都这么写。
 *
 * 合同：从食物岛打开写「食物岛词库」；从单词大陆③号岛打开写「时之钟谷岛词库」；单独打开写「全部词库」。
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
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
const tipOf = f => f.evaluate(() => { const s = [...document.querySelectorAll('.sec-t')].find(x => /单词难度/.test(x.textContent)); const t = s && s.querySelector('.tip'); return t ? t.textContent : null; });
try {
  for (const [file, key, want] of [['island_food.html', 'food', '食物岛词库'], ['island_land3.html', 'land3', '时之钟谷岛词库']]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
    const page = await ctx.newPage();
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(BASE + file, { waitUntil: 'load' });
    await page.waitForFunction(() => window.HansenSpellBee, null, { timeout: 30000 });
    await sleep(800);
    await page.evaluate(k => HansenSpellBee.open(k), key);
    let bee = null;
    for (let i = 0; i < 60 && !bee; i++) { bee = page.frames().find(f => /spelling_bee\.html/.test(f.url())); if (!bee) await sleep(200); }
    await bee.waitForFunction(() => document.readyState === 'complete', null, { timeout: 20000 });
    await sleep(500);
    const tip = await tipOf(bee);
    ok(tip === want, `${file} 打开：「${tip}」`);
    await ctx.close();
  }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  const page = await ctx.newPage();
  await page.goto(BASE + 'spelling_bee.html', { waitUntil: 'load' });
  await sleep(500);
  const tip = await tipOf(page.mainFrame());
  ok(tip === '全部词库', `单独打开：「${tip}」`);
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 拼写蜂设置页写的是本岛词库');
process.exit(fails ? 1 : 0);
