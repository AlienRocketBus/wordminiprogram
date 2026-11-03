import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
export { start } from './srv.mjs';

export const SNAP = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
export const OUT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/skeptic-network';
export const V1164 = OUT + '/v1164';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch() {
  return chromium.launch({
    headless: true,
    args: ['--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1',
      '--autoplay-policy=no-user-gesture-required', '--disable-gpu', '--renderer-process-limit=4']
  });
}

export async function ctxOf(browser, o = {}) {
  const ctx = await browser.newContext({
    viewport: { width: o.width || 390, height: o.height || 844 }, deviceScaleFactor: 1, isMobile: o.isMobile !== false, hasTouch: o.hasTouch !== false,
    serviceWorkers: o.sw ? 'allow' : 'block',
    userAgent: o.ua || 'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
    locale: 'zh-CN'
  });
  if (o.skipOnboard !== false) await ctx.addInitScript(() => { try { if (!localStorage.getItem('hansen_onboarded')) localStorage.setItem('hansen_onboarded', '1'); } catch (e) {} });
  return ctx;
}

export function watch(page, sink, tag = '') {
  page.on('pageerror', e => sink.push({ tag, k: 'pageerror', t: String(e && e.message || e).slice(0, 240) }));
  page.on('response', r => { if (r.status() >= 400) sink.push({ tag, k: 'http' + r.status(), t: r.url().replace(/^https?:\/\/127\.0\.0\.1:\d+/, ''), sw: r.fromServiceWorker() }); });
  page.on('requestfailed', r => sink.push({ tag, k: 'reqfail', t: r.url().replace(/^https?:\/\/127\.0\.0\.1:\d+/, '').slice(0, 160) + ' ' + ((r.failure() || {}).errorText || '') }));
  page.on('dialog', d => { sink.push({ tag, k: 'dialog', t: d.message().slice(0, 200) }); d.dismiss().catch(() => {}); });
  page.on('download', d => sink.push({ tag, k: 'download', t: d.url() }));
}

export async function waitSw(page, ms = 30000) {
  return page.evaluate(async ms => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const r = await navigator.serviceWorker.getRegistration();
      if (r && r.active && r.active.state === 'activated') return Date.now() - t0;
      await new Promise(r => setTimeout(r, 200));
    }
    return -1;
  }, ms);
}

export async function caches(page) {
  return page.evaluate(async () => {
    const out = {};
    for (const n of await self.caches.keys()) { const c = await self.caches.open(n); const k = await c.keys(); out[n] = k.map(r => r.url.replace(location.origin, '')); }
    return out;
  });
}

export async function tapIsland(page, file) {
  const sel = `a.island[href="${file}"]`;
  const ok = await page.evaluate(sel => { const el = document.querySelector(sel); if (!el) return false; el.scrollIntoView({ block: 'center', behavior: 'auto' }); return true; }, sel);
  if (!ok) return { err: 'no card' };
  await page.waitForTimeout(200);
  const b = await page.evaluate(sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const h = document.elementFromPoint(x, y); return { x, y, ok: !!(h && (h === el || el.contains(h))), hit: h ? (h.id || String(h.className).slice(0, 40) || h.tagName) : null }; }, sel);
  if (!b.ok) return { err: 'blocked by ' + b.hit };
  await page.touchscreen.tap(b.x, b.y);
  return { ok: true };
}

export async function frameState(page) {
  return page.evaluate(() => {
    const f = document.getElementById('islandFrame'); const w = document.getElementById('islandFrameWrap');
    let p = '', rs = '', title = '', ver = null, gate = null;
    try { p = f.contentWindow.location.pathname; rs = f.contentDocument.readyState; title = f.contentDocument.title; } catch (e) {}
    try { ver = f.contentWindow.HansenBackup && f.contentWindow.HansenBackup.appVersion(); } catch (e) {}
    try { gate = f.contentWindow.__hansenSwUpgradeGateV944 && f.contentWindow.__hansenSwUpgradeGateV944.version; } catch (e) {}
    const ld = document.getElementById('islandLoading');
    return { p, rs, title, ver, gate, wrap: w && w.style.display, op: f && f.style.opacity, loading: ld && ld.style.display !== 'none' ? (document.getElementById('islandLoadingText') || {}).textContent : null };
  });
}

export async function waitIsland(page, file, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await frameState(page);
    if (s.p.endsWith('/' + file) && s.rs === 'complete') return { ...s, ms: Date.now() - t0 };
    await page.waitForTimeout(200);
  }
  return { timeout: true, ...(await frameState(page)) };
}

export function save(name, obj) { fs.writeFileSync(OUT + '/' + name, typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)); }
