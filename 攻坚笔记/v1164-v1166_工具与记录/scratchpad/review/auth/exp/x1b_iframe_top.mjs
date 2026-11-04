/* X1b: index.html (top) + island page in #islandFrame. OLD=1 serves the v1163 snapshot.
 * Q1: login inside iframe -> top overlay?
 * Q2: login at top; island open; session dies (refresh token revoked, access token expires,
 *     login > 60 s ago); island code calls ensureSession -> what do the top and the island show? */
import * as H from './h2.mjs';

const ROOT = process.env.OLD ? H.V1163 : H.REPO;
const ENV = H.cloudConfig().env;
const srv = await H.startStaticAt(ROOT);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
const out = { root: ROOT };
const overlay = (pg) => pg.evaluate(() => { const d = document.getElementById('hsnTabStale'); return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 60) : null; });
async function islandFrame(page) {
  await page.evaluate(() => window.openIsland('island_animal.html'));
  const fr = await H.until(async () => page.frames().find((f) => /island_animal\.html/.test(f.url())), { timeout: 20000 });
  await fr.waitForFunction(() => !!(window.HansenAuth && window.HansenAuth.ensureSession), null, { timeout: 45000 });
  await H.sleep(1200);
  return fr;
}
try {
  /* ── Q1 ── */
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', path: '/index.html', ready: () => !!(window.HansenAuth && window.openIsland) });
  const frA = await islandFrame(A.page);
  out.q1login = await frA.evaluate(async () => {
    try { await HansenAuth.sendPhoneCode('13800000301'); const r = await HansenAuth.loginByPhoneCode('123456'); return { ok: true, uid: r && r.uid }; }
    catch (e) { return { ok: false, err: String(e && e.message || e) }; }
  });
  await H.sleep(1500);
  out.q1_topOverlay = await overlay(A.page);

  /* ── Q2 ── fresh phone, login at TOP with a token that needs refresh 5 s later */
  const B = await H.openPhone(browser, emu, srv.origin, { name: 'B', path: '/index.html', ready: () => !!(window.HansenAuth && window.openIsland) });
  emu.knobs.accessTokenTtlSec = 35;
  out.q2login = await B.eval(async () => {
    try { await HansenAuth.sendPhoneCode('13800000302'); const r = await HansenAuth.loginByPhoneCode('123456'); return { ok: true, uid: r && r.uid }; }
    catch (e) { return { ok: false, err: String(e && e.message || e) }; }
  });
  emu.knobs.accessTokenTtlSec = 7200;
  const frB = await islandFrame(B.page);
  out.q2_overlayAfterOpen = { top: await overlay(B.page), island: await overlay(frB) };
  emu.revokeSessions(out.q2login.uid);              // refresh token can no longer be used
  await B.eval(() => { const lc = JSON.parse(localStorage.getItem('hansen_auth_v1004') || '{}'); lc.signedAt = Date.now() - 3600e3; localStorage.setItem('hansen_auth_v1004', JSON.stringify(lc)); });
  await H.sleep(6500);                               // client-side access token now expired -> SDK refreshes -> invalid_grant
  out.q2session = await frB.evaluate(() => HansenAuth.ensureSession());
  await H.sleep(2000);
  out.q2_after = { top: await overlay(B.page), island: await overlay(frB), signed: await B.eval(() => HansenAuth.isSignedIn()) };
  out.errors = [A.errors.slice(0, 3), B.errors.slice(0, 3)];
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close();
process.exit(0);
