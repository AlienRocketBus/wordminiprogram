/* Phone-login victim uploads a save; capture the world-readable docId + the phone. */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
const j = (x) => JSON.stringify(x);
const READY = () => !!(window.HansenAuth && window.HansenCloudSave && window.HansenSbProfile && window.HansenBackup);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 15, jitterMs: 10, verificationCode: '123456' } });
  const PHONE = '13800138077';
  emu.seedUser({ phone: '+86 ' + PHONE }); emu.seedUser({ username: 'mallory', password: 'pw123456' });
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
  await A.eval(() => window.HansenSbProfile.setName('小爱'));
  const r = await H.loginPhone(A, PHONE, '123456');
  const up = await A.eval(async () => {
    localStorage.setItem('wordIsland_farm', JSON.stringify({ learned: [0,1,2,3,4], stars: 3 }));
    try { return await window.HansenCloudSave.syncNow({ force: true }); } catch (e) { return { err: String(e && e.message || e) }; }
  });
  const ident = await A.eval(() => { const lc = window.HansenAuth.readLocal(); return { phone: lc.phone, username: lc.username, uid: lc.uid }; });
  const C = await H.openPhone(browser, emu, srv.origin, { name: 'C', ready: READY });
  await H.loginPassword(C, 'mallory', 'pw123456');
  const rows = await C.eval(async () => {
    const db = (await window.HansenAuth._app()).database();
    const r = await db.collection('hansen_saves').limit(50).get();
    return ((r && r.data) || []).map((d) => String(d._id));
  });
  console.log('login ok=', r.ok, ' upload=', j(up));
  console.log('victim localStorage identity (what an XSS would read):', j(ident));
  console.log('world-readable save docIds:', j(rows));
} finally { await browser.close().catch(() => {}); srv.close(); }
