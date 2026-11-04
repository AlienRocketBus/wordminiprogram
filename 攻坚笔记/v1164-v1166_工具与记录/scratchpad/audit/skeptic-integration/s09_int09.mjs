// INT-09: from a land island, phone back vs the map button
import { sleep, tap } from './kit.mjs';
import { boot2 } from './kit2.mjs';
import { islandState, waitVisible, waitHidden, frameOf, dismissWelcome, tapMap, freshHome } from './nav.mjs';
const K = await boot2({ cache: 'public, max-age=3600' });
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
const out = (...a) => console.log(...a);
await freshHome(K, page);
await sleep(1500);
async function toLand1() {
  let t0 = Date.now();
  const r = await tap(page, page, '#hsnSeasonBar');
  const v = await waitVisible(page, 'land_map.html', t0);
  out('season bar ->', JSON.stringify(r.topHit), 'land_map visible', v.ms, 'state', v.s.state);
  await sleep(1200);
  let fr = await frameOf(page);
  await tap(page, fr, '.spot');
  await sleep(700);
  t0 = Date.now();
  await tap(page, fr, '#pfoot .pbtn.enter');
  const v2 = await waitVisible(page, 'island_land1.html', t0);
  out('进入学习 -> island_land1 visible', v2.ms, 'state', v2.s.state, 'hist', v2.s.hist);
  await dismissWelcome(page, 3000);
  await sleep(1000);
}
await toLand1();
await page.evaluate(() => history.back());
await sleep(1500);
out('PHONE BACK from island_land1 ->', JSON.stringify(await islandState(page)));
// re-open via the season bar for the map-button path
await toLand1();
await tapMap(page);
await sleep(2000);
out('MAP BUTTON from island_land1 ->', JSON.stringify(await islandState(page)));
const fr = await frameOf(page);
const back = await fr.$('#backBtn');
if (back) { await tap(page, fr, back); await sleep(1500); out('land_map 返回 ->', JSON.stringify(await islandState(page))); }
out('pageerrors', JSON.stringify(errs));
await K.done();
