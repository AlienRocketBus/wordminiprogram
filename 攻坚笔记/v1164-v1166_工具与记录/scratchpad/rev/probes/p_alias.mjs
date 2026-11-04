// 同一批词的两个入口：单词大陆③(=星海第 61~90 词) 和 星海岛。一边答错，另一边看得到计划；另一边答对，这边跟着升盒
import { newPage, BASE, done } from './h.mjs';
const { ctx, page, errs } = await newPage();
async function go(file) {
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenReview && window.HansenCanonical && window.HansenReviewRewardsV963 && typeof markAnswer === 'function' && document.readyState !== 'loading', null, { timeout: 30000 });
  await page.waitForTimeout(900);
}
const k = 5;
await go('island_land3.html');
const a = await page.evaluate(k => { markAnswer(k, false); return { en: allW[k].en, wrong: S.wrongs[k], plan: S.srs[k], ci: HansenCanonical.toCanonicalIndex(HansenCanonical.currentRef(), k) }; }, k);
console.log('land3 miss', JSON.stringify(a));
await go('island_season.html');
const b = await page.evaluate(({ ci, en }) => { const li = HansenCanonical.fromCanonicalIndex(HansenCanonical.currentRef(), ci); const due = HansenReview._dueCount(); const r = { li, en: allW[li] && allW[li].en, sameWord: allW[li] && allW[li].en === en, wrong: S.wrongs[li], plan: S.srs[li], due };
  markAnswer(li, true); r.after = { wrong: S.wrongs[li] || 0, plan: S.srs[li] }; return r; }, a);
console.log('season sees + answers', JSON.stringify(b));
await page.waitForTimeout(1500);
console.log('ledger after season', JSON.stringify(await page.evaluate(ci => { const p = HansenCanonical.read().islands.season; const sv = JSON.parse(localStorage.getItem('wordIslandSeason')||'{}'); const l3 = JSON.parse(localStorage.getItem('wordIslandLand3')||'{}'); return { w: p.wrongs[ci], srs: p.srs[ci], cw: p.cleared.wrongs[ci], cs: p.cleared.srs[ci], seasonSave: { w: (sv.wrongs||{})[ci], srs: (sv.srs||{})[ci], t: sv.lastSaveTime }, land3Save: { w: (l3.wrongs||{})[ci-60], srs: (l3.srs||{})[ci-60], t: l3.lastSaveTime } }; }, a.ci)));
await go('island_land3.html');
const c = await page.evaluate(k => ({ wrong: S.wrongs[k] || 0, plan: S.srs[k] || null, due: HansenReview._dueCount() }), k);
console.log('land3 after', JSON.stringify(c));
console.log('errs', errs);
await done();
