import { launch, sleep, BASE, O } from './lib.mjs';
const theme = process.argv[2] || 'dark';
const { browser, ctx } = await launch({ init: () => { try { if(!sessionStorage.getItem('x')){localStorage.clear();localStorage.setItem('hansen_onboarded','1');sessionStorage.setItem('x','1');} } catch(e){} } });
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'island_animal.html'); await sleep(2500);
await page.evaluate((th) => {
  for (const id of ['alertModal', 'hsnStoryModal']) { const el = document.getElementById(id); if (el) { el.classList.remove('show'); el.style.display = 'none'; } }
  document.body.classList.remove('modal-open');
  S.level = 20; S.bossUnlocked = 20; window._hansenRebattleLv = 1; window.__hbuNewModeProb = 0;
  if (window.HansenBossProgress) HansenBossProgress.getUnlockedBossLv = () => 20;
  if (window.HansenBossTheme) HansenBossTheme.apply(th);
  showScreen('boss'); startBoss();
}, theme);
await page.waitForSelector('#bossTimerFill', { timeout: 15000 });
await sleep(800);
const r = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const opts = document.querySelectorAll('#bossOpts .boss-opt');
  const wi = [...opts].findIndex((o, j) => j !== window._bossCorrectIdx && getComputedStyle(o).display !== 'none');
  const en = window._bossWord && window._bossWord.en, hp0 = heroHP;
  bossAnswer(wi);
  await sleep(1400);
  const c = document.getElementById('hml_lesson');
  return { en, hp0, hp1: heroHP, card: c ? c.textContent.replace(/\s+/g,' ') : null, type: window._bossQType };
});
await page.screenshot({ path: `${O}/shots/boss_lesson_${theme}.png` });
await sleep(2800);
const r2 = await page.evaluate(() => ({ gone: !document.getElementById('hml_lesson'), done: document.getElementById('bossOpts') && document.getElementById('bossOpts').dataset.done, word: window._bossWord && window._bossWord.en, active: bossActive }));
console.log(JSON.stringify({ r, r2 }), 'errs', errs);
await browser.close();
