import { newPage, BASE, done } from './h.mjs';
const { ctx, page, errs } = await newPage();
await ctx.addInitScript(() => {
  window.__absLog = [];
  let real;
  Object.defineProperty(window, 'HansenCanonical', { configurable: true, get() { return real; }, set(v) {
    real = v;
    if (v && v.absorbCurrent && !v.absorbCurrent.__w) {
      const o = v.absorbCurrent;
      v.absorbCurrent = function () {
        const booted = !!(window.save && window.save.__hansenCanonical);
        const st = (new Error().stack || '').split('\n').slice(2, 5).map(s => s.trim().replace(/\(.*\//, '(').replace(/\?v=\d+/, '')).join(' < ');
        window.__absLog.push({ t: Math.round(performance.now()), booted, ready: document.readyState, w5: window.S && S.wrongs ? S.wrongs[5] : undefined, st });
        return o.apply(this, arguments);
      };
      v.absorbCurrent.__w = 1;
    }
  } });
});
async function go(file) {
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenReview && window.HansenCanonical && typeof markAnswer === 'function' && document.readyState !== 'loading', null, { timeout: 30000 });
  await page.waitForTimeout(900);
}
await go('island_land3.html');
await page.evaluate(() => { markAnswer(5, false); });
await go('island_season.html');
await page.evaluate(() => { markAnswer(65, true); });
await page.waitForTimeout(1200);
await go('island_land3.html');
const r = await page.evaluate(() => ({ log: window.__absLog.slice(0, 8), w5: S.wrongs[5], plan: S.srs[5] }));
console.log(JSON.stringify(r, null, 1));
await done();
