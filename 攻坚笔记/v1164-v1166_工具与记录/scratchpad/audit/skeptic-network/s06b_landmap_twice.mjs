// Missed-item check: in one session, is land_map downloaded twice (home warm 'land_map.html' vs island room 'land_map.html?v=1163')? + /VERSION calls per island open.
import { launch, ctxOf, tapIsland, waitIsland, start, SNAP, save, sleep } from './lib.mjs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
for (const sw of [false, true]) {
  const ctx = await ctxOf(browser, { sw });
  const page = await ctx.newPage();
  srv.take();
  await page.goto(O + '/', { waitUntil: 'load' });
  await sleep(15000);
  const home = srv.take();
  await tapIsland(page, 'island_food.html');
  await waitIsland(page, 'island_food.html', 30000);
  await sleep(20000);
  const isl = srv.take();
  R[sw ? 'sw' : 'nosw'] = {
    landMapOnHome: home.filter(x => x.path.startsWith('/land_map.html')).map(x => `${x.path} ${x.dest} ${x.status} ${Math.round((x.size || 0) / 1024)}KB`),
    landMapAfterIslandTap: isl.filter(x => x.path.startsWith('/land_map.html')).map(x => `${x.path} ${x.dest} ${x.status} ${Math.round((x.size || 0) / 1024)}KB`),
    versionChecksHome: home.filter(x => x.path.startsWith('/VERSION')).length,
    versionChecksAfterIslandTap: isl.filter(x => x.path.startsWith('/VERSION')).length
  };
  await ctx.close();
}
await browser.close(); await srv.close();
save('s06b_result.json', R);
console.log(JSON.stringify(R, null, 1));
