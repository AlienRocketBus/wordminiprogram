// NET-04 mechanism: does sw_v944.js trim() over-delete under concurrent put/trim with re-puts (refresh of cached code)?
import { launch, ctxOf, start, SNAP, save } from './lib.mjs';
const srv = await start([SNAP]);
const browser = await launch();
const ctx = await ctxOf(browser, { sw: false });
const page = await ctx.newPage();
await page.goto(srv.origin + '/VERSION');
const R = await page.evaluate(async () => {
  // exact copy of sw_v944.js trim()
  async function trim(cacheName, maxEntries) { const cache = await caches.open(cacheName); const keys = await cache.keys(); while (keys.length > maxEntries) await cache.delete(keys.shift()); }
  async function put(name, url, max) { const c = await caches.open(name); await c.put(new Request(url), new Response('x' + url)); await trim(name, max); }
  const out = {};
  // scenario A: 72 cached, then 10 NEW urls arrive concurrently (no re-puts)
  for (const [label, nNew, nRe] of [['A_new_only', 10, 0], ['B_new_plus_refresh', 10, 40], ['C_refresh_only_after_1_new', 1, 60]]) {
    const name = 'race-' + label; await caches.delete(name);
    const c = await caches.open(name);
    for (let i = 0; i < 72; i++) await c.put(new Request('/k' + i + '.js'), new Response('k'));
    const jobs = [];
    for (let i = 0; i < nNew; i++) jobs.push(put(name, '/new' + i + '.js', 72));
    for (let i = 0; i < nRe; i++) jobs.push(put(name, '/k' + (i % 72) + '.js', 72));   // page re-requests cached code -> SW re-puts
    await Promise.all(jobs);
    const left = (await c.keys()).length;
    out[label] = { cap: 72, distinctUrlsEverPut: 72 + nNew, left };
  }
  return out;
});
await browser.close(); await srv.close();
save('s04b_result.json', R);
console.log(JSON.stringify(R, null, 1));
