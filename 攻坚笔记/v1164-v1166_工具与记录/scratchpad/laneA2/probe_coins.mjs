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
await page.goto(BASE + 'island_job.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof startListen === 'function' && window.HansenCoins, null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { try { closeAlert(); } catch (e) {} window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); };
  window.__pay = []; let last = HansenCoins.get();
  setInterval(() => { const v = HansenCoins.get(); if (v !== last) { window.__pay.push({ d: v - last, stack: (window.__lastStack || '') }); last = v; } }, 5);
  const A = HansenCoins.add, W = HansenCoins.award;
  HansenCoins.add = function (n) { window.__lastStack = 'add(' + n + ') ' + (new Error().stack || '').split('\n').slice(2, 6).map(s => s.trim().replace(/https?:\/\/[^/]+\//, '')).join(' < '); return A.apply(this, arguments); };
  HansenCoins.award = function (id, n) { window.__lastStack = 'award(' + id + ',' + n + ') ' + (new Error().stack || '').split('\n').slice(2, 5).map(s => s.trim().replace(/https?:\/\/[^/]+\//, '')).join(' < '); return W.apply(this, arguments); };
  startListen(); startListenLevel('easy'); });
for (let k = 0; k < 40; k++) {
  const st = await page.evaluate(() => ({ active: listenActive, ready: !!(listenQ && !listenQ.answered) }));
  if (!st.active) break;
  if (st.ready) await page.evaluate(() => listenAnswer(listenQ.opts.findIndex(o => o.cn === listenQ.word.cn)));
  await page.waitForTimeout(1300);
}
const pay = await page.evaluate(() => window.__pay);
const agg = {}; for (const p of pay) { const k = p.stack.slice(0, 200); agg[k] = (agg[k] || 0) + p.d; }
console.log(JSON.stringify(agg, null, 1));
await browser.close(); srv.close();
