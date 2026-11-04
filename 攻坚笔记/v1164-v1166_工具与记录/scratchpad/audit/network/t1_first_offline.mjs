import { launch, newCtx, attach, cacheSummary, swState, waitSwActive, save, startServer, SNAP, OUT, sleep, openIslandTap, waitIsland } from './lib.mjs';

const srv = await startServer(SNAP);
const O = srv.origin;
const ev = [];
const R = {};
const browser = await launch();
try {
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();
  attach(page, 'home1', ev);
  // ---- 1. first visit at root "/"
  let t0 = Date.now();
  await page.goto(O + '/', { waitUntil: 'load', timeout: 60000 });
  R.firstLoadMs = Date.now() - t0;
  R.sw_first = await swState(page);
  R.swActivateMs = await waitSwActive(page);
  await sleep(1500);
  R.sw_afterActivate = await swState(page);
  R.log_first = srv.getLog().length;
  // let idle preheat run
  await sleep(12000);
  const lg = srv.getLog();
  R.preheatReqs = lg.filter(x => !/VERSION/.test(x.path)).map(x => x.path + ' ' + x.dest + ' ' + x.status).slice(0, 200);
  R.cache_afterFirst = await cacheSummary(page);
  R.vw1 = await page.evaluate(() => window.HansenVersionWatch && HansenVersionWatch.status());
  await page.screenshot({ path: OUT + '/t1_home_first.png' });

  // ---- 2. second visit online (controlled)
  await page.reload({ waitUntil: 'load' });
  await sleep(1500);
  R.sw_second = await swState(page);
  srv.getLog();
  // ---- 3. open island food online by tap
  R.tapFood = await openIslandTap(page, 'island_food.html');
  R.waitFood = await waitIsland(page, 'island_food.html', 30000);
  await sleep(4000);
  const lgI = srv.getLog();
  R.islandReqCount = lgI.length;
  R.islandHtmlReqs = lgI.filter(x => /\.html/.test(x.path)).map(x => x.path + ' ' + x.dest + ' ' + x.mode + ' ' + x.status);
  R.cache_afterIsland = await cacheSummary(page);
  await page.screenshot({ path: OUT + '/t1_island_online.png' });

  // ---- 4. offline: reload home
  await ctx.setOffline(true);
  ev.push({ tag: '---', kind: 'mark', text: 'OFFLINE from here' });
  t0 = Date.now();
  try { await page.reload({ waitUntil: 'load', timeout: 30000 }); } catch (e) { R.offlineReloadErr = String(e.message).slice(0, 200); }
  R.offlineReloadMs = Date.now() - t0;
  await sleep(3000);
  R.offlineHome = await page.evaluate(() => ({
    title: document.title,
    islands: document.querySelectorAll('a.island').length,
    bodyText: (document.body.innerText || '').slice(0, 300),
    globals: ['HansenVersionWatch', 'HansenIslandPrefetch', 'HansenToast', 'HansenBootCheck', 'HansenSilentWatch', 'HansenAuth', 'HansenDownloadFix', 'HansenPreloadPolicy', 'openIsland']
      .map(k => k + '=' + (typeof window[k]))
  }));
  await page.screenshot({ path: OUT + '/t1_home_offline.png' });
  // ---- 5. offline: open visited island (food)
  R.tapFoodOff = await openIslandTap(page, 'island_food.html');
  R.waitFoodOff = await waitIsland(page, 'island_food.html', 20000);
  await sleep(2500);
  R.foodOffline = await page.evaluate(() => {
    const d = document.getElementById('islandFrame').contentDocument;
    return { title: d.title, text: (d.body && d.body.innerText || '').slice(0, 200), imgsBroken: [...d.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')).slice(0, 20), nImgs: d.images.length };
  });
  await page.screenshot({ path: OUT + '/t1_food_offline.png' });
  // back home
  await page.evaluate(() => window.closeIsland && window.closeIsland());
  await sleep(800);
  // ---- 6. offline: open an unvisited island (animal)
  R.tapAnimalOff = await openIslandTap(page, 'island_animal.html');
  R.waitAnimalOff = await waitIsland(page, 'island_animal.html', 20000);
  await sleep(1500);
  R.animalOffline = await page.evaluate(() => {
    const d = document.getElementById('islandFrame').contentDocument;
    const w = document.getElementById('islandFrameWrap');
    return { title: d.title, text: (d.body && d.body.innerText || '').slice(0, 200), wrap: w.style.display,
      backButtonsInFrame: [...d.querySelectorAll('button,a')].map(b => b.textContent.trim()).slice(0, 10) };
  });
  await page.screenshot({ path: OUT + '/t1_animal_offline.png' });
  await page.close();
  await ctx.close();
} catch (e) { R.fatal = String(e.stack || e).slice(0, 800); }
await browser.close();
srv.server.close();
R.events = ev;
save('t1_result.json', R);
console.log(JSON.stringify({ ...R, cache_afterFirst: undefined, cache_afterIsland: undefined, preheatReqs: R.preheatReqs && R.preheatReqs.length, events: ev.length }, null, 1));
