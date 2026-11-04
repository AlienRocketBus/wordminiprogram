import { launch, sleep, BASE, O } from './lib.mjs';
for (const vp of [[390, 844], [360, 740], [375, 667]]) {
  const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
  const page = await ctx.newPage(); await page.setViewportSize({ width: vp[0], height: vp[1] });
  await page.goto(BASE + 'index.html'); await sleep(3000);
  const r = await page.evaluate(() => { const a = document.querySelector('a.island'); const s = document.getElementById('hsnSeasonBar'); const rc = document.getElementById('recentLearnStat'); return { firstIslandTop: Math.round(a.getBoundingClientRect().top), firstIslandBottom: Math.round(a.getBoundingClientRect().bottom), seasonTop: s && Math.round(s.getBoundingClientRect().top), recentTop: Math.round(rc.getBoundingClientRect().top), vh: innerHeight }; });
  console.log(vp.join('x'), JSON.stringify(r));
  await browser.close();
}
