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
page.on('pageerror', e => console.log('PAGEERR', e.message));
page.on('console', m => { if (/BUG|HBU|boss/i.test(m.text())) console.log('CONSOLE', m.text().slice(0, 200)); });
page.on('dialog', d => d.dismiss().catch(() => {}));
await page.goto(BASE + 'island_body.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof startCloze === 'function', null, { timeout: 20000 });
await page.waitForTimeout(800);
await page.evaluate(() => { try { closeAlert(); } catch (e) {} });

const step = async (name, fn, arg) => { const t = Date.now(); const r = await Promise.race([page.evaluate(fn, arg).then(x => 'ok ' + JSON.stringify(x)).catch(e => 'ERR ' + e.message), new Promise(r => setTimeout(() => r('TIMEOUT'), 8000))]); console.log(name, Date.now() - t, 'ms', String(r).slice(0, 300)); };
await step('show', () => { showScreen('boss'); return 1; });
await step('start', () => { startBoss(); return bossActive; });
for (let k = 0; k < 5; k++) { await page.waitForTimeout(500); await step('poll' + k, () => ({ q: window._bossQType, w: window._bossWord && window._bossWord.en, act: bossActive })); }
await step('timer', () => new Promise(r => setTimeout(() => r('fired'), 100)));
await step('raf', () => new Promise(r => requestAnimationFrame(() => r('raf'))));
await browser.close(); srv.close();
