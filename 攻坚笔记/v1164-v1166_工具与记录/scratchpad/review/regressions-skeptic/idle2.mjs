/* Which module instances produce the presence writes? Stop the beat in sub-frames and re-count.
 * Also: v1163 with a cid injected (fair comparison).  MODE=split|inject */
const H = await import(process.env.HARNESS || '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs');
const MODE = process.env.MODE || 'split';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 40, jitterMs: 40, consistencyLagMs: 300 } });
const p = await H.openPhone(browser, emu, srv.origin, { name: 'kid', ready: () => !!(window.HansenAuth && window.HansenSbProfile) });
const r = await H.loginPhone(p, '1381111' + String(Math.floor(Math.random() * 9000) + 1000));
let prof = await p.eval(async () => {
  try { window.HansenSbProfile.setName('小测'); } catch (e) {}
  for (let i = 0; i < 40 && !((window.HansenSbProfile.readProfile() || {}).cid); i++) await new Promise((z) => setTimeout(z, 250));
  return window.HansenSbProfile.readProfile();
});
if (!(prof && prof.cid)) {
  /* v1163 never got a cid in this emulator: give the kid one, as a kid who had one before would */
  await p.eval(() => { const k = 'hansen_sb_profile_v1002'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.cid = 7; o.cidLocked = true; o.name = o.name || '小测'; localStorage.setItem(k, JSON.stringify(o)); });
  prof = await p.eval(() => window.HansenSbProfile.readProfile());
  console.log('injected cid', prof.cid);
}
console.log('login ok', !!(r && r.ok), 'cid', prof.cid);
const count = (t0, t1) => { const o = {}; for (const e of emu.log) { if (e.t < t0 || e.t >= t1 || e.method === 'OPTIONS') continue; const k = (e.action || e.path).replace('database.', '') + ' ' + (e.collection || ''); o[k] = (o[k] || 0) + 1; } return o; };
await p.page.goto(srv.origin + '/island_animal.html', { waitUntil: 'domcontentloaded' });
await H.sleep(12000);
let t0 = Date.now(); await H.sleep(60000);
console.log('A) all frames running, 60 s:', JSON.stringify(count(t0, Date.now())));
if (MODE === 'split') {
  const top = p.page.mainFrame();
  let stopped = 0;
  for (const f of p.page.frames()) { if (f === top) continue; try { if (await f.evaluate(() => { if (window.HansenFriends) { window.HansenFriends._stopBeat(); return true; } return false; })) stopped++; } catch (e) {} }
  console.log('stopped beat in', stopped, 'sub-frames');
  t0 = Date.now(); await H.sleep(60000);
  console.log('B) only top-frame beat, 60 s:', JSON.stringify(count(t0, Date.now())));
  await top.evaluate(() => window.HansenFriends._stopBeat());
  t0 = Date.now(); await H.sleep(40000);
  console.log('C) no beat at all, 40 s:', JSON.stringify(count(t0, Date.now())));
}
await p.close(); srv.close(); await browser.close();
