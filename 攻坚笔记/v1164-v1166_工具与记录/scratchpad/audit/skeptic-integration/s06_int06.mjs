// INT-06: (a) close latency of the map button measured in-page (click -> wrap hidden)
//         (b) after an in-iframe location.href navigation (boot-check "重新加载"), does one tap on the map button go home?
import { sleep, tap } from './kit.mjs';
import { boot2 } from './kit2.mjs';
import { islandState, waitVisible, waitHidden, frameOf, dismissWelcome, tapMap, freshHome } from './nav.mjs';
const K = await boot2({ cache: 'public, max-age=3600' });
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
const out = (...a) => console.log(...a);
await freshHome(K, page);
await page.evaluate(() => {
  const w = document.getElementById('islandFrameWrap');
  new MutationObserver(() => { if (w.style.display === 'none') window.__hiddenT = performance.now(); }).observe(w, { attributes: true, attributeFilter: ['style'] });
  window.addEventListener('popstate', () => { window.__popT = performance.now(); });
});
await sleep(1000);
async function armClick() {
  const fr = await frameOf(page);
  await fr.evaluate(() => { document.addEventListener('click', () => { try { top.__clickT = top.performance.now(); } catch (e) {} }, true); });
  await page.evaluate(() => { window.__clickT = 0; window.__hiddenT = 0; window.__popT = 0; });
}
const lat = [];
for (const file of ['island_animal.html', 'island_food.html', 'island_sports.html', 'island_animal.html']) {
  const t0 = Date.now();
  await tap(page, page, `a.island[href="${file}"]`);
  await waitVisible(page, file, t0);
  await dismissWelcome(page, 2500);
  await sleep(1500);
  await armClick();
  await tapMap(page);
  await waitHidden(page, Date.now());
  await sleep(300);
  const t = await page.evaluate(() => ({ click2pop: Math.round(window.__popT - window.__clickT), click2hidden: Math.round(window.__hiddenT - window.__clickT) }));
  lat.push(t); out('close', file, JSON.stringify(t));
  await sleep(800);
}
// (b) in-iframe reload like the boot-check button
let t0 = Date.now();
await tap(page, page, 'a.island[href="island_animal.html"]');
await waitVisible(page, 'island_animal.html', t0);
const h0 = (await islandState(page)).hist;
const fr = await frameOf(page);
await fr.evaluate(() => { const u = location.href.split('#')[0]; location.href = u + (u.indexOf('?') >= 0 ? '&' : '?') + '_r=' + Date.now(); });
await sleep(4000);
await dismissWelcome(page, 3000);
out('after in-iframe reload:', JSON.stringify(await islandState(page)), 'hist before', h0);
await tapMap(page);
await sleep(2500);
const s1 = await islandState(page);
out('after ONE tap on map button:', JSON.stringify(s1));
if (s1.wrap !== 'none') {
  await dismissWelcome(page, 2500);
  await tapMap(page);
  await sleep(2000);
  out('after SECOND tap:', JSON.stringify(await islandState(page)));
}
await K.done();
