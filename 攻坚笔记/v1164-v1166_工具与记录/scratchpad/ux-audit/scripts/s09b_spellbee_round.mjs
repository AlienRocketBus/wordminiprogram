import { startServer, launch, newCtx, islandPage, shot } from './lib.mjs';
const { srv, base } = await startServer();
const browser = await launch();
for (const theme of ['dark']) {
  const ctx = await newCtx(browser, { theme });
  const pg = await islandPage(ctx, base);
  await pg.evaluate(() => HansenSpellBee.open('food'));
  await pg.waitForTimeout(2000);
  // select 汉译英 to compare with 看中文
  const fr = pg.frames().find(f => /spelling_bee/.test(f.url())) || pg.mainFrame();
  console.log('frame', fr.url());
  const info = await fr.evaluate(() => {
    const all = [...document.querySelectorAll('*')].filter(e => e.offsetParent && /开始比赛/.test(e.textContent) && e.children.length <= 3);
    const t = all[all.length - 1]; if (t) t.click();
    return all.map(e => e.tagName + '.' + e.className).slice(-3);
  });
  console.log(info);
  await pg.waitForTimeout(4500);
  await shot(pg, `05b_sibling_spellbee_round_${theme}`);
  await pg.waitForTimeout(2500);
  await shot(pg, `05c_sibling_spellbee_round2_${theme}`);
  await pg.close(); await ctx.close();
}
await browser.close(); srv.close();
