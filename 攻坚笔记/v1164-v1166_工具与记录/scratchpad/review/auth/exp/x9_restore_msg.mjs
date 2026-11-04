/* X9: kid has 40 learned words saved in the cloud; logs in on a phone that also has some local progress.
 * What does the login panel say about the restore?  (real UI taps) */
import * as H from './h2.mjs';
const srv = await H.startStaticAt(H.REPO);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 25 } });
const out = {};
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'old-phone' });
  await H.loginPhone(A, '13800001001');
  out.up = await A.eval(async () => {
    localStorage.setItem('wordIsland_kidZ', JSON.stringify({ learned: Array.from({ length: 40 }, (_, i) => i) }));
    const r = await HansenCloudSave.syncNow({ force: true }); return r.ok;
  });
  const B = await H.openPhone(browser, emu, srv.origin, { name: 'new-phone' });
  await B.eval(() => localStorage.setItem('wordIsland_kidZ', JSON.stringify({ learned: [1, 2] })));
  const said = await H.loginPhoneUI(B, '13800001001');
  out.panel = said;
  await H.sleep(2500);
  await B.page.waitForFunction(() => !!window.HansenAuth, null, { timeout: 45000 }).catch(() => {});
  out.afterReloadLearned = await B.eval(() => (JSON.parse(localStorage.getItem('wordIsland_kidZ') || '{}').learned || []).length);
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
