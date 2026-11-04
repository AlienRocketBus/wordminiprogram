/* test_hall_counts_v1165.mjs —— 神秘殿堂入口和殿堂里写的「已收藏 X/Y」是同一个数
 *
 * 事故（v1163 审计 P2-11 / MISSED#17）：卡册页底部「神秘殿堂」入口数的是赛季个数（已收藏 0/1），点进去殿堂里数的是
 *   限定卡 + 守关 Boss 卡（已收藏 0/6）——同一样东西两个数。
 *
 * 合同（真岛页）：新孩子、72 小时体验期孩子：卡册入口的 X/Y == 殿堂里的 X/Y；体验期是全满。
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
async function counts(trial) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(trial => {
    try { if (!localStorage.getItem('__seeded')) { localStorage.clear(); localStorage.setItem('__seeded', '1'); localStorage.setItem('hansen_onboarded', '1');
      const until = Date.now() + 2 * 86400000;
      if (trial) { localStorage.setItem('hansen_freepass_until', String(until)); localStorage.setItem('hansen_freepass_ver', '72'); localStorage.setItem('hansen_card_temp_unlock_until', String(until)); }
      else { localStorage.setItem('hansen_freepass_until', String(Date.now() - 86400000)); localStorage.setItem('hansen_freepass_ver', '72'); } } } catch (e) {}
  }, trial);
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.HansenSeason && typeof window.__hsnOpenHall === 'function' && typeof showScreen === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(async () => {
    showScreen('cards'); await new Promise(r => setTimeout(r, 600));
    const entry = [...document.querySelectorAll('#cardsScreen [onclick*="__hsnOpenHall"]')].map(e => e.textContent).join(' ');
    const m1 = entry.match(/已收藏\s*(\d+)\s*\/\s*(\d+)/);
    window.__hsnOpenHall(); await new Promise(r => setTimeout(r, 300));
    const panel = (document.getElementById('__hs_hall_panel') || {}).textContent || '';
    const m2 = panel.match(/已收藏\s*(\d+)\s*\/\s*(\d+)/);
    return { entry: m1 ? m1[1] + '/' + m1[2] : null, panel: m2 ? m2[1] + '/' + m2[2] : null };
  });
  await ctx.close();
  return r;
}
try {
  let r = await counts(false);
  ok(r.entry && r.entry === r.panel, `新孩子：卡册入口「${r.entry}」== 殿堂里「${r.panel}」`);
  r = await counts(true);
  ok(r.entry && r.entry === r.panel, `体验期：卡册入口「${r.entry}」== 殿堂里「${r.panel}」`);
  ok(r.entry && r.entry.split('/')[0] === r.entry.split('/')[1], `体验期是全满（${r.entry}）`);
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 神秘殿堂入口和殿堂里同一个数');
process.exit(fails ? 1 : 0);
