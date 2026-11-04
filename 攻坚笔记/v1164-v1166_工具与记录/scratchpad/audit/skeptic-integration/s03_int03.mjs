// INT-03: "最近探险的岛屿" card after a new player visits only 动物
import { sleep, tap } from './kit.mjs';
import { boot2 } from './kit2.mjs';
import { islandState, waitVisible, waitHidden, frameOf, dismissWelcome, tapMap, freshHome } from './nav.mjs';
const waitIn = Number(process.argv[2] || 8000);
const K = await boot2({ cache: 'public, max-age=3600' });
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
const out = (...a) => console.log(...a);
await freshHome(K, page);
await sleep(1500);
const card = async () => page.evaluate(() => { const el = document.getElementById('recentLearnStat'); return { text: (document.getElementById('recentNum') || {}).textContent, target: el && el._target }; });
out('recent card before any island:', JSON.stringify(await card()));
const t0 = Date.now();
await tap(page, page, 'a.island[href="island_animal.html"]');
await waitVisible(page, 'island_animal.html', t0);
await dismissWelcome(page);
await sleep(waitIn);
await tapMap(page); await waitHidden(page, Date.now()); await sleep(800);
const ls = await page.evaluate(() => {
  const o = { lastIslandKey: localStorage.getItem('lastIslandKey'), lastIslandTime: +localStorage.getItem('lastIslandTime') };
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^wordIsland[A-Z][a-zA-Z0-9]*$/.test(k)) { try { o[k] = JSON.parse(localStorage.getItem(k)).lastSaveTime; } catch (e) { o[k] = 'unparsable'; } } }
  return o;
});
out('localStorage times after closing 动物 (waited ' + waitIn + 'ms inside):', JSON.stringify(ls));
const c = await card();
out('recent card after closing 动物:', JSON.stringify(c));
// tap the card
const t1 = Date.now();
const r = await tap(page, page, '#recentLearnStat');
await sleep(4000);
const st = await islandState(page);
const fr = await frameOf(page);
const title = await fr.evaluate(() => document.title).catch(e => 'ERR');
out('tapped recent card ->', JSON.stringify(r), JSON.stringify(st), 'title:', title);
await page.screenshot({ path: 's03_recent_opened.png' });
await K.done();
