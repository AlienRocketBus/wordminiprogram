import { newPage, BASE, done } from './h.mjs';
const root = process.env.PROBE_ROOT || '';
const { ctx, page, errs } = await newPage();
async function go(file) {
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenReview && window.HansenCanonical && window.HansenReviewRewardsV963 && typeof markAnswer === 'function' && document.readyState !== 'loading', null, { timeout: 30000 });
  await page.waitForTimeout(800);
}
const file = 'island_land3.html', I = 3;
await go(file);
const ymdF = () => { window.__ymd = n => { const d = new Date(); d.setDate(d.getDate() + (n || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }; };
await page.evaluate(ymdF);
await page.evaluate(i => { markAnswer(i, false); }, I);
await page.evaluate(i => { markAnswer(i, true); }, I);
const preReload = await page.evaluate(() => ({ disk: JSON.parse(localStorage.getItem('wordIslandLand3')), }));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.HansenReview && window.HansenReviewRewardsV963 && document.readyState !== 'loading', null, { timeout: 20000 });
await page.waitForTimeout(800);
await page.evaluate(ymdF);
const r = await page.evaluate(i => {
  const e = { box: 1, due: __ymd(0), last: __ymd(-2) };
  HansenCanonical.setCurrentSrs(i, e); S.srs[i] = e; if (typeof save === 'function') save();
  HansenReviewRewardsV963._debug.globalDueInfo(); HansenReview._dueCount();
  if (window.__hsnSaveNow) __hsnSaveNow();
  const disk = JSON.parse(localStorage.getItem('wordIslandLand3'));
  const voc = localStorage.getItem('hansen_vocab_wordIslandLand3');
  return { loadedStamp: window.__hsnLoadedSaveTime, diskWrongs: disk.wrongs, diskSrs: disk.srs, S: S.srs[i], vocab: voc ? JSON.parse(voc).length : null };
}, I);
console.log(JSON.stringify({ preReloadDisk: { wrongs: preReload.disk.wrongs, srs: preReload.disk.srs, t: preReload.disk.lastSaveTime }, ...r }, null, 1));
console.log('errs', errs);
await done();
