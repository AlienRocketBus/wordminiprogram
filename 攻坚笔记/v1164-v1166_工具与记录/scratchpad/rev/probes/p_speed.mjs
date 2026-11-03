import { openIsland, done } from './h.mjs';
const file = process.argv[2] || 'island_animal.html';
const { page, errs } = await openIsland(file);
const out = await page.evaluate(async () => {
  startSpeed && startSpeed(); startSpeedLevel('easy');
  spTime = 9999;
  const missIdx = window._spIdx;
  // answer wrong
  const wrongI = window._spOpts.findIndex(o => o.en !== window._spCorrect);
  spAnswer(wrongI);
  await __w(__card, 3000); __tapCard();
  const log = [];
  for (let k = 0; k < 2 * allW.length + 10 && spActive; k++) {
    await __w(() => { const o = document.getElementById('spOpts'); return o && !o.dataset.done && !(window.HansenMistakeLesson && HansenMistakeLesson.busy()); }, 4000);
    const idx = window._spIdx, s0 = spScore;
    spAnswer(window._spOpts.findIndex(o => o.en === window._spCorrect));
    log.push({ k, idx, isMiss: idx === missIdx, gained: spScore - s0 });
    await new Promise(r => setTimeout(r, 400));
  }
  return { missIdx, words: allW.length, appear: log.filter(x => x.isMiss) };
});
console.log(JSON.stringify(out));
console.log('errs', errs);
await done();
