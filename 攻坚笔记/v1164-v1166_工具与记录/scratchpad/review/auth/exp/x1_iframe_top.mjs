/* X1: index.html (top) + island page in #islandFrame (same origin).
 * Q1: kid logs in INSIDE the island iframe -> does the top window show the cross-tab
 *     "别的窗口登录了另一个账号" overlay (#hsnTabStale)?
 * Q2: session dies (creds gone, >60 s after login) and ensureSession runs INSIDE the iframe ->
 *     v1164 clears the marker -> what does the top show?
 * Real SDK + real pages; only Tencent network emulated. */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const ENV = H.cloudConfig().env;
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
const out = {};
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'top', path: '/index.html', ready: () => !!(window.HansenAuth && window.openIsland) });
  const page = ph.page;
  await page.evaluate(() => window.openIsland('island_animal.html'));
  const fr = await H.until(async () => page.frames().find((f) => /island_animal\.html/.test(f.url())), { timeout: 20000 });
  await fr.waitForFunction(() => !!(window.HansenAuth && window.HansenAuth.loginByPhoneCode), null, { timeout: 45000 });
  await H.sleep(1500);
  out.topStaleBefore = await page.evaluate(() => !!document.getElementById('hsnTabStale'));
  /* Q1: log in inside the iframe (the island's own login entry uses the iframe's HansenAuth/HansenAuthUI) */
  out.login = await fr.evaluate(async () => {
    try {
      await HansenAuth.sendPhoneCode('13800000201');
      const r = await HansenAuth.loginByPhoneCode('123456');
      return { ok: true, uid: r && r.uid, sync: r && r.sync && r.sync.action };
    } catch (e) { return { ok: false, err: String(e && e.message || e) }; }
  });
  await H.sleep(1500);
  out.topStaleAfterIframeLogin = await page.evaluate(() => { const d = document.getElementById('hsnTabStale'); return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 120) : null; });
  out.topZ = await page.evaluate(() => { const d = document.getElementById('hsnTabStale'); return d ? getComputedStyle(d).zIndex : null; });

  /* Q2: clean slate: reload top (overlay gone), log in at TOP, then kill the session and run ensureSession in the iframe */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.HansenAuth && window.openIsland), null, { timeout: 45000 });
  await H.sleep(800);
  out.signedAfterReload = await page.evaluate(() => HansenAuth.isSignedIn());
  await page.evaluate(() => window.openIsland('island_animal.html'));
  const fr2 = await H.until(async () => page.frames().find((f) => /island_animal\.html/.test(f.url())), { timeout: 20000 });
  await fr2.waitForFunction(() => !!(window.HansenAuth && window.HansenAuth.ensureSession), null, { timeout: 45000 });
  await H.sleep(1200);
  out.topStaleBeforeQ2 = await page.evaluate(() => !!document.getElementById('hsnTabStale'));
  const uid = out.login.uid;
  /* session revoked server side + SDK deleted creds (what invalid_grant does), shadow also unusable, login is old */
  emu.revokeSessions(uid);
  await page.evaluate((env) => {
    const lc = JSON.parse(localStorage.getItem('hansen_auth_v1004') || '{}'); lc.signedAt = Date.now() - 3600e3; localStorage.setItem('hansen_auth_v1004', JSON.stringify(lc));
  }, ENV);
  await H.sleep(500);
  out.q2session = await fr2.evaluate(() => HansenAuth.ensureSession());
  await H.sleep(1500);
  out.topStaleAfterIframeExpiry = await page.evaluate(() => { const d = document.getElementById('hsnTabStale'); return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 120) : null; });
  out.markerNow = await page.evaluate(() => localStorage.getItem('hansen_auth_v1004'));
  out.errors = ph.errors.slice(0, 5);
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close();
process.exit(0);
