import { chromium } from '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/VERSION') { res.writeHead(200); return res.end('1163'); } const fp = path.join(ROOT, path.normalize(p)); fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(d); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
const page = await ctx.newPage();
await page.goto(BASE + 'island_land3.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__hsnZoneFight === 'function', null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { try { closeAlert(); } catch (e) {} showScreen('boss'); });
await page.waitForTimeout(500);
await page.evaluate(() => window.__hsnZoneFight(4));
await page.waitForTimeout(1500);
await page.evaluate(() => { bossHP = 0; bossVictory(); });
await page.waitForTimeout(1500);
const r = await page.evaluate(() => {
  const out = [];
  for (const [x, y] of [[195, 400], [100, 600], [300, 200]]) {
    let e = document.elementFromPoint(x, y); const chain = [];
    while (e && chain.length < 6) { chain.push((e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : '') + '<' + e.tagName + ' z=' + getComputedStyle(e).zIndex + ' pos=' + getComputedStyle(e).position + '>'); e = e.parentElement; }
    out.push(chain.join(' < '));
  }
  const fixed = [...document.body.children].filter(c => getComputedStyle(c).position === 'fixed' && c.offsetWidth > 300 && getComputedStyle(c).display !== 'none' && getComputedStyle(c).visibility !== 'hidden').map(c => (c.id || c.className || c.tagName) + ' z=' + getComputedStyle(c).zIndex + ' txt=' + (c.textContent || '').trim().slice(0, 60));
  return { out, fixed, scr: (document.querySelector('.screen.active') || {}).id };
});
console.log(JSON.stringify(r, null, 1));
await browser.close(); srv.close();
