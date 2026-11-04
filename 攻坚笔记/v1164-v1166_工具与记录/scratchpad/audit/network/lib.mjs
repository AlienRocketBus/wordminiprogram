import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { startServer } from './server.mjs';
import fs from 'node:fs';

export const SNAP = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
export const OUT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/network';
export const COPY = OUT + '/v1164copy';

export async function launch() {
  return chromium.launch({
    headless: true,
    args: ['--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1',
      '--autoplay-policy=no-user-gesture-required', '--disable-gpu']
  });
}

export async function newCtx(browser, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: opts.width || 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    serviceWorkers: opts.sw === false ? 'block' : 'allow',
    userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
    locale: 'zh-CN'
  });
  if (opts.preOnboard !== false) {
    await ctx.addInitScript(() => {
      try { if (!localStorage.getItem('hansen_onboarded')) localStorage.setItem('hansen_onboarded', '1'); } catch (e) {}
    });
  }
  return ctx;
}

export function attach(page, tag, sink) {
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') sink.push({ tag, kind: 'console.' + m.type(), text: m.text().slice(0, 300), url: (m.location() || {}).url }); });
  page.on('pageerror', e => sink.push({ tag, kind: 'pageerror', text: String(e && e.message || e).slice(0, 300) }));
  page.on('requestfailed', r => sink.push({ tag, kind: 'requestfailed', text: r.url().replace(/^https?:\/\/127\.0\.0\.1:\d+/, '') + ' ' + ((r.failure() || {}).errorText || '') }));
  page.on('response', r => { if (r.status() >= 400) sink.push({ tag, kind: 'http' + r.status(), text: r.url().replace(/^https?:\/\/127\.0\.0\.1:\d+/, ''), fromSW: r.fromServiceWorker() }); });
  page.on('dialog', d => { sink.push({ tag, kind: 'dialog', text: d.message().slice(0, 200) }); d.dismiss().catch(() => {}); });
}

export async function cacheSummary(page) {
  return page.evaluate(async () => {
    const out = {};
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      const keys = await c.keys();
      let bytes = 0;
      const urls = [];
      for (const k of keys) {
        const r = await c.match(k);
        if (!r) { urls.push(k.url.replace(location.origin, '') + ' [gone]'); continue; }
        try { const b = await r.clone().arrayBuffer(); bytes += b.byteLength; } catch (e) {}
        urls.push(k.url.replace(location.origin, '') + ' [' + (r.headers.get('content-type') || '') + ']');
      }
      out[name] = { n: keys.length, kb: Math.round(bytes / 1024), urls };
    }
    return out;
  });
}

export async function swState(page) {
  return page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    return {
      controller: navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL.replace(location.origin, '') : null,
      regs: regs.map(r => ({ scope: r.scope.replace(location.origin, ''), active: r.active && r.active.state, waiting: !!r.waiting, installing: !!r.installing })),
      gate: window.__hansenSwUpgradeGateV944 || null
    };
  });
}

export async function waitSwActive(page, ms = 30000) {
  return page.evaluate(async (ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const r = await navigator.serviceWorker.getRegistration();
      if (r && r.active && r.active.state === 'activated') return Date.now() - t0;
      await new Promise(r => setTimeout(r, 200));
    }
    return -1;
  }, ms);
}

export function save(name, obj) {
  fs.writeFileSync(OUT + '/' + name, typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
}

export { startServer };

export async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function openIslandTap(page, file) {
  // real tap on island card
  const sel = `a.island[href="${file}"]`;
  const ok = await page.evaluate((sel) => {
    const el = document.querySelector(sel); if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    return true;
  }, sel);
  if (!ok) return { err: 'no card ' + file };
  await page.waitForTimeout(150);
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, hitOk: !!(hit && (hit === el || el.contains(hit))), hit: hit ? (hit.id || hit.className || hit.tagName) : null };
  }, sel);
  if (!box.hitOk) return { err: 'blocked by ' + box.hit, box };
  await page.touchscreen.tap(box.x, box.y);
  return { ok: true };
}

export async function waitIsland(page, file, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const st = await page.evaluate((file) => {
      const f = document.getElementById('islandFrame');
      const w = document.getElementById('islandFrameWrap');
      let p = '', rs = '', title = '';
      try { p = f.contentWindow.location.pathname.split('/').pop(); rs = f.contentDocument.readyState; title = f.contentDocument.title; } catch (e) {}
      return { p, rs, title, wrap: w && w.style.display, op: f && f.style.opacity };
    }, file);
    if (st.p === file && st.rs === 'complete') return { ...st, ms: Date.now() - t0 };
    await page.waitForTimeout(200);
  }
  return { timeout: true };
}
