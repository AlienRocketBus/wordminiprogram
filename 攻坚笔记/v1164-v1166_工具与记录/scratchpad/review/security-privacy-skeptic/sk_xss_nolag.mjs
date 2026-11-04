/* Skeptic: does the cid-XSS fire when openid IS learned (no read lag)? Bounds SEC-1. */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenSbProfile);
const j = (x) => JSON.stringify(x);
const srv = await H.startStatic(); const browser = await H.launchBrowser();
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 20, jitterMs: 10, consistencyLagMs: 0 } });
  for (const u of ['alice', 'mallory']) emu.seedUser({ username: u, password: 'pw123456' });
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
  await A.eval(() => window.HansenSbProfile.setName('小爱'));
  await H.loginPassword(A, 'alice', 'pw123456');
  const aCid = await A.eval(() => (window.HansenSbProfile.readProfile() || {}).cid || 0);
  // force a clean presence write + read-back with NO lag so openid is learned
  const b = await A.eval(async () => { const r = await window.HansenFriends._beat(); return { r, openid: window.HansenFriends._myOpenid() }; });
  console.log('[A] beat no-lag -> openid=', j(b.openid));
  const C = await H.openPhone(browser, emu, srv.origin, { name: 'C', ready: READY });
  await C.eval(() => window.HansenSbProfile.setName('路人'));
  await H.loginPassword(C, 'mallory', 'pw123456');
  await C.eval(async (aCid) => { const db = (await window.HansenAuth._app()).database();
    await db.collection('hansen_friends').add({ kind: 'friend', owner: aCid, friend: '<img src=x onerror="window.__pwn=1;document.title=\'PWNED\'">', name: 'x', at: Date.now() }); }, aCid);
  await H.sleep(400);
  const res = await A.eval(async () => { window.HansenFriendsUI.open(); await new Promise(r=>setTimeout(r,3000));
    return { pwn: window.__pwn||0, title: document.title, openid: window.HansenFriends._myOpenid() }; });
  console.log('[A] after opening friends page (openid known):', j(res));
  console.log(res.pwn ? 'FIRED even with openid known (UNCONDITIONAL)' : 'NOT fired — XSS gated by empty-openid window (CONDITIONAL)');
  await A.close(); await C.close();
} finally { await browser.close().catch(()=>{}); srv.close(); }
