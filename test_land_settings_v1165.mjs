/* test_land_settings_v1165.mjs —— 单词大陆的设置页也有「🔊 发音音量」；后台等级工具能读到等级表
 *
 * v1163：单词大陆母版没有常规岛设置页里的「🔊 发音音量」滑杆，也没把等级表挂到 window 上
 *        （后台的等级调节工具在 8 个大陆岛上说「没有等级表」）。
 *
 * 合同（island_land1，真点）：
 *   ① 设置页有 #ttsVolSlider；拖到 40 → 全站发音音量变成 40（hansen_tts_volume），数字显示 40%
 *   ② window.ADVENTURE_LEVELS 是 30 级的表
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
page.on('dialog', d => d.dismiss().catch(() => {}));
try {
  for (const file of ['island_land1.html', 'island_land6.html']) {
    console.log(`\n▶ ${file}`);
    await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.readyState !== 'loading' && typeof renderSettings === 'function' && window.HansenTTSVolume, null, { timeout: 20000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { try { closeAlert(); } catch (e) {} showScreen('home'); });
    await page.locator('#homeScreen .util-card[onclick="showScreen(\'settings\')"]').first().tap();
    await page.waitForTimeout(400);
    const has = await page.locator('#settingsContent #ttsVolSlider').count();
    ok(has === 1, '① 设置页有「🔊 发音音量」滑杆');
    if (has) {
      // 真拖滑杆：按住拇指拖到 40% 的位置再松手
      await page.locator('#ttsVolSlider').scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const box = await page.locator('#ttsVolSlider').boundingBox();
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.85, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.6, y, { steps: 4 });
      await page.mouse.move(box.x + box.width * 0.4, y, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ slider: +document.getElementById('ttsVolSlider').value, stored: localStorage.getItem('hansen_tts_volume'), get: HansenTTSVolume.get(), num: (document.getElementById('ttsVolNum') || {}).textContent }));
      ok(Math.abs(r.slider - 40) <= 5 && r.get === r.slider && String(r.stored) === String(r.slider) && r.num === r.slider + '%', '① 拖到约 40：全站发音音量跟着变 ' + JSON.stringify(r));
    }
    const lv = await page.evaluate(() => ({ n: Array.isArray(window.ADVENTURE_LEVELS) ? window.ADVENTURE_LEVELS.length : -1, last: window.ADVENTURE_LEVELS && window.ADVENTURE_LEVELS[29] && window.ADVENTURE_LEVELS[29].xp }));
    ok(lv.n === 30 && lv.last === 52200, '② window.ADVENTURE_LEVELS 是 30 级的表 ' + JSON.stringify(lv));
  }
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
} finally { await ctx.close(); await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 单词大陆设置页有发音音量、等级表能读到');
