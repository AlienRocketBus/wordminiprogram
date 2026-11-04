// NET-02 re-check: deploy 1163 -> 1164 while island HTML is slow (>8 s): does a 1163 island end up inside a 1164 home, mixed, uncorrected?
import { launch, ctxOf, watch, waitSw, tapIsland, waitIsland, start, SNAP, V1164, OUT, save, sleep } from './lib.mjs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
const isle = 'island_food.html';
const verProbe = () => {
  const f = document.getElementById('islandFrame'); const w = f && f.contentWindow;
  const pick = win => { try { return { gate: win.__hansenSwUpgradeGateV944 && win.__hansenSwUpgradeGateV944.version, backup: win.HansenBackup && win.HansenBackup.appVersion && win.HansenBackup.appVersion(), hbu: win.__HBU_VERSION__ || null, path: win.location.pathname, vw: win.HansenVersionWatch && win.HansenVersionWatch.status().note }; } catch (e) { return String(e).slice(0, 60); } };
  return { top: pick(window), frame: pick(w), ctl: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL.replace(location.origin, ''), wrap: document.getElementById('islandFrameWrap').style.display };
};
try {
  const ctx = await ctxOf(browser, { sw: true });
  let page = await ctx.newPage();
  await page.goto(O + '/', { waitUntil: 'load' });
  await waitSw(page); await sleep(2500);
  await page.reload({ waitUntil: 'load' }); await sleep(2000);
  await tapIsland(page, isle); await waitIsland(page, isle, 30000); await sleep(4000);
  R.before = await page.evaluate(verProbe);
  R.cachesBefore = await page.evaluate(() => caches.keys());
  await page.close();
  // deploy v1164 (media falls back to the snapshot), island HTML slow
  srv.cfg.roots = [V1164, SNAP];
  srv.cfg.rules = [{ re: '^/island_food\\.html$', delayMs: 10000 }];
  srv.take();
  page = await ctx.newPage();
  const ev = []; watch(page, ev, 'M');
  const navs = []; page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push({ t: Date.now(), u: f.url().replace(O, '') }); });
  const t0 = Date.now();
  await page.goto(O + '/', { waitUntil: 'load' });
  R.homeLoadedMs = Date.now() - t0;
  await page.evaluate(() => { try { history.replaceState(null, ''); } catch (e) {} });
  await tapIsland(page, isle);
  R.islandWait = await waitIsland(page, isle, 30000);
  srv.cfg.rules = [];
  R.timeline = [];
  for (let i = 1; i <= 12; i++) {
    await sleep(5000);
    const st = await page.evaluate(verProbe).catch(e => String(e).slice(0, 80));
    const cn = await page.evaluate(() => caches.keys()).catch(() => null);
    R.timeline.push({ t: Math.round((Date.now() - t0) / 1000), ...st, caches: cn && cn.map(x => x.replace('hansen-v944-', '')).join(',') });
  }
  R.mainNavs = navs.map(n => ({ dt: n.t - t0, u: n.u }));
  R.swFetches = srv.peek().filter(x => x.path.startsWith('/sw_v944.js')).map(x => ({ dt: x.t - t0, status: x.status }));
  // kid goes home and re-enters the same island (keep-alive): still the old document?
  await page.evaluate(() => window.closeIsland()); await sleep(1500);
  await tapIsland(page, isle); await sleep(2500);
  R.afterReenter = await page.evaluate(verProbe);
  R.vwTop = await page.evaluate(() => HansenVersionWatch.status());
  R.errs = ev.filter(e => e.k === 'pageerror').slice(0, 8);
  await page.screenshot({ path: OUT + '/s02_mixed.png' });
} catch (e) { R.fatal = String(e.stack || e).slice(0, 800); }
await browser.close(); await srv.close();
save('s02_result.json', R);
console.log(JSON.stringify(R, null, 1).slice(0, 9000));
