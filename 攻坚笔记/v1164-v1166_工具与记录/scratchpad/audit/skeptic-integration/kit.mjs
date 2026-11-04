import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './srv.mjs';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function boot({ width = 390, height = 844, cache, version, init } = {}) {
  const S = await serve({ cache, version });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36' });
  const external = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('http://127.0.0.1:' + S.port) || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    external.push(u); return r.abort();
  });
  if (init) await ctx.addInitScript(init);
  const base = 'http://127.0.0.1:' + S.port + '/';
  return { ...S, browser, ctx, base, external, async done() { try { await browser.close(); } catch (e) {} S.srv.close(); } };
}
// real finger tap on element in page or frame; returns hit info
export async function tap(page, scope, sel) {
  const h = typeof sel === 'string' ? await scope.$(sel) : sel;
  if (!h) return { ok: false, why: 'notfound:' + sel };
  await h.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'auto' }));
  await scope.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const b = await h.boundingBox();
  if (!b) return { ok: false, why: 'nobox' };
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  // check hit in top page (to see whether something covers) and in frame
  const topHit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '#' + e.id + '.' + String(e.className).slice(0, 30) : null; }, [x, y]);
  await page.touchscreen.tap(x, y);
  return { ok: true, x: Math.round(x), y: Math.round(y), topHit };
}
// Skip home onboarding if present
export async function skipHomeOnboarding(page) {
  for (let i = 0; i < 30; i++) {
    const r = await page.evaluate(() => {
      const els = [...document.querySelectorAll('button, a, div, span')].filter(e => /^\s*跳过/.test(e.textContent || '') && e.offsetParent !== null && e.children.length === 0);
      if (els.length) { els[0].click(); return 'clicked'; }
      return 'none';
    });
    if (r === 'clicked') return true;
    await sleep(200);
  }
  return false;
}
export function islandFrame(page) {
  return page.frames().find(f => f.parentFrame() === page.mainFrame() && f.name() !== '' ? false : f.parentFrame() === page.mainFrame());
}
