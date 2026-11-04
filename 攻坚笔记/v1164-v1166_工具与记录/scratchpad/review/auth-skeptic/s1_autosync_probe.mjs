/* Why did the app's own autosync not upload after a learned-word write on spelling_pk.html? */
import * as H from './lib.mjs';
const ROOT = H.ROOTSEL();
const srv = await H.serve(ROOT);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
const out = {};
try {
  const PAGE = process.env.PAGE || '/spelling_pk.html';
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'kid', path: PAGE,
    ready: () => !!(window.HansenAuth && window.HansenCloudSave && window.HansenBackup) });
  await ph.eval(() => { window.__dc = 0; document.addEventListener('hsn-data-changed', () => window.__dc++); });
  const lg = await H.loginPhone(ph, '13800009902');
  out.login = { ok: lg.ok, uid: lg.uid };
  await H.sleep(1500);
  out.pre = await ph.eval(() => ({ dc: window.__dc, state: JSON.parse(localStorage.getItem('hansen_cloud_state_v965') || '{}'),
    owned: window.HansenBackup && HansenBackup.isOwnedKey ? HansenBackup.isOwnedKey('wordIslandFood') : 'n/a',
    hooked: !!(localStorage.setItem && localStorage.setItem.__hsnMine), protoMine: !!(Storage.prototype.setItem && Storage.prototype.setItem.__hsnMine) }));
  await ph.eval(() => localStorage.setItem('wordIslandFood', JSON.stringify({ learned: ['a', 'b', 'c'], stats: {} })));
  await H.sleep(12000);
  out.post = await ph.eval(() => ({ dc: window.__dc, state: JSON.parse(localStorage.getItem('hansen_cloud_state_v965') || '{}') }));
  out.saves = (emu.dump('hansen_saves') || []).length;
  out.dbLog = emu.log.filter((e) => e.path === '/web').map((e) => `${e.action} ${e.collection} ${e.status} ${e.code || ''}`).slice(-12);
  // and what does a manual force sync say?
  out.manual = await ph.eval(async () => { const r = await HansenCloudSave.syncNow({ force: true }); return { ok: r.ok, reason: r.reason, error: r.error }; });
  out.saves2 = (emu.dump('hansen_saves') || []).length;
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 600); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
