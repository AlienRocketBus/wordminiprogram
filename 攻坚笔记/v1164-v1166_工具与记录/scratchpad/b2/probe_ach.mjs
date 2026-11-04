import { launch, sleep, BASE } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { if(!sessionStorage.getItem('x')){localStorage.clear();localStorage.setItem('hansen_onboarded','1');sessionStorage.setItem('x','1');} } catch(e){} } });
const page = await ctx.newPage();
await page.goto(BASE + 'island_animal.html'); await sleep(2500);
console.log(await page.evaluate(() => {
  const T = window.HansenTotals; const log = [];
  const ou = window.unlockAch; window.unlockAch = function(id){ log.push(id); return ou.apply(this, arguments); };
  T.totalLearned = () => 952; checkAch();
  return JSON.stringify({ src: checkAch.toString().slice(0,400), log, ach: S.achievements.slice(0,10), type: typeof S.achievements, srcHas: checkAch.toString().includes('vocabS1500'), sameFn: window.unlockAch === unlockAch });
}));
await browser.close();
