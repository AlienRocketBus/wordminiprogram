import { launch, sleep, BASE, O } from './lib.mjs';
const file = process.argv[2] || 'island_animal.html';
const { browser, ctx } = await launch({ init: () => { try { if(!sessionStorage.getItem('x')){localStorage.clear();localStorage.setItem('hansen_onboarded','1');if(location.search.includes('light'))localStorage.setItem('hansen_palette_global','cloud');sessionStorage.setItem('x','1');} } catch(e){} } });
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + file + (process.argv[3]==='light'?'?light':'')); await sleep(2500);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(400);
// shrink the listen level to 3 words so the round ends quickly
const r = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  startListen(); startListenLevel('easy');
  const key = 'listen_easy';
  _shuffledPools[key] = _shuffledPools[key].slice(-2);  // 2 more after current
  await sleep(300);
  const log = [];
  // Q1: answer wrong
  const missIdx = listenQ.idx, missEn = listenQ.word.en;
  let wi = listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn);
  document.querySelectorAll('#listenScreen .boss-opt')[wi].click();
  await sleep(500);
  const card = document.getElementById('hml_lesson');
  log.push({ step:'lesson', shown: !!card, text: card ? card.textContent.replace(/\s+/g,' ').trim() : null });
  await sleep(2400);
  log.push({ step:'after lesson', gone: !document.getElementById('hml_lesson'), q: listenQ && listenQ.word.en });
  // answer the rest correctly until complete
  for (let k = 0; k < 6; k++) {
    if (!listenActive) break;
    const isRetry = HansenMistakeLesson.isRetry('listen', listenQ.idx);
    const ci = listenQ.opts.findIndex(o => o.cn === listenQ.word.cn);
    log.push({ step:'answer', en: listenQ.word.en, retry: isRetry, total: listenTotal, right: listenRight });
    document.querySelectorAll('#listenScreen .boss-opt')[ci].click();
    await sleep(5600);
  }
  await sleep(300);
  const res = document.querySelector('#listenContent .hml-result');
  return { missEn, log, result: res ? res.textContent.replace(/\s+/g,' ').trim() : null, total: listenTotal, right: listenRight, summary: (document.getElementById('listenContent').textContent.match(/答对[^%]*%/)||[''])[0] };
});
console.log(JSON.stringify(r, null, 1));
await page.screenshot({ path: O + '/shots/listen_result_' + (process.argv[3]||'dark') + '_' + file.replace('.html','') + '.png' });
console.log('errs', errs);
await browser.close();
