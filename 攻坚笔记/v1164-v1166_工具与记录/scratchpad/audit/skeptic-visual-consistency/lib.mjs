// Skeptic re-verification helpers (independent of the auditor's lib).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
export const ROOT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
export const OUT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/skeptic-visual-consistency';
fs.mkdirSync(OUT + '/shots', { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
export const served = []; // {code, path}
export async function startServer() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); res.end('1163'); served.push({ code: 200, p }); return; }
    const fp = path.join(ROOT, p);
    if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(fp, (e, d) => {
      if (e) { served.push({ code: 404, p }); res.writeHead(404); res.end(); return; }
      served.push({ code: 200, p });
      res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(d);
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, base: `http://127.0.0.1:${srv.address().port}` };
}
export async function launch() { return chromium.launch({ args: ['--disable-gpu'] }); }
export const external = [];
export async function newCtx(browser, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: opts.width || 390, height: opts.height || 844 },
    deviceScaleFactor: opts.dsf || 1, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', locale: 'zh-CN',
    userAgent: opts.ua || 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.47(0x18002f2c) NetType/WIFI Language/zh_CN'
  });
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('http://127.0.0.1') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    external.push(u.slice(0, 160));
    return route.abort();
  });
  if (opts.init) await ctx.addInitScript(opts.init.fn, opts.init.arg);
  return ctx;
}
export function attachLogs(page, tag, errs) {
  page.on('pageerror', e => errs.push(`[${tag}] PAGEERROR ${String(e.message).slice(0, 240)}`));
  page.on('console', m => { if (m.type() === 'error') errs.push(`[${tag}] CONSOLE ${m.text().slice(0, 240)}`); });
  page.on('dialog', async d => { errs.push(`[${tag}] DIALOG(${d.type()}) ${d.message().slice(0, 240)}`); try { await d.dismiss(); } catch (e) { } });
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function waitFor(fn, timeout = 8000, step = 100) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch (e) { } await sleep(step); }
  return null;
}
// Real-finger tap on an element in the main page or in a frame (frame offset is added).
// Returns {ok, hit} where hit describes document.elementFromPoint at the tap point.
export async function tapSel(page, frameOrPage, selector, opts = {}) {
  const target = frameOrPage;
  const info = await target.evaluate(async ({ selector, idx }) => {
    const els = Array.from(document.querySelectorAll(selector));
    const el = els[idx || 0];
    if (!el) return { ok: false, why: 'no element ' + selector + ' (count ' + els.length + ')' };
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hitEl = document.elementFromPoint(x, y);
    const hit = hitEl ? (hitEl.tagName + (hitEl.id ? '#' + hitEl.id : '') + (hitEl.className && typeof hitEl.className === 'string' ? '.' + hitEl.className.split(' ').join('.') : '')) : null;
    return { ok: true, x, y, w: r.width, h: r.height, hitOk: !!hitEl && (hitEl === el || el.contains(hitEl)), hit };
  }, { selector, idx: opts.idx || 0 });
  if (!info.ok) return info;
  let ox = 0, oy = 0;
  if (target !== page) {
    const fe = await target.frameElement();
    const b = await fe.boundingBox();
    ox = b.x; oy = b.y;
  }
  if (!info.hitOk && !opts.force) return { ...info, tapped: false };
  await page.touchscreen.tap(info.x + ox, info.y + oy);
  return { ...info, tapped: true };
}
export async function tapText(page, frameOrPage, selector, text, opts = {}) {
  const idx = await frameOrPage.evaluate(({ selector, text }) => {
    const els = Array.from(document.querySelectorAll(selector));
    for (let i = 0; i < els.length; i++) { const t = (els[i].innerText || els[i].textContent || ''); if (t.includes(text)) { const r = els[i].getBoundingClientRect(); if (r.width > 0 && r.height > 0) return i; } }
    return -1;
  }, { selector, text });
  if (idx < 0) return { ok: false, why: 'no visible ' + selector + ' with text ' + text };
  return tapSel(page, frameOrPage, selector, { ...opts, idx });
}
// WCAG helpers
export function lum([r, g, b]) { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
export function contrast(a, b) { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); }
export function parseRgb(s) { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(x => parseFloat(x)); return p; }
export function saveJson(name, obj) { fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 1)); }
