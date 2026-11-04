/* X3: account switch on ONE device: phone account A -> 退出登录 -> username account B (console-created).
 * Does B get its own cloud identity, or does the leftover `phone` in the local marker make B use A's cloud save?
 * OLD=1 runs the v1163 snapshot. MODE=rules|legacy (emulator permission style). */
import * as H from './h2.mjs';

const ROOT = process.env.OLD ? H.V1163 : H.REPO;
const srv = await H.startStaticAt(ROOT);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 20, permissionMode: process.env.MODE || 'legacy' } });
const B = emu.seedUser({ username: 'kid_b01', password: 'pw123456', name: 'B' });
const out = { root: ROOT, mode: emu.knobs.permissionMode };
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'dev' });
  const la = await H.loginPhone(ph, '13800000401');
  out.A = { ok: la.ok, uid: la.uid };
  out.upA = await ph.eval(async () => {
    localStorage.setItem('wordIsland_kidA', JSON.stringify({ learned: [1, 2, 3, 4, 5, 6, 7, 8] }));
    const r = await HansenCloudSave.syncNow({ force: true });
    return { ok: r && r.ok, reason: r && r.reason, ident: HansenCloudSave.accountUid() };
  });
  out.signOut = await ph.eval(async () => { await HansenAuth.signOut(); return HansenAuth.readLocal(); });
  /* B logs in with username + password (the login-only tab v1164 keeps) */
  out.loginB = await ph.eval(async () => {
    try { const r = await HansenAuth.loginByPassword('kid_b01', 'pw123456'); return { ok: true, uid: r.uid, sync: r.sync }; }
    catch (e) { return { ok: false, err: String(e && e.message || e) }; }
  });
  out.B_uid = B.uid;
  out.afterB = await ph.eval(() => ({
    marker: HansenAuth.readLocal(),
    cloudIdent: HansenCloudSave.accountUid(),
    localA: localStorage.getItem('wordIsland_kidA'),
    owner: localStorage.getItem('hansen_local_progress_owner_v1143'),
  }));
  /* what the 已登录 panel tells B */
  out.panel = await ph.eval(() => { HansenAuthUI.open(); const c = document.querySelector('#hsn_auth_panel .au_card'); return c ? c.innerText.replace(/\s+/g, ' ').slice(0, 120) : null; });
  out.upB = await ph.eval(async () => { const r = await HansenCloudSave.syncNow({ force: true }); return { ok: r && r.ok, reason: r && r.reason, error: r && r.error }; });
  out.saves = (emu.dump('hansen_saves') || []).map((d) => ({ id: String(d._id).slice(0, 10), owner: d._openid === la.uid ? 'A' : (d._openid === B.uid ? 'B' : d._openid) }));
  out.foreignWrites = emu.foreign.filter((f) => f.collection === 'hansen_saves').map((f) => ({ who: f.uid === B.uid ? 'B' : f.uid, action: f.action, owners: f.owners.map((o) => (o === la.uid ? 'A' : o)) }));
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close();
process.exit(0);
