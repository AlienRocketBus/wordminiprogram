import { openIsland, done } from './h.mjs';
const file = process.argv[2] || 'island_animal.html';
const lvs = (process.argv[3] || '12,20').split(',').map(Number);
const tag = process.argv[4] || 'cur';
const OUT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/rev/shots/';
import fs from 'node:fs'; fs.mkdirSync(OUT, { recursive: true });
const { page, errs } = await openIsland(file);
await page.evaluate(() => window.__hansenBossFXReady && window.__hansenBossFXReady());
await page.waitForFunction(() => window.__hansenBossFXLoaded, null, { timeout: 30000 }).catch(() => {});
for (const lv of lvs) {
  await page.evaluate((lv) => { showScreen('boss'); hansenStartRebattle(lv); }, lv);
  await page.waitForFunction(() => (typeof bossActive !== 'undefined' && bossActive) && document.querySelectorAll('#bossOpts .boss-opt').length > 0 && !document.getElementById('bossOpts').dataset.done, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.evaluate(() => { const c = window._bossCorrectIdx; const n = document.querySelectorAll('#bossOpts .boss-opt').length; bossAnswer((c + 1) % n); });
  const t0 = Date.now();
  for (const ms of [1500, 2600, 3400]) {
    await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
    await page.screenshot({ path: OUT + `boss_${tag}_lv${lv}_${ms}.png` });
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => { try { stopBoss(); } catch (e) {} showScreen('home'); });
  await page.waitForTimeout(400);
}
console.log('errs', errs);
await done();
