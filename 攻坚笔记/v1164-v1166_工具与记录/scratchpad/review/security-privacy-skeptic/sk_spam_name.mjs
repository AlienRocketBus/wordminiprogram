/* Skeptic: can the friend-request flood render an attacker-chosen NAME (SEC-3a), not just "No.xxxxx"?
 * Reviewer's atk_privacy wrote only a friend row -> name showed as "No.90001". Test: also seed a presence row. */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenSbProfile);
const j = (x) => JSON.stringify(x);
const srv = await H.startStatic(); const browser = await H.launchBrowser();
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 20, jitterMs: 10 } });
  for (const u of ['alice', 'mallory']) emu.seedUser({ username: u, password: 'pw123456' });
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
  await A.eval(() => window.HansenSbProfile.setName('小爱'));
  await H.loginPassword(A, 'alice', 'pw123456');
  const aCid = await A.eval(() => (window.HansenSbProfile.readProfile() || {}).cid || 0);
  const C = await H.openPhone(browser, emu, srv.origin, { name: 'C', ready: READY });
  await H.loginPassword(C, 'mallory', 'pw123456');
  // attacker writes BOTH a friend row (owner=90001 targeting Alice) AND a presence row for cid 90001 with an ad name
  await C.eval(async (aCid) => {
    const db = (await window.HansenAuth._app()).database();
    await db.collection('hansen_friends').add({ kind: 'friend', owner: 90001, friend: aCid, name: 'ignored', at: Date.now() });
    await db.collection('hansen_friends').add({ kind: 'presence', cid: 90001, name: '加微信lao8师8发8奖', at: Date.now() });
  }, aCid);
  await H.sleep(400);
  const inc = await A.eval(async () => { const r = await window.HansenFriends.listFriends(); return (r.incoming||[]).map(x=>({cid:x.cid,name:x.name,sub:x.sub})); });
  console.log('[A] incoming with attacker presence row:', j(inc));
  const got = inc.find(x=>x.cid===90001);
  console.log(got && /加微信/.test(got.name) ? 'CONFIRMED: attacker-chosen ad NAME renders in child\'s incoming list' : 'name did NOT render ('+(got?got.name:'none')+')');
  await A.close(); await C.close();
} finally { await browser.close().catch(()=>{}); srv.close(); }
