import { launch, sleep, BASE } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
for (const f of ['island_land1.html','island_land3.html','island_land5.html','island_animal.html']) {
  await page.goto(BASE + f); await sleep(1500);
  console.log(f, await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(LISTEN_LEVEL_IDX).map(k => [k, LISTEN_LEVEL_IDX[k].length])))));
}
await browser.close();
