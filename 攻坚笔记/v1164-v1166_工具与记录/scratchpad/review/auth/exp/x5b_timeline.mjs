/* X5: the kid's cloud session dies (refresh token rejected -> SDK deletes credentials_) while the kid keeps playing.
 *   v1164: the next background ensureSession (here: the cloud autosync) says "definite expired" -> clears the
 *          marker (uid -> '') -> listeners react; the kid keeps playing anonymously; later logs in again
 *          -> syncOnLogin "cloud always wins" -> what happens to the progress made after the session died?
 *   OLD=1: same steps on the v1163 snapshot. */
import * as H from './h2.mjs';

const ROOT = process.env.OLD ? H.V1163 : H.REPO;
const srv = await H.startStaticAt(ROOT);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 25 } });
const out = { root: ROOT.slice(-20) }; const T0 = Date.now(); const MARKS = {}; const mark = (k) => { MARKS[k] = Date.now() - T0; };
const state = (ph) => ph.eval(() => {
  const w = JSON.parse(localStorage.getItem('wordIsland_kidX') || '{}');
  const s = window.HansenPkRecord ? HansenPkRecord.summary() : null;
  return { signed: HansenAuth.isSignedIn(), learned: (w.learned || []).length, ladderWins: s && s.wins, ladderGames: s && s.total,
           me: ((document.getElementById('pkMe') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 60) };
});
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'kid' });
  emu.knobs.accessTokenTtlSec = 35;               // SDK will need a refresh 5 s from now
  const lg = await H.loginPhone(ph, '13800000601');
  emu.knobs.accessTokenTtlSec = 7200;
  out.login = { ok: lg.ok, uid: lg.uid };
  /* ① progress, uploaded to the cloud while the session is healthy */
  out.up1 = await ph.eval(async () => {
    localStorage.setItem('wordIsland_kidX', JSON.stringify({ learned: [1, 2, 3, 4, 5] }));
    for (let i = 0; i < 3; i++) HansenPkRecord.record({ result: 'win', mode: 'A', oppRating: 1000, words: 10, correct: 9 });
    const r = await HansenCloudSave.syncNow({ force: true }); return { ok: r.ok, reason: r.reason || '' };
  });
  out.s1 = await state(ph);
  mark('up1done');
  /* ② the session dies (refresh token no longer accepted); login was an hour ago */
  emu.revokeSessions(lg.uid);
  await ph.eval(() => { const lc = JSON.parse(localStorage.getItem('hansen_auth_v1004')); lc.signedAt = Date.now() - 3600e3; localStorage.setItem('hansen_auth_v1004', JSON.stringify(lc)); });
  await H.sleep(6500);
  mark('beforeStep3');
  /* ③ the kid keeps playing: 7 more words, 2 more ladder wins; the app's autosync then tries to upload */
  out.up2 = await ph.eval(async () => {
    localStorage.setItem('wordIsland_kidX', JSON.stringify({ learned: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }));
    for (let i = 0; i < 2; i++) HansenPkRecord.record({ result: 'win', mode: 'A', oppRating: 1000, words: 10, correct: 9 });
    const before = HansenPkRecord.summary().wins;
    const r = await HansenCloudSave.syncNow({ force: true });
    return { winsBeforeSync: before, ok: r.ok, reason: r.reason || '', error: String(r.error || '').slice(0, 80) };
  });
  await H.sleep(1500);
  mark('s3'); out.s3 = await state(ph);
  /* ④ kid plays a bit more as "not signed in" (anonymous): 3 more words */
  await ph.eval(() => localStorage.setItem('wordIsland_kidX', JSON.stringify({ learned: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] })));
  out.s4 = await state(ph);
  mark('beforeRelogin');
  /* ⑤ the kid logs in again with the SAME phone number */
  const re = await ph.eval(async () => {
    try { await HansenAuth.sendPhoneCode('13800000601'); const r = await HansenAuth.loginByPhoneCode('123456'); return { ok: true, uid: r.uid, sync: r.sync }; }
    catch (e) { return { ok: false, err: String(e && e.message || e) }; }
  });
  mark('reloginDone'); out.relogin = re;
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRecord), null, { timeout: 45000 });
  await H.sleep(800);
  out.s5 = await state(ph);
  out.errors = ph.errors.slice(0, 3);
  out.t0 = T0; out.marks = MARKS; out.saveWrites = emu.writes.filter((w) => w.collection === "hansen_saves").map((w) => ({ dt: w.t - T0, op: w.op })); out.tokenLog = emu.log.filter((e) => /token|signin|signup|verification/.test(e.path)).map((e) => ({ dt: e.t - T0, path: e.path, st: e.status, code: e.code || "" }));
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
