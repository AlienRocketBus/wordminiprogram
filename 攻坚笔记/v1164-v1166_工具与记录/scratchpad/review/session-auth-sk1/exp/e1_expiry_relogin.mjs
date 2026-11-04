/* E1 (AUTH-1): a genuinely dead session (refresh token revoked) detected by the app's own autosync
 * (hsn-data-changed -> 8 s throttle -> syncNow -> ensureSession), NOT by a direct API call.
 * Real 62 s wait instead of faking signedAt.  Then the kid keeps playing and logs in again.
 * MODE=direct  : re-login without signing out (what the reviewer did)
 * MODE=signout : v1163-faithful path: tap 退出登录 first (signOut()), then log in again
 * OLD=1 -> v1163 snapshot. */
import * as L from './lib.mjs';
const { H } = L;
const MODE = process.env.MODE || 'direct';
const srv = await L.serve(L.ROOTSEL);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
const T0 = Date.now(); const t = () => Date.now() - T0;
const o = { ver: L.VER, mode: MODE, steps: [] };
const card = (ph) => ph.eval(() => ((document.getElementById('pkMe') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 80));
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'kid', ready: L.PK_READY });
  emu.knobs.accessTokenTtlSec = 35;
  const lg = await H.loginPhone(ph, '13800000701');
  emu.knobs.accessTokenTtlSec = 7200;
  o.login = { ok: lg.ok, uid: lg.uid };
  await L.seedProgress(ph, { learned: 5, wins: 3 });
  o.up1 = await ph.eval(async () => { const r = await HansenCloudSave.syncNow({ force: true }); return { ok: r.ok, reason: r.reason || '' }; });
  o.steps.push({ at: t(), s: 'healthy+uploaded', st: await L.kidState(ph), card: await card(ph) });
  /* session dies on the server; wait out the 60 s "fresh" window for real */
  emu.revokeSessions(lg.uid);
  await H.sleep(63000);
  /* kid plays: more words + 2 more wins (wins recorded before the death would look the same locally) */
  await L.seedProgress(ph, { learned: 12, wins: 2 });
  o.steps.push({ at: t(), s: 'played-after-death(before detection)', st: await L.kidState(ph), card: await card(ph) });
  /* the app's own autosync notices the change */
  await ph.eval(() => HansenCloudSave.notifyChanged());
  await H.sleep(14000);
  o.steps.push({ at: t(), s: 'after-autosync', st: await L.kidState(ph), card: await card(ph),
    trace: (await ph.eval(() => HansenAuth._trace())).split('\n').filter((l) => /结论|凭证守护|已清除/.test(l)).slice(-5) });
  await L.seedProgress(ph, { learned: 15, wins: 0 });
  o.steps.push({ at: t(), s: 'played-more', st: await L.kidState(ph) });
  if (MODE === 'signout') {
    o.signout = await ph.eval(async () => { const r = await HansenAuth.signOut(); return r; });
    o.steps.push({ at: t(), s: 'after-signout', st: await L.kidState(ph), card: await card(ph) });
  }
  o.relogin = await ph.eval(async () => {
    try { await HansenAuth.sendPhoneCode('13800000701'); const r = await HansenAuth.loginByPhoneCode('123456'); return { ok: true, uid: r.uid, sync: r.sync }; }
    catch (e) { return { ok: false, err: String(e && e.message || e) }; }
  });
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(L.PK_READY, null, { timeout: 45000 });
  await H.sleep(1500);
  o.steps.push({ at: t(), s: 'after-relogin+reload', st: await L.kidState(ph), card: await card(ph) });
  o.saveWrites = emu.writes.filter((w) => w.collection === 'hansen_saves').map((w) => ({ at: w.t - T0, op: w.op }));
  o.tokens = emu.log.filter((e) => /\/auth\/v1\/(token|signin|signup)/.test(e.path)).map((e) => ({ at: e.t - T0, p: e.path.replace('/auth/v1/', ''), st: e.status, code: e.code || '' }));
  o.errors = ph.errors.slice(0, 3);
} catch (e) { o.thrown = String(e && e.stack || e).slice(0, 900); }
L.out(o);
await browser.close(); srv.close(); process.exit(0);
