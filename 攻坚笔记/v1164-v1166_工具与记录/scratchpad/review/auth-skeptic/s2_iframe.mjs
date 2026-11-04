/* S2 (AUTH-2) skeptic reproduction.
 * CASE=expiry (default): kid logs in on index.html, >60 s later the session dies on the server, kid comes back
 *   (index.html reload = returning kid, already signed in), taps nothing but enters an island → does the TOP window
 *   paint the cross-window overlay?
 * CASE=login: kid is signed out, opens an island inside index.html and logs in INSIDE the island frame.
 * OLD=1 → v1163 snapshot. */
import * as H from './lib.mjs';
const ROOT = H.ROOTSEL();
const CASE = process.env.CASE || 'expiry';
const srv = await H.serve(ROOT);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30, accessTokenTtlSec: 100 } });
const out = { ver: process.env.OLD ? 'v1163' : 'v1164', case: CASE };
const t0 = Date.now();
const topReady = () => !!(window.HansenAuth && typeof window.openIsland === 'function');
const overlay = (ph) => ph.eval(() => {
  const d = document.getElementById('hsnTabStale');
  if (!d) return null;
  const cs = getComputedStyle(d);
  return { text: d.innerText.replace(/\s+/g, ' ').slice(0, 120), z: cs.zIndex, full: d.offsetWidth >= innerWidth - 2 && d.offsetHeight >= innerHeight - 2 };
});
const frameState = (ph) => ph.eval(() => {
  try {
    const f = document.getElementById('islandFrame');
    const w = f && f.contentWindow;
    const lc = JSON.parse(localStorage.getItem('hansen_auth_v1004') || '{}');
    return { url: w ? w.location.pathname : '', frameHasAuth: !!(w && w.HansenAuth), signed: !!(lc.method && lc.signedAt), uid: lc.uid || '',
             frameText: w && w.document && w.document.body ? w.document.body.innerText.replace(/\s+/g, ' ').slice(0, 160) : '' };
  } catch (e) { return { err: String(e) }; }
});
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'kid', path: '/index.html', ready: topReady });
  if (CASE === 'expiry') {
    const lg = await H.loginPhone(ph, '13800009911');
    out.login = { ok: lg.ok, uid: lg.uid };
    while (Date.now() - t0 < 76000) await H.sleep(1000);   // past the fresh window and the SDK's token expiry
    emu.revokeSessions(lg.uid);
    await ph.page.reload({ waitUntil: 'domcontentloaded' });  // the kid comes back later: index.html opens already signed in
    await ph.page.waitForFunction(topReady, null, { timeout: 45000 });
    await H.sleep(2500);
    out.beforeIsland = { overlay: await overlay(ph), state: await frameState(ph) };
    const tIn = Date.now();
    await ph.eval(() => window.openIsland('island_food.html'));
    let ov = null;
    while (Date.now() - tIn < 25000) { ov = await overlay(ph); if (ov) break; await H.sleep(250); }
    out.overlayAfterMs = ov ? Date.now() - tIn : null;
    out.overlay = ov;
    await H.sleep(1500);
    out.after = await frameState(ph);
    out.topScreen = (await ph.screen()).replace(/\s+/g, ' ').slice(0, 220);
    out.tokenCalls = emu.log.filter((e) => e.path === '/auth/v1/token').map((e) => `${e.status} ${e.code || ''}`);
  } else {
    await H.sleep(1500);
    const tIn = Date.now();
    await ph.eval(() => window.openIsland('island_food.html'));
    await H.until(async () => { const s = await frameState(ph); return s && s.frameHasAuth && /island_food/.test(s.url); }, { timeout: 30000 });
    await H.sleep(2500);
    out.beforeLogin = { overlay: await overlay(ph), state: await frameState(ph) };
    const fr = ph.page.frames().find((f) => /island_food\.html/.test(f.url()));
    out.frameLogin = await fr.evaluate(async () => {
      try { await HansenAuth.sendPhoneCode('13800009912'); const r = await HansenAuth.loginByPhoneCode('123456'); return { ok: true, uid: r.uid, sync: r.sync && r.sync.action }; }
      catch (e) { return { ok: false, err: String(e && e.message || e) }; }
    });
    let ov = null; const tL = Date.now();
    while (Date.now() - tL < 8000) { ov = await overlay(ph); if (ov) break; await H.sleep(200); }
    out.overlay = ov;
    out.after = await frameState(ph);
  }
  out.errors = ph.errors.slice(0, 4);
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 900); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
