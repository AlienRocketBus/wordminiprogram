// Home island map + one island page, dark & light
import { startServer, launch, newCtx, openPage, shot, installMeasure } from './lib.mjs';

const { srv, base } = await startServer();
const browser = await launch();
const report = {};
for (const theme of ['dark', 'light']) {
  const ctx = await newCtx(browser, { theme });
  const pg = await openPage(ctx, base, 'index.html', 6000);
  await shot(pg, `01_home_${theme}`);
  await shot(pg, `01_home_${theme}_full`, true);
  await installMeasure(pg);
  report['home_' + theme] = await pg.evaluate(() => ({
    title: document.title, cls: document.documentElement.className,
    bodyBg: getComputedStyle(document.body).backgroundImage.slice(0, 200),
    overlays: [...document.querySelectorAll('body > div')].filter(d => { const s = getComputedStyle(d); return s.position === 'fixed' && s.display !== 'none' && d.getBoundingClientRect().height > 300; }).map(d => d.id || d.className).slice(0, 10),
    errs: null
  }));
  report['home_' + theme].errs = pg.__errs;
  await pg.close();

  const pg2 = await openPage(ctx, base, 'island_food.html', 6000);
  await pg2.evaluate(() => { try { closeAlert(); } catch (e) {} });
  await pg2.waitForTimeout(600);
  await shot(pg2, `02_island_${theme}`);
  await shot(pg2, `02_island_${theme}_full`, true);
  report['island_' + theme] = { cls: await pg2.evaluate(() => document.documentElement.className), errs: pg2.__errs };
  await pg2.close();
  await ctx.close();
}
console.log(JSON.stringify(report, null, 1));
await browser.close(); srv.close();
