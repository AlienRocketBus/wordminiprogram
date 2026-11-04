// variant of kit without Playwright routing (routing disables the HTTP cache); external hosts blocked via host-resolver-rules
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './srv.mjs';
export async function boot2({ width = 390, height = 844, cache, version, init, override } = {}) {
  const S = await serve({ cache, version, override });
  const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36' });
  const external = [];
  ctx.on('request', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1:' + S.port) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('about:')) external.push(u); });
  if (init) await ctx.addInitScript(init);
  const base = 'http://127.0.0.1:' + S.port + '/';
  return { ...S, browser, ctx, base, external, async done() { try { await browser.close(); } catch (e) {} S.srv.close(); } };
}
