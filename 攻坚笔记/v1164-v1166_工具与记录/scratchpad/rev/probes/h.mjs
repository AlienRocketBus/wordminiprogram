// probe harness: static server for a repo root + chromium
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const PW = process.env.HANSEN_PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
export const ROOT = process.env.PROBE_ROOT || '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt';
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.gif': 'image/gif' };
export const reqLog = [];
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  reqLog.push(p);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
export const BASE = `http://127.0.0.1:${srv.address().port}/`;
export const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--autoplay-policy=no-user-gesture-required'] });
export async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, ...(opts.ctx || {}) });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  if (opts.init !== false) await ctx.addInitScript((seed) => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); if (seed) for (const k in seed) localStorage.setItem(k, seed[k]); sessionStorage.setItem('__s', '1'); } } catch (e) {} }, opts.seed || null);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  if (opts.console) page.on('console', m => { const t = m.text(); if (!/^\[|%c/.test(t)) console.log('   [console]', t.slice(0, 200)); });
  return { ctx, page, errs };
}
export async function openIsland(file, opts = {}) {
  const r = await newPage(opts);
  await r.page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await r.page.waitForFunction(() => window.HansenReview && document.readyState !== 'loading' && typeof startListen === 'function', null, { timeout: 30000 });
  await r.page.waitForTimeout(800);
  await r.page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click();
    window.__w = (fn, ms = 9000) => new Promise((res) => { const t0 = Date.now(); (function loop() { let v = false; try { v = fn(); } catch (e) {} if (v) return res(v); if (Date.now() - t0 > ms) return res(false); setTimeout(loop, 60); })(); });
    window.__card = () => { const el = document.getElementById('hml_lesson'); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
    window.__tapCard = () => { const el = document.getElementById('hml_lesson'); if (el) el.click(); return !!el; };
  });
  return r;
}
export async function done() { try { await browser.close(); } catch (e) {} srv.close(); }
