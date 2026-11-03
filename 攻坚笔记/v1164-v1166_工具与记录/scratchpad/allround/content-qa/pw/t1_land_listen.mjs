// Verify: 听音辨义 level lists in land1..land8 (hard-coded LISTEN_LEVELS) vs each island's own words; click a level in land3.
import { launch, BASE, SHOTS, sleep } from './lib.mjs';
import fs from 'node:fs';
const { browser, ctx } = await launch();
const out = {};
for (const isl of ['land1', 'land2', 'land3', 'land8']) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(BASE + 'island_' + isl + '.html', { waitUntil: 'load' });
  await sleep(2500);
  // dismiss any welcome / onboarding alert the page shows for a fresh child
  await page.evaluate(() => { try { if (typeof closeAlert === 'function') closeAlert(); } catch (e) {} document.querySelectorAll('.modal.show,.show').forEach(m => { if (/alert|modal/i.test(m.id || m.className)) m.classList.remove('show'); }); });
  const info = await page.evaluate(() => ({
    nWords: allW.length,
    levelCounts: Object.fromEntries(Object.keys(LISTEN_LEVELS).map(k => [k, LISTEN_LEVEL_IDX[k].length])),
    listedWords: Object.fromEntries(Object.keys(LISTEN_LEVELS).map(k => [k, LISTEN_LEVELS[k].words.length])),
    hasListenCard: !!Array.from(document.querySelectorAll('.mode-card,[onclick]')).find(el => /startListen\(/.test(el.getAttribute('onclick') || '')),
  }));
  // open the real 听音辨义 card (same as a child tapping it)
  const card = await page.$('[onclick*="startListen("]');
  if (card) { await card.scrollIntoViewIfNeeded(); await card.click(); }
  await sleep(800);
  await page.screenshot({ path: `${SHOTS}/t1_${isl}_listen_levels.png` });
  const before = errs.length;
  // tap the first level card (初级)
  const lvl = await page.$('#listenContent [onclick*="startListenLevel"]');
  if (lvl) await lvl.click();
  await sleep(1500);
  await page.screenshot({ path: `${SHOTS}/t1_${isl}_listen_after_tap.png` });
  info.levelCardText = await page.evaluate(() => (document.getElementById('listenContent') || {}).innerText?.slice(0, 400));
  info.errorsAfterTap = errs.slice(before);
  info.allErrors = errs.slice(0, 10);
  out[isl] = info;
  await page.close();
}
fs.writeFileSync(SHOTS + '/t1_land_listen.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
