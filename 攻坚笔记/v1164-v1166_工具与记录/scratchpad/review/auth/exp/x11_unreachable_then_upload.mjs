/* X11: cloud has 40 learned words (old phone). Kid logs in on a NEW phone that has 2 local words.
 * At login the cloud read fails once (mobile glitch) -> syncOnLogin 'cloud-unreachable' ("进度先留在本机").
 * Then the app's own autosync runs (here: the visibilitychange 'hidden' hook = kid switches app).
 * Is the cloud's 40-word save overwritten by the 2-word phone?  */
import * as H from './h2.mjs';
const srv = await H.startStaticAt(H.REPO);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 25 } });
const out = {};
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'old-phone' });
  await H.loginPhone(A, '13800001201');
  out.upA = await A.eval(async () => { localStorage.setItem('wordIsland_kidW', JSON.stringify({ learned: Array.from({ length: 40 }, (_, i) => i) })); return (await HansenCloudSave.syncNow({ force: true })).ok; });
  const B = await H.openPhone(browser, emu, srv.origin, { name: 'new-phone' });
  await B.eval(() => localStorage.setItem('wordIsland_kidW', JSON.stringify({ learned: [7, 8] })));
  const f = emu.fault({ collection: 'hansen_saves', action: 'database.queryDocument', do: 'abort', times: 2 });  // one glitchy read (+ its where() fallback)
  out.panel = await H.loginPhoneUI(B, '13800001201');
  out.faultHits = f.hits;
  const navs = []; B.page.on('framenavigated', (fr) => { if (fr === B.page.mainFrame()) navs.push(Date.now()); });
  const t0 = Date.now();
  /* the kid switches to another app for a moment -> the app's own 'hidden' hook uploads */
  try { await B.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); } catch (e) { out.hiddenErr = String(e.message).slice(0, 60); }
  await H.sleep(9000);
  out.navigationsAfterLogin = navs.map((t) => t - t0);
  await B.page.waitForFunction(() => !!window.HansenAuth, null, { timeout: 45000 }).catch(() => {});
  out.localB = await B.eval(() => (JSON.parse(localStorage.getItem('wordIsland_kidW') || '{}').learned || []).length);
  out.saveWritesByB = emu.writes.filter((w) => w.collection === 'hansen_saves' && w.uid === emu.uidOfLogin('+86 13800001201')).map((w) => w.op);
  /* what does the cloud hold now? read it back on the old phone */
  out.cloudNow = await A.eval(async () => { try { const g = await HansenCloudSave.fetchWithKey(HansenCloudSave.ensureKey()); const p = HansenBackup.parse(g.code); const it = p.items.find((x) => x.key === 'wordIsland_kidW'); return it ? JSON.parse(it.value).learned.length : 'no key'; } catch (e) { return 'ERR ' + String(e.message).slice(0, 80); } });
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
