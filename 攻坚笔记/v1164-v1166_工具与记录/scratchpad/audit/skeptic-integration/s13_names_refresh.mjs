// (a) loading-screen / recent-card names vs home card names at runtime; (b) refresh inside island; (c) 3-island INT-01 chain
import { sleep, tap } from './kit.mjs';
import { boot2 } from './kit2.mjs';
import { islandState, waitVisible, waitHidden, frameOf, dismissWelcome, tapMap, freshHome } from './nav.mjs';
const K = await boot2({ cache: 'no-store' }); // no cache => slow enough that the loading screen shows
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
const out = (...a) => console.log(...a);
const navs = [];
page.on('framenavigated', f => { if (f.parentFrame() === page.mainFrame()) navs.push(f.url().replace(K.base, '')); });
out('onboard', JSON.stringify(await freshHome(K, page)));
await sleep(3000);
for (const file of ['island_treasure.html', 'island_question.html', 'island_action.html']) {
  const name = await page.evaluate(f => document.querySelector(`a.island[href="${f}"] .island-name`).textContent, file);
  const t0 = Date.now();
  const tr = await tap(page, page, `a.island[href="${file}"]`);
  out('tap', JSON.stringify(tr));
  let loadingText = null;
  for (let i = 0; i < 60 && !loadingText; i++) { await sleep(25); loadingText = await page.evaluate(() => { const el = document.getElementById('islandLoading'); return el && el.style.display === 'flex' ? document.getElementById('islandLoadingText').textContent : null; }); }
  await waitVisible(page, file, t0);
  await dismissWelcome(page, 3000);
  await sleep(1500);
  await tapMap(page); await waitHidden(page, Date.now()); await sleep(1500);
  const recent = await page.evaluate(() => document.getElementById('recentNum').textContent);
  out(`card "${name}" -> loading text "${loadingText}" -> recent card "${recent}" | iframe after close: ${(await islandState(page)).path}`);
}
out('iframe navigation sequence:', navs.join(' > '));
// (b) refresh inside an island
let t0 = Date.now();
await tap(page, page, 'a.island[href="island_food.html"]');
await waitVisible(page, 'island_food.html', t0);
await dismissWelcome(page, 3000);
await page.reload({ waitUntil: 'load' });
t0 = Date.now();
const v = await waitVisible(page, 'island_food.html', t0, 8000);
out('after reload inside 食物: visible', v.ms, JSON.stringify(v.s));
await K.done();
