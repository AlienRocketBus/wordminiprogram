import { openIsland, done } from './h.mjs';
const file = process.argv[2] || 'island_animal.html';
const { page, errs } = await openIsland(file);
await page.evaluate(() => {
  const st = HansenCanonical.read();
  const today = new Date(); const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  HansenCanonical.islands.forEach(isl => {
    const p = st.islands[isl.id];
    for (let i = 0; i < isl.words; i++) { if (p.learned.indexOf(i) < 0) p.learned.push(i); p.mc[i] = 3; p.cleared.wrongs[i] = Date.now() - 86400000 * (i % 30) - 1; }
    for (let i = 0; i < Math.min(10, isl.words); i++) { p.wrongs[i] = 2; p.srs[i] = { box: i % 4, due: ymd(today), last: '', updatedAt: Date.now() - 1000 }; }
  });
  HansenCanonical.write(st); HansenCanonical.migrate(); HansenCanonical.syncCurrent();
});
const r = await page.evaluate(async () => {
  const T = (fn, n = 20) => { const t0 = performance.now(); for (let k = 0; k < n; k++) fn(); return +((performance.now() - t0) / n).toFixed(2); };
  const out = {};
  out.read = T(() => HansenCanonical.read());
  out.syncCurrent = T(() => HansenCanonical.syncCurrent());
  out.absorbCurrent = T(() => HansenCanonical.absorbCurrent());
  out.save = T(() => save(), 10);
  out.checkAch = T(() => checkAch(), 10);
  out.globalDue = T(() => HansenReviewRewardsV963._debug.globalDueInfo(), 10);
  out.refresh = T(() => HansenReviewRewardsV963.refresh(), 10);
  out.ensureSrs = T(() => HansenReview._dueCount(), 10);
  out.markAnswer = T(() => markAnswer(15, true), 10);
  return out;
});
console.log(JSON.stringify(r));
console.log('errs', errs.slice(0, 3));
await done();
