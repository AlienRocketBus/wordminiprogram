import { openIsland, done } from './h.mjs';
const file = process.argv[2] || 'island_animal.html';
const { page, errs } = await openIsland(file);
const out = await page.evaluate(async () => {
  startListen(); startListenLevel('easy');
  // 只留 1 题：第 1 题答错，然后只剩再考题
  _shuffledPools['listen_easy'] = _shuffledPools['listen_easy'].slice(-1);
  S.stats.listenRight = 9;
  const gc0 = (S.stats.gameCounts && S.stats.gameCounts.listen) || 0;
  const miss = listenQ.word;
  document.querySelectorAll('#listenScreen .boss-opt')[listenQ.opts.findIndex(o => o.cn !== miss.cn)].click();
  await __w(__card, 3000); __tapCard();
  const seen = [];
  for (let k = 0; k < 4 && listenActive; k++) {
    await __w(() => listenQ && !listenQ.answered, 6000);
    seen.push({ en: listenQ.word.en, retry: HansenMistakeLesson.isRetry('listen', listenQ.idx) });
    document.querySelectorAll('#listenScreen .boss-opt')[listenQ.opts.findIndex(o => o.cn === listenQ.word.cn)].click();
    await __w(() => !listenActive || (listenQ && !listenQ.answered), 7000);
  }
  const gc1 = (S.stats.gameCounts && S.stats.gameCounts.listen) || 0;
  return { seen, listenRight: S.stats.listenRight, gc0, gc1 };
});
console.log(JSON.stringify(out));
console.log('errs', errs);
await done();
