/* test_snapshot_cleanup_v1165.mjs —— 每日进度快照只删 30 天以前的，不再把今天的删掉
 *
 * 事故（v1163 审计 CB-10）：hansen_addiction.js 的快照键日期不补零（hansen_snapshot_2026-9-1），清理时却按字符串比大小、
 *   还只取最后 10 个字符 —— 10~12 月里「2026-10-25」<「2026-9-25」，今天的快照被当成过期删掉；真过期的 2026-9-1 反而留着。
 *
 * 合同（手机时间 2026-10-25，真岛页）：今天 和 2026-10-18 的快照留着；2025-1-5、2026-9-1 删掉。
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Shanghai' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => {
    try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1');
      for (const d of ['2026-10-25', '2026-10-18', '2025-1-5', '2026-9-1']) localStorage.setItem('hansen_snapshot_' + d, JSON.stringify({ date: d, power: 1 }));
      sessionStorage.setItem('__s', '1'); } } catch (e) {}
  });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-10-25T10:00:00+08:00') });
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_food.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.S && window.HansenCanonical, null, { timeout: 30000 });
  await page.clock.runFor(3000);
  const keys = await page.evaluate(() => { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^hansen_snapshot_/.test(k)) o.push(k.replace('hansen_snapshot_', '')); } return o.sort(); });
  console.log('    剩下的快照：' + keys.join(', '));
  ok(keys.includes('2026-10-25'), '今天（2026-10-25）的快照还在');
  ok(keys.includes('2026-10-18'), '7 天前（2026-10-18）的快照还在');
  ok(!keys.includes('2025-1-5'), '去年（2025-1-5）的删掉了');
  ok(!keys.includes('2026-9-1'), '54 天前（2026-9-1）的删掉了');
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 每日快照只删 30 天以前的');
process.exit(fails ? 1 : 0);
