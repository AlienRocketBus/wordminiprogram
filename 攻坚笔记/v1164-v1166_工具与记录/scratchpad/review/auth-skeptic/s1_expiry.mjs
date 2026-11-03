/* S1 (AUTH-1) skeptic reproduction — real time, no marker patching.
 *  1. kid logs in via the UI (real SDK, emulator), access token TTL so the SDK must refresh ~70 s later
 *  2. plays: 5 learned words + 3 ladder wins → the app's OWN autosync (setItem hook → hsn-data-changed → 8 s) uploads
 *  3. server revokes the refresh token (session dies); wait past the 60 s fresh window + SDK expiry
 *  4. kid plays 7 more words → autosync → ensureSession → refresh → invalid_grant
 *  5. observe marker / pk record / what the screen says
 *  6. kid plays 3 more words (signed out), then logs in again via the UI with the same phone
 *  7. after the reload: what survived?
 * OLD=1 → v1163 snapshot. VARIANT=signout → on v1163, kid presses 退出登录 then logs in (to see if the overwrite is pre-existing) */
import * as H from './lib.mjs';
const ROOT = H.ROOTSEL();
const srv = await H.serve(ROOT);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30, accessTokenTtlSec: 100 } });
const out = { ver: process.env.OLD ? 'v1163' : 'v1164', variant: process.env.VARIANT || '' };
const PHONE = '13800009901';
const t0 = Date.now();
const T = () => Math.round((Date.now() - t0) / 1000) + 's';
const st = (ph) => ph.eval(() => {
  const w = JSON.parse(localStorage.getItem('wordIslandFood') || '{}');
  const s = window.HansenPkRecord ? HansenPkRecord.summary() : null;
  const lc = JSON.parse(localStorage.getItem('hansen_auth_v1004') || '{}');
  return { signed: HansenAuth.isSignedIn(), uid: lc.uid || '', method: lc.method || '', learned: (w.learned || []).length,
           wins: s && s.wins, games: s && s.total,
           card: ((document.getElementById('pkMe') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 70),
           acct: ((document.getElementById('pkAcct') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 90),
           credKeys: Object.keys(localStorage).filter((k) => /^credentials/.test(k)).map((k) => k.slice(0, 14) + ':' + (localStorage.getItem(k) || '').length) };
});
const savesWrites = () => emu.writes.filter((w) => w.collection === 'hansen_saves').length;
const play = (ph, n) => ph.eval((n) => {
  const arr = []; for (let i = 0; i < n; i++) arr.push(i);
  localStorage.setItem('wordIslandFood', JSON.stringify({ learned: arr, stats: {} }));
}, n);
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'kid' });
  out.loginMsg1 = await H.loginPhoneUI(ph, PHONE);
  await H.sleep(2500);
  try { await ph.tap('#auX', { timeout: 3000 }); } catch (e) { out.closeErr = String(e.message).slice(0, 120); }
  await H.sleep(500);
  out.afterLogin = await st(ph);
  const uid = emu.uidOfLogin('+86 ' + PHONE);
  out.uid = uid;
  // ② play while healthy
  await play(ph, 5);
  for (let i = 0; i < 3; i++) await ph.eval(() => HansenPkRecord.record({ result: 'win', mode: 'A', oppRating: 1000, words: 10, correct: 9 }));
  const w0 = savesWrites();
  await H.until(async () => savesWrites() > w0, { timeout: 25000, interval: 500 });
  await H.sleep(9500);  // let the autosync for the ladder writes land too
  out.healthy = await st(ph);
  out.healthyUploads = savesWrites();
  out.healthyAt = T();
  // ③ session dies on the server
  emu.revokeSessions(uid);
  out.revokedAt = T();
  // wait past SDK expiry (login + 70 s) and the 60 s fresh window
  while (Date.now() - t0 < 80000) await H.sleep(1000);
  // ④ more play → autosync
  await play(ph, 12);
  const dlg0 = ph.dialogs.length;
  await H.sleep(14000);
  out.afterDeath = await st(ph);
  out.afterDeathAt = T();
  out.afterDeathScreen = (await ph.screen()).replace(/\s+/g, ' ').slice(0, 300);
  out.afterDeathDialogs = ph.dialogs.slice(dlg0).map((d) => d.message.slice(0, 120));
  out.tokenCalls = emu.log.filter((e) => e.path === '/auth/v1/token').map((e) => `${e.status} ${e.code || ''}`);
  // ⑤ plays on (signed out in v1164)
  await play(ph, 15);
  await H.sleep(10000);
  out.beforeRelogin = await st(ph);
  if (process.env.VARIANT === 'signout') {
    // v1163 kid presses 退出登录 (confirm accepted by the harness) to "fix" the dead cloud
    await ph.tap('#pkOut');
    await H.sleep(8000);
    out.afterSignout = await st(ph);
  }
  // ⑥ log in again through the UI with the same phone
  out.reloginMsg = await H.loginPhoneUI(ph, PHONE);
  await H.sleep(2500);
  try { await ph.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRecord && document.readyState !== 'loading'), null, { timeout: 30000 }); } catch (e) {}
  await H.sleep(3000);
  out.afterRelogin = await st(ph);
  out.cloudDocs = (emu.dump('hansen_saves') || []).length;
  out.errors = ph.errors.slice(0, 4);
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 900); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
