/* X4b: count SDK requests after one failed download: does the browser ever re-request it? */
import * as H from './h2.mjs';
const srv = await H.startStaticAt(H.REPO);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 20 } });
const out = {};
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'p' });
  out.login = (await H.loginPhone(ph, '13800000502')).ok;
  let hits = 0;
  await ph.ctx.route(/vendor_cloudbase_esm_v965\.js/, (r) => { hits++; if (hits === 1) return r.abort('connectionreset'); return r.continue(); });
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom), null, { timeout: 45000 });
  const res = [];
  for (let i = 0; i < 3; i++) { res.push(await ph.eval(async () => (await HansenAuth.ensureSession()).kind || 'ok')); await H.sleep(800); }
  out.kinds = res; out.sdkRequests = hits;
  /* a different URL for the same file (cache-busting query) does load */
  out.bustedImport = await ph.eval(async () => { try { const m = await import('./vendor_cloudbase_esm_v965.js?retry=1'); return !!(m && (m.default || m).init); } catch (e) { return 'ERR ' + String(e.message).slice(0, 80); } });
  out.sdkRequestsAfterBust = hits;
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom), null, { timeout: 45000 });
  out.afterReload = await ph.eval(async () => (await HansenAuth.ensureSession()).ok);
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 600); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
