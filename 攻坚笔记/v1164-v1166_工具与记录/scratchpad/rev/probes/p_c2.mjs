import { newPage, BASE, done } from './h.mjs';
const { ctx, page, errs } = await newPage();
async function go(file) {
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenReview && window.HansenCanonical && window.HansenReviewRewardsV963 && typeof markAnswer === 'function' && document.readyState !== 'loading', null, { timeout: 30000 });
  await page.waitForTimeout(800);
}
const file = process.argv[2] || 'island_land3.html';
await go(file);
await page.evaluate(() => { markAnswer(3, false); markAnswer(3, true); });
await go(file);
const r = await page.evaluate(() => {
  const ymd = n => { const d = new Date(); d.setDate(d.getDate() + (n || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const e = { box: 1, due: ymd(0), last: ymd(-2) };
  HansenCanonical.setCurrentSrs(3, e); S.srs[3] = e; save();
  const out = { afterSave: JSON.parse(localStorage.getItem(window.__hsnSaveKey)).srs };
  HansenReview._dueCount();
  out.afterDue = JSON.parse(localStorage.getItem(window.__hsnSaveKey)).srs;
  out.S = JSON.parse(JSON.stringify(S.srs));
  if (window.__hsnSaveNow) __hsnSaveNow();
  out.afterSaveNow = JSON.parse(localStorage.getItem(window.__hsnSaveKey)).srs;
  out.key = window.__hsnSaveKey;
  out.ledger = (function () { const a = HansenCanonical.resolve(HansenCanonical.currentRef()); return HansenCanonical.read().islands[a.id].srs[HansenCanonical.toCanonicalIndex(HansenCanonical.currentRef(), 3)]; })();
  out.vocabKeys = Object.keys(localStorage).filter(k => /vocab|allW/i.test(k));
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('errs', errs);
await done();
