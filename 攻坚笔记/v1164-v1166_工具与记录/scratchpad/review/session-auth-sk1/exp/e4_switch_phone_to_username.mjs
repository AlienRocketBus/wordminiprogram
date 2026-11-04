/* E4 (AUTH-4): one device, kid A logs in by phone and plays, taps 退出登录; kid B logs in with a console-created
 * username account (by taps in the login panel).  Which cloud save does B get, what does the panel show, where do B's
 * uploads go?  PERM=legacy|rules.  OLD=1 -> v1163 snapshot. */
import * as L from './lib.mjs';
const { H } = L;
const PERM = process.env.PERM || 'legacy';
const srv = await L.serve(L.ROOTSEL);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30, permissionMode: PERM } });
const B = emu.seedUser({ username: 'kidb01', password: 'pw123456', name: 'B' });
const o = { ver: L.VER, perm: PERM, uidB: B.uid };
const panel = (ph) => ph.eval(() => { const c = document.querySelector('#hsn_auth_panel .au_card'); return c ? c.innerText.replace(/\s+/g, ' ').slice(0, 140) : null; });
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'shared', ready: L.PK_READY });
  const la = await H.loginPhone(ph, '13800000731');
  o.uidA = la.uid;
  await L.seedProgress(ph, { key: 'wordIsland_A', learned: 8 });
  o.upA = await ph.eval(async () => { const r = await HansenCloudSave.syncNow({ force: true }); return { ok: r.ok, reason: r.reason || '', error: r.error || '' }; });
  o.identA = await ph.eval(() => HansenCloudSave.accountUid());
  /* A taps 退出登录 in the panel */
  await ph.eval(() => HansenAuthUI.open());
  await ph.tap('#auOut');
  await H.sleep(2500);
  o.markerAfterSignout = await ph.eval(() => HansenAuth.readLocal());
  /* B logs in with username + password by taps */
  await ph.eval(() => { HansenAuthUI.close(); HansenAuthUI.open({ mode: 'password' }); });
  await H.sleep(300);
  if (!(await ph.hitTest('#auUser', { timeout: 1500 })).ok) await ph.tap('.au_tab[data-m="password"]');
  await ph.tap('#auUser'); await ph.type('kidb01');
  await ph.tap('#auPwd'); await ph.type('pw123456');
  await ph.tap('#auGo');
  o.loginBPanel = await H.authPanelMsg(ph);
  await H.sleep(2500);   // the panel reloads the page 1.2 s after "restored"
  await ph.page.waitForFunction(L.PK_READY, null, { timeout: 45000 });
  await H.sleep(1500);
  o.markerB = await ph.eval(() => HansenAuth.readLocal());
  o.identB = await ph.eval(() => HansenCloudSave.accountUid());
  o.sessionB = await ph.eval(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, uid: s.uid }; });
  o.deviceNow = await ph.eval(() => Object.keys(localStorage).filter((k) => /^wordIsland/.test(k)).map((k) => k + ':' + (JSON.parse(localStorage.getItem(k)).learned || []).length));
  await ph.eval(() => HansenAuthUI.open());
  o.signedInPanelB = await panel(ph);
  await ph.eval(() => HansenAuthUI.close());
  /* B plays and the app uploads */
  await L.seedProgress(ph, { key: 'wordIsland_B', learned: 6 });
  const wBefore = emu.writes.length, fBefore = emu.foreign.length;
  o.upB = await ph.eval(async () => { const r = await HansenCloudSave.syncNow({ force: true }); return { ok: r.ok, reason: r.reason || '', error: String(r.error || '').slice(0, 120) }; });
  o.writesByB = emu.writes.slice(wBefore).filter((w) => w.collection === 'hansen_saves').map((w) => ({ op: w.op, by: w.uid === B.uid ? 'B' : (w.uid === la.uid ? 'A' : w.uid) }));
  o.foreignByB = emu.foreign.slice(fBefore).map((f) => ({ by: f.uid === B.uid ? 'B' : f.uid, collection: f.collection, owners: f.owners.map((x) => (x === la.uid ? 'A' : x)) }));
  o.savesDocsOwners = (emu.dump('hansen_saves') || []).map((d) => (d._openid === la.uid ? 'A' : d._openid === B.uid ? 'B' : d._openid));
  o.errors = ph.errors.slice(0, 3);
} catch (e) { o.thrown = String(e && e.stack || e).slice(0, 900); }
L.out(o);
await browser.close(); srv.close(); process.exit(0);
