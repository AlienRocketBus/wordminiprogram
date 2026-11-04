import { launch, newCtx, attach, cacheSummary, swState, waitSwActive, save, startServer, SNAP, COPY, OUT, sleep, openIslandTap, waitIsland } from './lib.mjs';
// Icon changed in v1164 (same filename, new ?v= stamp). Does a returning player see the new icon?
const srv = await startServer(SNAP);
const O = srv.origin;
const R = { runs: [] };
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
  const probe = async (label) => {
    const f = page.frames().find(fr => /island_food\.html/.test(fr.url()));
    const r = await f.evaluate(() => { const im = [...document.images].find(i => /explore_3d/.test(i.getAttribute('src') || '')); return im ? { src: im.getAttribute('src'), w: im.naturalWidth } : null; });
    const c = await page.evaluate(async () => { const out = []; for (const n of await caches.keys()) { const cc = await caches.open(n); for (const k of await cc.keys()) if (/explore_3d/.test(k.url)) out.push(n + ' ' + k.url.replace(location.origin, '')); } return out; });
    R.runs.push({ label, img: r, cacheEntries: c });
  };
  await probe('v1163 baseline');
  await page.close();
  srv.cfg.root = COPY;
  for (let i = 1; i <= 3; i++) {
    page = await ctx.newPage();
    await page.goto(O + '/', { waitUntil: 'load' });
    await sleep(6000);
    await openIslandTap(page, 'island_food.html');
    await waitIsland(page, 'island_food.html', 30000);
    await sleep(3000);
    await probe('after deploy, visit ' + i);
    await page.close();
  }
} catch (e) { R.fatal = String(e.stack || e).slice(0, 800); }
await browser.close(); srv.server.close();
save('t9_result.json', R);
console.log(JSON.stringify(R, null, 1));
