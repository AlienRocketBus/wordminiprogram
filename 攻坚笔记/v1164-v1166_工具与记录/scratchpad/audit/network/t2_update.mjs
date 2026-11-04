import { launch, newCtx, attach, cacheSummary, swState, waitSwActive, save, startServer, SNAP, COPY, OUT, sleep, openIslandTap, waitIsland } from './lib.mjs';

const only = process.argv[2] || 'U1,U2,U3';
const srv = await startServer(SNAP);
const O = srv.origin;
const R = {};
const browser = await launch();

function trackNav(page, arr) {
  page.on('framenavigated', f => { if (f === page.mainFrame()) arr.push({ t: Date.now(), url: f.url().replace(O, '') }); });
}
async function versions(page) {
  return page.evaluate(() => {
    const top = { vw: window.HansenVersionWatch && HansenVersionWatch.status(), firstStamp: (document.querySelector('script[src*="?v="]') || {}).src, gate: window.__hansenSwUpgradeGateV944 && window.__hansenSwUpgradeGateV944.version, banner: !!document.getElementById('hsn_vw_bar'), fixed: localStorage.getItem('hansen_vw_autofixed'), url: location.pathname + location.search };
    let fr = null;
    try {
      const f = document.getElementById('islandFrame');
      const w = f.contentWindow;
      fr = { path: w.location.pathname, gate: w.__hansenSwUpgradeGateV944 && w.__hansenSwUpgradeGateV944.version, backup: w.HansenBackup && w.HansenBackup.appVersion(), stamp: (w.document.querySelector('script[src*="hansen_preload"]') || {}).src, title: w.document.title };
    } catch (e) { fr = String(e); }
    return { top, frame: fr };
  });
}
async function prime(ctx, label) {
  const p = await ctx.newPage();
  const ev = [];
  attach(p, label, ev);
  await p.goto(O + '/', { waitUntil: 'load' });
  await waitSwActive(p);
  await sleep(4000);
  await p.reload({ waitUntil: 'load' });
  await sleep(2000);
  const t = await openIslandTap(p, 'island_food.html');
  const w = await waitIsland(p, 'island_food.html', 30000);
  await sleep(2500);
  await p.evaluate(() => { const d = document.getElementById('islandFrame').contentDocument; const b = [...d.querySelectorAll('button')].find(x => /开始冒险/.test(x.textContent)); if (b) b.click(); });
  await p.evaluate(() => window.closeIsland());
  await sleep(1000);
  return { p, ev, t, w };
}

try {
  if (only.includes('U1')) {
    // ---------- U1: cold start after deploy ----------
    srv.cfg.root = SNAP; srv.cfg.version = null; srv.cfg.rules = [];
    const ctx = await newCtx(browser);
    const { p } = await prime(ctx, 'U1prime');
    R.U1_before = { sw: await swState(p), caches: Object.keys(await cacheSummary(p)), ver: await versions(p) };
    await p.close();
    srv.cfg.root = COPY; // deploy 1164
    const page = await ctx.newPage();
    const ev = []; attach(page, 'U1', ev);
    const navs = []; trackNav(page, navs);
    await page.goto(O + '/', { waitUntil: 'load' });
    await sleep(15000);
    R.U1_afterCold = { navs, sw: await swState(page), caches: Object.fromEntries(Object.entries(await cacheSummary(page)).map(([k, v]) => [k, v.n])), ver: await versions(page) };
    await openIslandTap(page, 'island_food.html');
    R.U1_food = await waitIsland(page, 'island_food.html', 30000);
    await sleep(3000);
    R.U1_afterIsland = { navs: navs.slice(), ver: await versions(page) };
    R.U1_events = ev.filter(e => !/VERSION/.test(e.text)).slice(0, 40);
    await ctx.close();
  }
  if (only.includes('U2')) {
    // ---------- U2: deploy while app is open on home; then kid opens another island ----------
    srv.cfg.root = SNAP; srv.cfg.version = null; srv.cfg.rules = [];
    const ctx = await newCtx(browser);
    const { p: page, ev } = await prime(ctx, 'U2');
    const navs = []; trackNav(page, navs);
    R.U2_before = await versions(page);
    srv.cfg.root = COPY; // deploy 1164 while open
    srv.getLog();
    const tTap = Date.now();
    R.U2_tap = await openIslandTap(page, 'island_animal.html');
    const samples = [];
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      try { samples.push({ dt: Date.now() - tTap, ...(await versions(page)) }); } catch (e) { samples.push({ dt: Date.now() - tTap, err: String(e.message).slice(0, 80) }); }
    }
    R.U2_samples = samples.map(s => ({ dt: s.dt, top: s.top && { local: s.top.vw && s.top.vw.local, server: s.top.vw && s.top.vw.server, banner: s.top.banner, url: s.top.url, gate: s.top.gate }, frame: s.frame && (typeof s.frame === 'string' ? s.frame : { path: s.frame.path, gate: s.frame.gate, backup: s.frame.backup }), err: s.err }));
    R.U2_navs = navs.map(n => ({ dt: n.t - tTap, url: n.url }));
    await page.screenshot({ path: OUT + '/t2_U2_end.png' });
    R.U2_end = { sw: await swState(page), caches: Object.fromEntries(Object.entries(await cacheSummary(page)).map(([k, v]) => [k, v.n])), ver: await versions(page) };
    // re-open island now
    await page.evaluate(() => window.closeIsland && window.closeIsland());
    await sleep(800);
    await openIslandTap(page, 'island_food.html');
    R.U2_food = await waitIsland(page, 'island_food.html', 30000);
    await sleep(2000);
    R.U2_final = await versions(page);
    R.U2_events = ev.filter(e => !/VERSION/.test(e.text)).slice(-40);
    await ctx.close();
  }
  if (only.includes('U3')) {
    // ---------- U3: CDN stale — VERSION says 1164 but HTML/JS are still 1163 ----------
    srv.cfg.root = SNAP; srv.cfg.version = null; srv.cfg.rules = [];
    const ctx = await newCtx(browser);
    const page = await ctx.newPage();
    const ev = []; attach(page, 'U3', ev);
    await page.goto(O + '/', { waitUntil: 'load' });
    await waitSwActive(page);
    await sleep(3000);
    const navs = []; trackNav(page, navs);
    srv.cfg.version = 1164;
    const t0 = Date.now();
    await page.reload({ waitUntil: 'load' });
    await sleep(20000);
    R.U3_navs1 = navs.map(n => ({ dt: n.t - t0, url: n.url }));
    R.U3_ver1 = await versions(page);
    // manual reload twice: should NOT auto-reload again
    await page.reload({ waitUntil: 'load' });
    await sleep(12000);
    await page.reload({ waitUntil: 'load' });
    await sleep(12000);
    R.U3_navsAll = navs.map(n => ({ dt: n.t - t0, url: n.url }));
    R.U3_ver2 = await versions(page);
    R.U3_sw = await swState(page);
    await ctx.close();
    srv.cfg.version = null;
  }
} catch (e) { R.fatal = String(e.stack || e).slice(0, 1000); }
await browser.close();
srv.server.close();
save('t2_result_' + only.replace(/,/g, '') + '.json', R);
console.log(JSON.stringify(R, null, 1).slice(0, 20000));
