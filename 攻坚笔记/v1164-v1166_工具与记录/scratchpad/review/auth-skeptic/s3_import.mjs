/* S3 (AUTH-3): the first download of vendor_cloudbase_esm_v965.js fails ONCE (abort, or MODE=504 like the SW's
 * offline answer); every later request would succeed. Does the app ever recover without a reload? */
import * as H from './lib.mjs';
const ROOT = H.ROOTSEL();
const MODE = process.env.MODE || 'abort';
let failNext = false, sdkHits = 0, failed = 0;
const srv = await H.serve(ROOT, (req, res, p) => {
  if (/vendor_cloudbase_esm_v965\.js$/.test(p)) {
    sdkHits++;
    if (failNext) {
      failNext = false; failed++;
      if (MODE === '504') { res.writeHead(504, { 'content-type': 'text/plain' }); res.end(''); return true; }
      req.socket.destroy(); return true;           // connection dropped mid-way (weak 4G)
    }
  }
  return false;
});
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
const out = { ver: process.env.OLD ? 'v1163' : 'v1164', mode: MODE };
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'kid' });
  const lg = await H.loginPhone(ph, '13800009921');
  out.login = { ok: lg.ok };
  out.sdkHitsBeforeReload = sdkHits;
  if (MODE === 'routeabort') {
    let once = true;
    await ph.ctx.route(/vendor_cloudbase_esm_v965\.js/, (r) => { if (once) { once = false; failed++; return r.abort('internetdisconnected'); } return r.continue(); });
  } else failNext = true;                           // the next page load meets a bad signal for the SDK file
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(() => !!(window.HansenAuth && window.HansenLadderUI), null, { timeout: 45000 });
  out.calls = [];
  for (let i = 0; i < 4; i++) {
    const r = await ph.eval(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind, reason: String(s.reason || '').slice(0, 90) }; });
    out.calls.push(Object.assign(r, { sdkHits }));
    await H.sleep(1500);
  }
  out.failedInjected = failed;
  out.reimport = await ph.eval(async () => { try { await import('./vendor_cloudbase_esm_v965.js'); return 'ok'; } catch (e) { return 'fail: ' + String(e && e.message || e).slice(0, 90); } });
  out.sdkHitsAfterReimport = sdkHits;
  out.bustImport = await ph.eval(async () => { try { const m = await import('./vendor_cloudbase_esm_v965.js?r=' + Date.now()); return 'ok ' + typeof (m.default || m).init; } catch (e) { return 'fail: ' + String(e).slice(0, 80); } });
  // what the ladder shows (open it the way the kid does: HansenLadderUI.open())
  await ph.eval(() => { try { HansenLadderUI.open(); } catch (e) {} });
  await H.sleep(3000);
  try { await ph.tap('#ldGo', { timeout: 4000 }); out.tappedGo = true; } catch (e) { out.tappedGo = String(e.message).slice(0, 100); }
  let txt = '';
  const tS = Date.now();
  while (Date.now() - tS < 40000) { txt = (await ph.screen()).replace(/\s+/g, ' '); if (/连不上网络|云端还没连上|这次没成功|设置还差/.test(txt)) break; await H.sleep(500); }
  out.ladderScreen = txt.slice(0, 260);
  out.ladderAfterMs = Date.now() - tS;
  // after a reload it works again?
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(() => !!window.HansenAuth, null, { timeout: 45000 });
  out.afterReload = await ph.eval(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind || '' }; });
  out.signedStill = await ph.eval(() => HansenAuth.isSignedIn());
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 700); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
