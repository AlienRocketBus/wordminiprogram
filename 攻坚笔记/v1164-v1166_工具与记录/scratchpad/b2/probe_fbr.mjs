import { launch, sleep, BASE, O } from './lib.mjs';
const file = process.argv[2] || 'island_animal.html';
const theme = process.argv[3] || 'dark';
const { browser, ctx } = await launch({ init: (th) => { try { if(!sessionStorage.getItem('x')){localStorage.clear();localStorage.setItem('hansen_onboarded','1'); if(th==='light') localStorage.setItem('hansen_palette_global','cloud'); sessionStorage.setItem('x','1');} } catch(e){} } });
await ctx.addInitScript((th) => { try { if(th==='light' && !localStorage.getItem('hansen_palette_global')) localStorage.setItem('hansen_palette_global','cloud'); } catch(e){} }, theme);
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + file); await sleep(2500);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(400);
const tag = file.replace('.html','') + '_' + theme;
// FISH
const fish = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  startFish(); startFishLevel('easy');
  for (let k = 0; k < 60; k++) { await sleep(100); const f = [...document.querySelectorAll('#fishPond [data-en]')].find(x => fishTarget && x.dataset.en !== fishTarget.en && !x.dataset.done); if (f) { const t = fishTarget.en; f.click(); await sleep(400); const c = document.getElementById('hml_lesson'); return { target: t, card: c ? c.textContent.replace(/\s+/g,' ') : null, lives: fishLives }; } }
  return { none: true };
});
await page.screenshot({ path: `${O}/shots/fish_lesson_${tag}.png` });
await sleep(2600);
const fish2 = await page.evaluate(() => ({ gone: !document.getElementById('hml_lesson'), target: fishTarget && fishTarget.en, locked: window.fishLocked }));
await page.evaluate(() => { stopFish(); showScreen('home'); });
// BOSS
const boss = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try { startBoss(); } catch (e) { return { err: String(e) }; }
  for (let k = 0; k < 80; k++) { await sleep(150); const o = document.querySelectorAll('#bossOpts .boss-opt'); if (o.length && window._bossCorrectIdx != null && !document.getElementById('bossOpts').dataset.done) break; }
  const opts = document.querySelectorAll('#bossOpts .boss-opt');
  if (!opts.length) return { noopts: true, screen: document.querySelector('.screen.active') && document.querySelector('.screen.active').id };
  const wi = [...opts].findIndex((o, j) => j !== window._bossCorrectIdx && o.offsetParent);
  const en = window._bossWord && window._bossWord.en;
  bossAnswer(wi);
  await sleep(1500);
  const c = document.getElementById('hml_lesson');
  return { en, card: c ? c.textContent.replace(/\s+/g,' ') : null, type: window._bossQType };
});
await page.screenshot({ path: `${O}/shots/boss_lesson_${tag}.png` });
await sleep(3000);
const boss2 = await page.evaluate(() => ({ gone: !document.getElementById('hml_lesson'), newQ: !document.getElementById('bossOpts') || !document.getElementById('bossOpts').dataset.done, active: bossActive }));
await page.evaluate(() => { try{ bossActive=false; document.body.classList.remove('hsn-boss-battle'); }catch(e){} showScreen('home'); });
// REVIEW mode (本岛错题复习)
const review = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  S.wrongs = {}; S.wrongs[1] = 2; S.wrongs[2] = 2; save();
  showScreen('review'); await sleep(200);
  startReview('classic'); await sleep(400);
  const q = reviewState.currentQ; if (!q) return { noq: true };
  const wrong = [...document.querySelectorAll('.rev-opt')].findIndex((o, i) => i !== q.correctOptIdx);
  const en = allW[q.idx].en;
  reviewAnswer(wrong); await sleep(500);
  const c = document.getElementById('hml_lesson');
  const card = c ? c.textContent.replace(/\s+/g,' ') : null;
  if (c) c.click(); await sleep(300);
  return { en, card, advanced: reviewState.idx };
});
console.log(JSON.stringify({ fish, fish2, boss, boss2, review }, null, 1));
console.log('errs', errs);
await browser.close();
