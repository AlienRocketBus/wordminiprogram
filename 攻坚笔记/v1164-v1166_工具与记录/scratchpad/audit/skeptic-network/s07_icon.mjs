// NET-07 re-check: an icon whose content changes in a new release (same path, new ?v=) — does a returning player see the new one?
import { launch, ctxOf, waitSw, tapIsland, waitIsland, start, SNAP, V1164, save, sleep } from './lib.mjs';
import fs from 'node:fs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
const NEW = fs.readFileSync(SNAP + '/icons/hand_point.webp');   // 256x178 stands in for the redesigned icon (old one is 288x288)
const probe = async page => { const f = page.frames().find(x => x.url().includes('island_food.html')); return f.evaluate(() => [...document.querySelectorAll('img')].filter(i => /explore_3d\.webp/.test(i.getAttribute('src') || '')).map(i => ({ src: i.getAttribute('src'), w: i.naturalWidth, h: i.naturalHeight })).slice(0, 2)); };
try {
  const ctx = await ctxOf(browser, { sw: true });
  let page = await ctx.newPage();
  await page.goto(O + '/', { waitUntil: 'load' });
  await waitSw(page); await sleep(2000);
  await page.reload({ waitUntil: 'load' }); await sleep(2000);
  await tapIsland(page, 'island_food.html'); await waitIsland(page, 'island_food.html', 30000); await sleep(4000);
  R.v1163 = await probe(page);
  await page.close();
  srv.cfg.roots = [V1164, SNAP];
  srv.cfg.rules = [{ re: '^/icons/explore_3d\\.webp', status: 200, ctype: 'image/webp', body: NEW }];
  R.after = [];
  for (let i = 0; i < 3; i++) {
    page = await ctx.newPage();
    await page.goto(O + '/', { waitUntil: 'load' }); await sleep(6000);
    await tapIsland(page, 'island_food.html'); await waitIsland(page, 'island_food.html', 30000); await sleep(3000);
    R.after.push({ visit: i + 1, imgs: await probe(page), iconCache: await page.evaluate(async () => { const n = (await caches.keys()).find(k => /icons/.test(k)); const ks = n ? (await (await caches.open(n)).keys()).map(r => r.url.replace(location.origin, '')).filter(u => /explore_3d/.test(u)) : []; return { n, ks }; }), gate: await page.evaluate(() => __hansenSwUpgradeGateV944.version) });
    await page.close();
  }
  await ctx.close();
  // control: brand-new player after the deploy
  const c2 = await ctxOf(browser, { sw: true });
  page = await c2.newPage();
  await page.goto(O + '/', { waitUntil: 'load' }); await sleep(3000);
  await tapIsland(page, 'island_food.html'); await waitIsland(page, 'island_food.html', 30000); await sleep(3000);
  R.newPlayer = await probe(page);
  await c2.close();
} catch (e) { R.fatal = String(e.stack || e).slice(0, 600); }
await browser.close(); await srv.close();
save('s07_result.json', R);
console.log(JSON.stringify(R, null, 1));
