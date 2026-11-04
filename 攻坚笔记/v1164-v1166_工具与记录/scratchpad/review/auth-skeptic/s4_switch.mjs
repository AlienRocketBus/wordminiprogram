/* S4 (AUTH-4): shared device. Kid A (phone) plays + uploads, taps 退出登录; kid B logs in with a console-created
 * USERNAME account through the 用户名登录 tab. Whose cloud save does B get, what does the panel show, where do B's
 * uploads go?  MODE=rules → security-rules permission semantics.  OLD=1 → v1163. */
import * as H from './lib.mjs';
const ROOT = H.ROOTSEL();
const srv = await H.serve(ROOT);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30, permissionMode: process.env.MODE === 'rules' ? 'rules' : 'legacy' } });
const B = emu.seedUser({ username: 'kidbee', password: 'bee12345', name: 'kidbee' });
const out = { ver: process.env.OLD ? 'v1163' : 'v1164', mode: emu.knobs.permissionMode, uidB: B.uid };
const play = (ph, key, n) => ph.eval(([key, n]) => { const a = []; for (let i = 0; i < n; i++) a.push(i); localStorage.setItem(key, JSON.stringify({ learned: a, stats: {} })); }, [key, n]);
const look = (ph) => ph.eval(() => {
  const lc = JSON.parse(localStorage.getItem('hansen_auth_v1004') || '{}');
  const food = JSON.parse(localStorage.getItem('wordIslandFood') || '{}');
  const home = JSON.parse(localStorage.getItem('wordIslandHome') || '{}');
  return { marker: { method: lc.method, phone: lc.phone || '', username: lc.username || '', uid: lc.uid || '' },
           ident: window.HansenCloudSave ? HansenCloudSave.accountUid() : '?', foodLearned: (food.learned || []).length,
           homeLearned: (home.learned || []).length, owner: localStorage.getItem('hansen_local_progress_owner_v1143') || '',
           acct: ((document.getElementById('pkAcct') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 80) };
});
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'shared' });
  // ── kid A: phone
  out.loginA = await H.loginPhoneUI(ph, '13800009931');
  const uidA = emu.uidOfLogin('+86 13800009931');
  out.uidA = uidA;
  try { await ph.tap('#auX', { timeout: 3000 }); } catch (e) {}
  await play(ph, 'wordIslandFood', 6);           // A's progress (food island)
  await H.until(async () => (emu.dump('hansen_saves') || []).length > 0, { timeout: 25000, interval: 500 });
  await H.sleep(1500);
  out.aSaved = (emu.dump('hansen_saves') || []).map((d) => ({ id: d._id.slice(0, 10), owner: d._openid === uidA ? 'A' : d._openid }));
  // ── A taps 退出登录
  await ph.tap('#pkOut');
  await H.sleep(7000);
  out.afterSignOut = await look(ph);
  // ── kid B: username tab
  await ph.tap('#pkReg');
  await ph.tap('.au_tab[data-m="password"]');
  await ph.tap('#auUser'); await ph.type('kidbee');
  await ph.tap('#auPwd'); await ph.type('bee12345');
  await ph.tap('#auGo');
  out.loginBMsg = await H.authPanelMsg(ph);
  await H.sleep(2500);
  try { await ph.page.waitForFunction(() => !!(window.HansenAuth && window.HansenCloudSave && document.readyState !== 'loading'), null, { timeout: 30000 }); } catch (e) {}
  await H.sleep(2500);
  out.afterLoginB = await look(ph);
  // what the 已登录 panel shows B
  await ph.eval(() => HansenAuthUI.open());
  await H.sleep(500);
  out.panelB = ((await ph.eval(() => (document.getElementById('hsn_auth_panel') || {}).innerText || '')) || '').replace(/\s+/g, ' ').slice(0, 120);
  await ph.eval(() => HansenAuthUI.close());
  // ── B plays on a different island → autosync
  const f0 = emu.foreign.length, w0 = emu.writes.filter((w) => w.collection === 'hansen_saves').length;
  await play(ph, 'wordIslandHome', 8);
  await H.sleep(12000);
  out.bUpload = await ph.eval(async () => { const r = await HansenCloudSave.syncNow({ force: true }); return { ok: r.ok, reason: r.reason || '', error: String(r.error || '').slice(0, 90) }; });
  out.foreignWritesByB = emu.foreign.slice(f0).filter((f) => f.collection === 'hansen_saves').map((f) => ({ by: f.uid === B.uid ? 'B' : f.uid, owners: f.owners.map((o) => (o === uidA ? 'A' : o)), action: f.action }));
  out.savesWritesByB = emu.writes.filter((w) => w.collection === 'hansen_saves').slice(w0).map((w) => `${w.uid === B.uid ? 'B' : w.uid} ${w.op}`);
  out.savesDocs = (emu.dump('hansen_saves') || []).map((d) => ({ id: d._id.slice(0, 10), owner: d._openid === uidA ? 'A' : (d._openid === B.uid ? 'B' : d._openid) }));
  out.errors = ph.errors.slice(0, 3);
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 900); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
