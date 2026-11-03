// NET-06 re-check: home island prefetch URL vs the URL openIsland actually loads; 404s from key->file mapping.
import { launch, ctxOf, tapIsland, waitIsland, start, SNAP, save, sleep } from './lib.mjs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
async function run(label, seed, sw) {
  const ctx = await ctxOf(browser, { sw });
  if (seed) await ctx.addInitScript(seed => { try { if (!sessionStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } } catch (e) {} }, seed);
  const page = await ctx.newPage();
  srv.take();
  await page.goto(O + '/', { waitUntil: 'load' });
  await sleep(15000);
  const homeLog = srv.take();
  const htmlReqs = homeLog.filter(x => /\.html/.test(x.path) && x.path !== '/' && !/^\/index\.html/.test(x.path)).map(x => `${x.path} dest=${x.dest} purpose=${x.purpose || '-'} status=${x.status} kb=${Math.round((x.size || 0) / 1024)}`);
  await tapIsland(page, 'island_food.html');
  const w = await waitIsland(page, 'island_food.html', 30000);
  await sleep(1500);
  const tapLog = srv.take().filter(x => /^\/island_food\.html/.test(x.path)).map(x => `${x.path} dest=${x.dest} status=${x.status} kb=${Math.round((x.size || 0) / 1024)}`);
  const ls = await page.evaluate(() => localStorage.getItem('lastIslandKey'));
  R[label] = { homeHtmlRequests: htmlReqs, islandOpenRequests: tapLog, waitMs: w.ms, lastIslandKeyAfter: ls };
  if (label === 'fresh_nosw') {
    // second home load after an island visit (lastIslandKey now set)
    await page.evaluate(() => window.closeIsland()); await sleep(800);
    srv.take();
    await page.goto(O + '/', { waitUntil: 'load' });
    await sleep(12000);
    R[label].secondHomeLoad = srv.take().filter(x => /\.html/.test(x.path) && x.path !== '/').map(x => `${x.path} status=${x.status}`);
  }
  await ctx.close();
}
try {
  await run('fresh_nosw', null, false);
  await run('returning_kid_nosw', { lastIslandKey: 'wordIslandPeople', wordIslandPeople: '{}', wordIslandColorNum: '{}', wordIslandVerbs: '{}', wordIslandFood: '{}' }, false);
  await run('fresh_sw', null, true);
} catch (e) { R.fatal = String(e.stack || e).slice(0, 800); }
await browser.close(); await srv.close();
save('s06_result.json', R);
console.log(JSON.stringify(R, null, 1).slice(0, 7000));
