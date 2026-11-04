/* Home map after visiting one island and closing it, kid signed in WITH progress: what keeps writing to the cloud? */
const H = await import(process.env.HARNESS || '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 40, jitterMs: 40, consistencyLagMs: 300 } });
const p = await H.openPhone(browser, emu, srv.origin, { name: 'kid', ready: () => !!(window.HansenAuth && window.HansenSbProfile) });
await H.loginPhone(p, '1385555' + String(Math.floor(Math.random() * 9000) + 1000));
let prof = await p.eval(async () => { try { window.HansenSbProfile.setName('小测'); } catch (e) {} for (let i = 0; i < 40 && !((window.HansenSbProfile.readProfile() || {}).cid); i++) await new Promise((z) => setTimeout(z, 250)); return window.HansenSbProfile.readProfile(); });
if (!(prof && prof.cid)) { await p.eval(() => { const k = 'hansen_sb_profile_v1002'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.cid = 7; o.cidLocked = true; o.name = o.name || '小测'; localStorage.setItem(k, JSON.stringify(o)); }); }
/* the kid has learned 3 animal words before */
await p.eval(() => localStorage.setItem('wordIslandAnimal', JSON.stringify({ learned: [0, 1, 2] })));
await p.page.goto(srv.origin + '/index.html', { waitUntil: 'domcontentloaded' });
await p.page.waitForFunction(() => !!document.getElementById('islandFrame'), null, { timeout: 45000 });
await H.sleep(2000);
await p.eval(() => { openIsland('island_animal.html'); });
await H.sleep(15000);
await p.eval(() => { closeIsland(); });
await H.sleep(8000);
const disp = await p.eval(() => getComputedStyle(document.getElementById('islandFrameWrap')).display);
const dbg = await p.page.frames().find((f) => /island_animal/.test(f.url())).evaluate(async () => {
  const k = 'wordIslandAnimal'; let o = null; try { o = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) {}
  const r = await window.HansenCloudSave.syncNow({ force: true });
  return { learned: o && o.learned, sync: r, keys: Object.keys(localStorage).filter((x) => /^hsn_progress/.test(x)) };
});
console.log('debug island frame:', JSON.stringify(dbg).slice(0, 400));
const t0 = Date.now(); await H.sleep(60000); const t1 = Date.now();
const o = {};
for (const e of emu.log) { if (e.t < t0 || e.t >= t1 || e.method === 'OPTIONS') continue; const k = (e.action || e.path).replace('database.', '') + ' ' + (e.collection || ''); o[k] = (o[k] || 0) + 1; }
console.log(`home map, island closed (wrap display=${disp}), 60 s:`, JSON.stringify(o));
await p.close(); srv.close(); await browser.close();
