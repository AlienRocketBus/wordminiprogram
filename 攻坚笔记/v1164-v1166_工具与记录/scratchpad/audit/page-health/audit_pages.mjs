// Page-health audit: load every .html at 390 and 360, collect errors/requests/overflow/timing/sizes.
// usage: node audit_pages.mjs out.jsonl [page1 page2 ...]  (default: all .html in snapshot)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, ROOT } from './server.mjs';

const OUT = process.argv[2] || 'results.jsonl';
const SHOTS = path.join(path.dirname(new URL(import.meta.url).pathname), 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
function listHtml(dir, rel = '') {
  let out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(listHtml(dir, r));
    else if (e.name.endsWith('.html')) out.push(r);
  }
  return out;
}
const pages = process.argv.length > 3 ? process.argv.slice(3) : listHtml(ROOT).sort();
const WIDTHS = (process.env.WIDTHS || '390,360').split(',').map(Number);
const SETTLE = +(process.env.SETTLE || 3500);
const SETTLE_ISLAND = +(process.env.SETTLE_ISLAND || SETTLE);

const { srv, port } = await startServer();
const ORIGIN = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
fs.writeFileSync(OUT, '');

for (const pg of pages) {
  for (const W of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block', userAgent: UA, locale: 'zh-CN' });
    const ext = [];
    await ctx.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith(ORIGIN) || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
      ext.push(u.slice(0, 200)); return r.abort('internetdisconnected');
    });
    await ctx.addInitScript(() => {
      window.__ph = { rej: [], resErr: [], winErr: [] };
      addEventListener('unhandledrejection', e => { try { const r = e.reason; window.__ph.rej.push(String((r && (r.stack || r.message)) || r).slice(0, 400)); } catch (_) {} });
      addEventListener('error', e => {
        try {
          if (e.target && e.target !== window && e.target.tagName) window.__ph.resErr.push(e.target.tagName + ' ' + (e.target.src || e.target.href || e.target.currentSrc || ''));
          else window.__ph.winErr.push(String(e.message).slice(0, 300));
        } catch (_) {}
      }, true);
    });
    const page = await ctx.newPage();
    const rec = { page: pg, width: W, console: [], warnings: 0, pageerrors: [], failed: [], bad: [], dialogs: [], reqs: 0, bytes: 0, byType: {}, big: [], ext };
    const sizes = [];
    page.on('console', m => { if (m.type() === 'error') rec.console.push(m.text().slice(0, 400)); else if (m.type() === 'warning') rec.warnings++; });
    page.on('pageerror', e => rec.pageerrors.push(String(e.stack || e).slice(0, 500)));
    page.on('dialog', d => { rec.dialogs.push(d.type() + ': ' + d.message().slice(0, 200)); d.dismiss().catch(() => {}); });
    page.on('requestfailed', r => { const u = r.url(); if (u.startsWith(ORIGIN)) rec.failed.push((r.failure() && r.failure().errorText) + ' ' + u.replace(ORIGIN, '')); });
    page.on('response', r => { if (r.status() >= 400) rec.bad.push(r.status() + ' ' + r.url().replace(ORIGIN, '')); });
    rec.n304 = 0; rec.urlCount = {};
    page.on('requestfinished', r => {
      sizes.push(Promise.all([r.sizes(), r.response()]).then(([s, resp]) => {
        const u = r.url(); if (!u.startsWith(ORIGIN)) return;
        const k = u.replace(ORIGIN, ''); rec.urlCount[k] = (rec.urlCount[k] || 0) + 1;
        if (resp && resp.status() === 304) rec.n304++;
        rec.reqs++; rec.bytes += s.responseBodySize;
        const t = r.resourceType(); rec.byType[t] = rec.byType[t] || [0, 0]; rec.byType[t][0]++; rec.byType[t][1] += s.responseBodySize;
        rec.big.push([s.responseBodySize, u.replace(ORIGIN, '')]);
      }).catch(() => {}));
    });
    const t0 = Date.now();
    try {
      await page.goto(`${ORIGIN}/${pg}`, { waitUntil: 'load', timeout: 60000 });
      rec.loadWall = Date.now() - t0;
    } catch (e) { rec.gotoError = String(e).slice(0, 200); }
    await page.waitForTimeout(/island_|land_template|template/.test(pg) ? SETTLE_ISLAND : SETTLE);
    try {
      Object.assign(rec, await page.evaluate(() => {
        const W = innerWidth, se = document.scrollingElement || document.documentElement;
        const nav = performance.getEntriesByType('navigation')[0] || {};
        const cand = [];
        const isText = el => { for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true; return /^(BUTTON|A|INPUT|IMG|SELECT|TEXTAREA|LABEL|CANVAS|SVG|VIDEO)$/i.test(el.tagName); };
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          if (r.right <= W + 1 && r.left >= -1) continue;
          if (r.left >= W - 1 || r.right <= 1) continue; // fully off-screen: likely intentional
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
          let a = el.parentElement, clip = null, hidden = false;
          while (a) {
            const s = getComputedStyle(a);
            if (+s.opacity === 0 || s.visibility === 'hidden' || s.display === 'none') { hidden = true; break; }
            if (!clip && (s.overflowX !== 'visible' || s.clipPath !== 'none' || /paint|strict|content/.test(s.contain))) clip = { el: a, ox: s.overflowX };
            a = a.parentElement;
          }
          if (hidden) continue;
          let kind;
          if (!clip) kind = 'unclipped';
          else if (/auto|scroll/.test(clip.ox)) continue; // scroll container: user can reach it
          else kind = 'clipped';
          if (kind === 'clipped' && !isText(el)) continue;
          const desc = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
          cand.push({ kind, el: desc(el), clipBy: clip ? desc(clip.el) : null, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), w: Math.round(r.width), pos: cs.position, text: (el.innerText || el.value || '').trim().slice(0, 40), _e: el });
        }
        // keep outermost per kind
        const keep = cand.filter(c => !cand.some(o => o !== c && o.kind === c.kind && o._e.contains(c._e)));
        keep.forEach(c => delete c._e);
        const scripts = [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean);
        const links = [...document.querySelectorAll('link[href]')].map(l => l.getAttribute('rel') + ' ' + l.getAttribute('href'));
        return {
          dcl: Math.round(nav.domContentLoadedEventEnd || 0), load: Math.round(nav.loadEventEnd || 0),
          scrollW: se.scrollWidth, bodyScrollW: document.body ? document.body.scrollWidth : 0, innerW: W, scrollH: se.scrollHeight,
          overflowX: getComputedStyle(document.documentElement).overflowX + '/' + (document.body ? getComputedStyle(document.body).overflowX : ''),
          cut: keep.slice(0, 25), cutCount: keep.length,
          scripts, links, title: document.title, ph: window.__ph,
          bodyTextLen: document.body ? document.body.innerText.length : 0,
        };
      }));
    } catch (e) { rec.evalError = String(e).slice(0, 200); }
    // per-frame scripts
    rec.frames = [];
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      try { rec.frames.push({ url: f.url().replace(ORIGIN, ''), name: f.name(), scripts: await f.evaluate(() => [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean)), ph: await f.evaluate(() => window.__ph) }); } catch (e) { rec.frames.push({ url: f.url().replace(ORIGIN, ''), err: String(e).slice(0, 100) }); }
    }
    await Promise.all(sizes);
    rec.dupUrls = Object.entries(rec.urlCount).filter(([k, v]) => v > 1).sort((a, b) => b[1] - a[1]).slice(0, 30); delete rec.urlCount;
    try { const cdp = await ctx.newCDPSession(page); rec.dom = await cdp.send('Memory.getDOMCounters'); await cdp.send('Performance.enable'); const m = (await cdp.send('Performance.getMetrics')).metrics; const g = n => (m.find(x => x.name === n) || {}).value; rec.heapMB = +(g('JSHeapUsedSize') / 1e6).toFixed(1); rec.frameCount = g('Frames'); rec.docCount = g('Documents'); rec.nodes = g('Nodes'); await cdp.detach(); } catch (e) { rec.cdpErr = String(e).slice(0, 100); }
    rec.big.sort((a, b) => b[0] - a[0]); rec.big = rec.big.slice(0, 8);
    try { await page.screenshot({ path: path.join(SHOTS, pg.replace(/[\/]/g, '__') + '_' + W + '.png') }); } catch (e) {}
    fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
    console.log(pg, W, 'cons', rec.console.length, 'pe', rec.pageerrors.length, 'bad', rec.bad.length, 'ext', ext.length, 'reqs', rec.reqs, '304', rec.n304, (rec.bytes / 1e6).toFixed(2) + 'MB', 'frames', rec.frameCount, 'heap', rec.heapMB, 'sw', rec.scrollW, 'cut', rec.cutCount, 'load', rec.load);
    await ctx.close();
  }
}
await browser.close();
srv.close();
console.log('DONE');
