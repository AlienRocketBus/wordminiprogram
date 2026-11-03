import { openIsland, done } from './h.mjs';
const file = process.argv[2] || 'island_animal.html';
const { page, errs } = await openIsland(file);
await page.evaluate(() => { showScreen('boss'); window.hansenStartRebattle ? hansenStartRebattle(1) : startBoss(1); });
const ok1 = await page.waitForFunction(() => (typeof bossActive !== 'undefined' && bossActive) && document.querySelectorAll('#bossOpts .boss-opt').length > 0 && !document.getElementById('bossOpts').dataset.done, null, { timeout: 20000 }).then(() => true).catch(() => false);
console.log('fight started', ok1);
async function tapWrong() {
  const p = await page.evaluate(() => {
    const c = window._bossCorrectIdx; const opts = [...document.querySelectorAll('#bossOpts .boss-opt')];
    const el = opts.find((o, j) => j !== c && o.offsetParent);
    if (!el) return null;
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (p) await page.touchscreen.tap(p.x, p.y);
  return !!p;
}
async function sample(label) {
  return page.evaluate((label) => {
    const el = document.getElementById('hml_lesson');
    if (!el) return { label, present: false };
    const card = el.querySelector('.listen-reveal'); const r = card.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { label, present: true, onTop: !!hit && el.contains(hit), hit: hit ? (hit.id || String(hit.className).slice(0, 40) || hit.tagName) : null };
  }, label);
}
const hp0 = await page.evaluate(() => heroHP);
await tapWrong();
const t0 = Date.now();
const samples = [];
for (const ms of [500, 1300, 2000, 2800, 3500, 4200]) {
  await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
  samples.push(await sample(ms));
}
const after = await page.evaluate(() => ({ hp: heroHP, live: document.querySelectorAll('#bossOpts .boss-opt').length, done: document.getElementById('bossOpts').dataset.done || '' }));
console.log(JSON.stringify({ hp0, samples, after }, null, 1));
console.log('errs', errs);
await done();
