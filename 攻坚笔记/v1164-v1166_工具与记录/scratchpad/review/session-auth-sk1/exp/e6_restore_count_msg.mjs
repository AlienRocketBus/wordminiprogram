/* E6 (AUTH-6): the cloud holds 40 learned words for account A; a phone with 3 local words (played before logging in)
 * logs in to A through the real panel (taps).  What number does the panel announce, and what is restored?
 * Also reads accountCloudInfo() directly.  OLD=1 -> v1163 snapshot. */
import * as L from './lib.mjs';
const { H } = L;
const srv = await L.serve(L.ROOTSEL);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
const o = { ver: L.VER };
try {
  const P1 = await H.openPhone(browser, emu, srv.origin, { name: 'old-phone', ready: L.PK_READY });
  await H.loginPhone(P1, '13800000761');
  await L.seedProgress(P1, { key: 'wordIsland_kidX', learned: 40 });
  o.up = await P1.eval(async () => { const r = await HansenCloudSave.syncNow({ force: true }); return r.ok; });
  o.infoOnP1 = await P1.eval(() => HansenCloudSave.accountCloudInfo());
  await P1.close();
  const P2 = await H.openPhone(browser, emu, srv.origin, { name: 'new-phone', ready: L.PK_READY });
  await L.seedProgress(P2, { key: 'wordIsland_kidY', learned: 3 });
  o.panel = await H.loginPhoneUI(P2, '13800000761');
  await H.sleep(3000);
  await P2.page.waitForFunction(L.PK_READY, null, { timeout: 45000 });
  await H.sleep(800);
  o.afterReload = await P2.eval(() => Object.keys(localStorage).filter((k) => /^wordIsland/.test(k)).map((k) => k + ':' + (JSON.parse(localStorage.getItem(k)).learned || []).length));
} catch (e) { o.thrown = String(e && e.stack || e).slice(0, 900); }
L.out(o);
await browser.close(); srv.close(); process.exit(0);
