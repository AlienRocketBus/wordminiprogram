import { openIsland, done } from './h.mjs';
import fs from 'node:fs';
const OUT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/rev/shots/'; fs.mkdirSync(OUT, { recursive: true });
const theme = process.argv[2] || '';
const { page, errs } = await openIsland('island_animal.html', theme ? { seed: { hansen_palette_global: theme } } : {});
await page.evaluate(async () => {
  startListen(); startListenLevel('easy');
  _shuffledPools['listen_easy'] = _shuffledPools['listen_easy'].slice(-1);
  document.querySelectorAll('#listenScreen .boss-opt')[listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn)].click();
  await __w(__card, 3000); __tapCard();
  for (let k = 0; k < 4 && listenActive; k++) {
    await __w(() => listenQ && !listenQ.answered, 6000);
    if (!listenActive) break;
    const right = listenQ.opts.findIndex(o => o.cn === listenQ.word.cn);
    document.querySelectorAll('#listenScreen .boss-opt')[k === 1 ? (right + 1) % listenQ.opts.length : right].click();   // 再考题故意再错一次 → 结算页 + 小课
    await __w(() => !listenActive || (listenQ && !listenQ.answered) || document.getElementById('hml_lesson'), 7000);
    if (document.getElementById('hml_lesson')) { await new Promise(r => setTimeout(r, 300)); __tapCard(); }
  }
  await new Promise(r => setTimeout(r, 600));
  const r = document.querySelector('#listenContent .hml-result'); if (r) r.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const r = document.querySelector('#listenContent .hml-result');
  if (!r) return null;
  const cs = getComputedStyle(r), t = getComputedStyle(r.querySelector('.hml-r-title')), w = getComputedStyle(r.querySelector('.hml-r-word'));
  return { bg: cs.backgroundColor, title: t.color, word: w.color, wordBg: w.backgroundColor, text: r.textContent.replace(/\s+/g, ' ') };
});
await page.screenshot({ path: OUT + 'result_' + (theme || 'dark') + '.png' });
console.log(JSON.stringify(info));
console.log('errs', errs);
await done();
