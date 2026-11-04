/* test_freepass_stable_v1165.mjs —— 72 小时体验期里卡册全开标记不再被旧迁移代码反复删掉
 *
 * 事故（v1163 审计 MISSED#10）：hansen_boss_progress.js 的 v330 一次性迁移（每个岛第一次打开都会跑）会删
 *   hansen_card_temp_unlock_until —— 它现在是体验期（hansen_freepass.js）的「卡册全开」标记；删了体验期再写回来，
 *   卡册/神秘殿堂的数字来回跳。
 *
 * 合同：体验期内依次打开 3 个从没去过的岛（各自第一次跑 v330 迁移）：这个键一次都没被删，值始终等于体验期到期时间。
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
try {
  const until = Date.now() + 2 * 86400000;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(until => {
    try { if (!localStorage.getItem('__seeded')) { localStorage.clear(); localStorage.setItem('__seeded', '1'); localStorage.setItem('hansen_onboarded', '1');
      localStorage.setItem('hansen_freepass_until', String(until)); localStorage.setItem('hansen_freepass_ver', '72'); localStorage.setItem('hansen_card_temp_unlock_until', String(until)); } } catch (e) {}
    /* 谁删了这个键都记下来（存在 localStorage，换页也不丢） */
    try { const rm = Storage.prototype.removeItem; Storage.prototype.removeItem = function (k) { if (k === 'hansen_card_temp_unlock_until') { try { localStorage.setItem('__rm_log', (localStorage.getItem('__rm_log') || '') + location.pathname + ';'); } catch (e) {} } return rm.apply(this, arguments); }; } catch (e) {}
  }, until);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  for (const f of ['island_animal.html', 'island_food.html', 'island_sports.html']) {
    await page.goto(BASE + f, { waitUntil: 'load' });
    await page.waitForFunction(() => window.S && window.S.__PER_ISLAND_RESET_V330 === true, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({ v: localStorage.getItem('hansen_card_temp_unlock_until'), log: localStorage.getItem('__rm_log') || '' }));
    ok(r.v === String(until) && !r.log, `${f}（第一次打开，跑过 v330 迁移）：卡册全开标记还在、没被删过（删过：${r.log || '无'}）`);
  }
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 体验期卡册全开标记稳定');
process.exit(fails ? 1 : 0);
