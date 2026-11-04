// INT-01: does the hidden iframe navigate back to the FIRST island after closing the 2nd island?
import { boot, sleep, tap } from './kit.mjs';
import { islandState, waitVisible, waitHidden, frameOf, dismissWelcome, tapMap, freshHome } from './nav.mjs';
const K = await boot();
const page = await K.ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
page.on('dialog', d => d.dismiss().catch(() => {}));
const navs = [];
page.on('framenavigated', f => { if (f.parentFrame() === page.mainFrame()) navs.push({ t: Date.now(), url: f.url().replace(K.base, '') }); });
const out = (...a) => console.log(...a);
out('onboard', JSON.stringify(await freshHome(K, page)));
await sleep(1500);
async function openCard(file) {
  const t0 = Date.now();
  const r = await tap(page, page, `a.island[href="${file}"]`);
  const v = await waitVisible(page, file, t0);
  out('open', file, 'tap', JSON.stringify(r), 'visibleMs', v.ms, JSON.stringify(v.s));
  return v;
}
async function closeMap(label) {
  const t0 = Date.now();
  const r = await tapMap(page);
  const h = await waitHidden(page, t0);
  out('close', label, 'tap', JSON.stringify(r), 'hiddenMs', h.ms, JSON.stringify(h.s));
}
await openCard('island_animal.html');
out('welcome', JSON.stringify(await dismissWelcome(page)));
await sleep(2500);
await closeMap('animal');
await sleep(1500);
out('after close animal', JSON.stringify(await islandState(page)));
await openCard('island_food.html');
out('welcome', JSON.stringify(await dismissWelcome(page)));
await sleep(2500);
// mark the food document's JS realm
const fr = await frameOf(page);
await fr.evaluate(() => { window.__skepticMark = 'food-' + Date.now(); });
const ls0 = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('wordIslandAnimal') || '{}').lastSaveTime || 0; } catch (e) { return 'err'; } });
const navMark = navs.length;
const reqMark = K.reqs.length;
const tClose = Date.now();
await closeMap('food');
await sleep(6000);
const s6 = await islandState(page);
out('6s after closing food:', JSON.stringify(s6));
out('iframe navigations since food close:', JSON.stringify(navs.slice(navMark).map(n => ({ dt: n.t - tClose, url: n.url }))));
const rq = K.reqs.slice(reqMark);
out('requests in 6s on home:', rq.length, 'html:', rq.filter(r => /\.html/.test(r.path)).map(r => r.url).join(' '));
const ls1 = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('wordIslandAnimal') || '{}').lastSaveTime || 0; } catch (e) { return 'err'; } });
out('wordIslandAnimal.lastSaveTime before/after:', ls0, ls1, ls1 > ls0 ? 'REWRITTEN' : 'unchanged');
// re-enter food
const t0 = Date.now();
await tap(page, page, 'a.island[href="island_food.html"]');
const v = await waitVisible(page, 'island_food.html', t0);
const fr2 = await frameOf(page);
const mark = await fr2.evaluate(() => window.__skepticMark || null).catch(e => 'ERR ' + e.message);
out('re-enter food visibleMs', v.ms, 'jsMarkSurvived', mark, JSON.stringify(v.s));
const welcome2 = await dismissWelcome(page, 2000);
out('welcome shown again on re-enter food:', welcome2.dismissed);
out('pageerrors:', JSON.stringify(errs));
await K.done();
