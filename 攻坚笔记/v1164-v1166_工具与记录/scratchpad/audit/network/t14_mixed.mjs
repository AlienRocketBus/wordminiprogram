import { launch, newCtx, attach, swState, waitSwActive, save, startServer, SNAP, COPY, OUT, sleep, openIslandTap, waitIsland } from './lib.mjs';
// Right after a deploy, on a slow link: can a v1163 island (from the old SW page cache) end up inside a v1164 home and stay there?
const srv = await startServer(SNAP);
const O = srv.origin;
const R = {};
const browser = await launch();
try {
  const ctx = await newCtx(browser);
  let page = await ctx.newPage();
  await page.goto(O + '/', { waitUntil: 'load' });
  await waitSwActive(page);
  await sleep(3000);
  await page.reload({ waitUntil: 'load' });
  await sleep(1500);
  await openIslandTap(page, 'island_food.html');
  await waitIsland(page, 'island_food.html', 30000);
  await sleep(3000);
  await page.close();
  srv.cfg.root = COPY;                       // deploy v1164
  srv.cfg.rules = [{ re: '^/island_food\\.html$', delayMs: 10000 }];   // island HTML slow (>8 s)
  page = await ctx.newPage();
  const ev = []; attach(page, 'M', ev);
  await page.goto(O + '/', { waitUntil: 'load' });
  // kid taps the island quickly (before/while the new SW installs)
  await page.evaluate(() => { try { history.replaceState(null, ''); } catch (e) {} });
  await openIslandTap(page, 'island_food.html');
  await waitIsland(page, 'island_food.html', 30000);
  await sleep(1000);
  srv.cfg.rules = [];
  const tDeployNav = Date.now();
  R.timeline = [];
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const l = srv.peekLog().filter(x => x.path === '/sw_v944.js').length;
    const st = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); const w = document.getElementById('islandFrame').contentWindow; return { caches: (await caches.keys()).join(','), installing: !!(r && r.installing), waiting: !!(r && r.waiting), frameVer: w.HansenBackup && w.HansenBackup.appVersion() }; });
    R.timeline.push({ t: (i + 1) * 5, swScriptFetches: l, ...st });
  }
  R.state = await page.evaluate(() => {
    const w = document.getElementById('islandFrame').contentWindow;
    return { top: { gate: window.__hansenSwUpgradeGateV944.version, vw: HansenVersionWatch.status() }, frame: { gate: w.__hansenSwUpgradeGateV944 && w.__hansenSwUpgradeGateV944.version, backup: w.HansenBackup && w.HansenBackup.appVersion(), vwNote: w.HansenVersionWatch && w.HansenVersionWatch.status().note, firstScript: (w.document.querySelector('script[src*="?v="]') || {}).src } };
  });
  R.sw = await swState(page);
  R.cacheNames = await page.evaluate(() => caches.keys());
} catch (e) { R.fatal = String(e.stack || e).slice(0, 800); }
await browser.close(); srv.server.close();
save('t14_result_long.json', R);
console.log(JSON.stringify(R, null, 1));
