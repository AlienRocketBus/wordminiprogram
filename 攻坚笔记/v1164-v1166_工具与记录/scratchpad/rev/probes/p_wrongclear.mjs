// 新孩子第一轮：答错一个词 → 本轮末再考答对 → 「错词清零」(50 钻) 有没有当场解锁
import { openIsland, done } from './h.mjs';
const { page, errs } = await openIsland('island_animal.html');
const r = await page.evaluate(async () => {
  const g0 = (window.HansenGems && HansenGems.get) ? HansenGems.get() : null;
  startListen(); startListenLevel('easy');
  _shuffledPools['listen_easy'] = _shuffledPools['listen_easy'].slice(-1);
  document.querySelectorAll('#listenScreen .boss-opt')[listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn)].click();
  await __w(__card, 3000); __tapCard();
  for (let k = 0; k < 4 && listenActive; k++) {
    await __w(() => listenQ && !listenQ.answered, 6000);
    if (!listenActive) break;
    document.querySelectorAll('#listenScreen .boss-opt')[listenQ.opts.findIndex(o => o.cn === listenQ.word.cn)].click();
    await __w(() => !listenActive || (listenQ && !listenQ.answered), 7000);
  }
  await new Promise(r => setTimeout(r, 800));
  try { checkAch(); } catch (e) {}
  const ach = (S.achievements || []).slice();
  return { wrongClear: ach.indexOf('wrongClear') >= 0, pending: (S.achPending || []).indexOf('wrongClear') >= 0, wrongs: Object.keys(S.wrongs || {}).length, gems0: g0, gems1: (window.HansenGems && HansenGems.get) ? HansenGems.get() : null };
});
console.log(JSON.stringify(r));
console.log('errs', errs);
await done();
