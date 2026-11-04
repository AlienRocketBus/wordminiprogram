/* Why did the cloud-save experiment see zero uploads? Ask syncNow directly. */
const H = await import(process.env.HARNESS || '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs');
const PAGE = process.env.PAGE || '/island_animal.html';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 40, jitterMs: 40, consistencyLagMs: 300 } });
const p = await H.openPhone(browser, emu, srv.origin, { name: 'kid', ready: () => !!(window.HansenAuth && window.HansenSbProfile) });
const r = await H.loginPhone(p, '1383333' + String(Math.floor(Math.random() * 9000) + 1000));
console.log('login', !!(r && r.ok));
await p.page.goto(srv.origin + PAGE, { waitUntil: 'domcontentloaded' });
await H.sleep(12000);
const st = await p.eval(async () => {
  const out = {};
  out.keys = Object.keys(localStorage).filter((k) => /^wordIsland/.test(k));
  out.vals = out.keys.map((k) => (localStorage.getItem(k) || '').slice(0, 120));
  out.csState = (() => { try { return JSON.parse(localStorage.getItem('hansen_cloud_save_v965') || 'null'); } catch (e) { return 'ERR'; } })();
  out.csKeys = Object.keys(localStorage).filter((k) => /cloud/i.test(k));
  localStorage.setItem('wordIsland_animal_probe', JSON.stringify({ learned: ['cat', 'dog'] }));
  out.sync1 = await window.HansenCloudSave.syncNow({ force: true });
  out.sync2 = await window.HansenCloudSave.syncNow({ force: true });
  out.sync3 = await window.HansenCloudSave.syncNow({});
  return out;
});
console.log(JSON.stringify(st, null, 1).slice(0, 3000));
const saves = emu.log.filter((e) => e.method !== 'OPTIONS' && e.collection === 'hansen_saves').map((e) => (e.action || '').replace('database.', '') + ' ' + (e.code || e.status));
console.log('hansen_saves requests overall:', saves.length, saves.slice(-8).join(' | '));
await p.close(); srv.close(); await browser.close();
