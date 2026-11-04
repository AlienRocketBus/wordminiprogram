import { startServer, launch, newCtx, islandPage, shot } from './lib.mjs';
const { srv, base } = await startServer();
const browser = await launch();
for (const theme of ['dark', 'light']) {
  const ctx = await newCtx(browser, { theme });
  const pg = await islandPage(ctx, base);
  await pg.evaluate(() => openSpellPK()); await pg.waitForTimeout(600);
  const h = await pg.evaluate(() => document.getElementById('hsn_pk_screen').scrollHeight);
  await pg.setViewportSize({ width: 390, height: h + 4 }); await pg.waitForTimeout(300);
  await shot(pg, `03_pk_inpage_${theme}_tall`);
  console.log(theme, h);
  await pg.close(); await ctx.close();
}
await browser.close(); srv.close();
