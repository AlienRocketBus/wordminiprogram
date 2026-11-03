// Sibling single-player modes for visual-language comparison: spelling bee (shares the keyboard) and speed-60s.
import { startServer, launch, newCtx, islandPage, shot } from './lib.mjs';

const { srv, base } = await startServer();
const browser = await launch();
for (const theme of ['dark', 'light']) {
  const ctx = await newCtx(browser, { theme });
  const pg = await islandPage(ctx, base);
  await pg.evaluate(() => { try { HansenSpellBee.open('food'); } catch (e) { console.log(e); } });
  await pg.waitForTimeout(2500);
  await shot(pg, `05_sibling_spellbee_${theme}`);
  // try to start a round if there is a start button
  const started = await pg.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && /开始|start|出发|GO/i.test(x.innerText));
    if (b) { b.click(); return b.innerText; } return null;
  });
  await pg.waitForTimeout(2500);
  await shot(pg, `05b_sibling_spellbee_round_${theme}`);
  console.log(theme, 'spellbee start:', started, pg.__errs.slice(0, 3));
  await pg.close();
  const p2 = await islandPage(ctx, base);
  await p2.evaluate(() => { try { startSpeed(); } catch (e) {} });
  await p2.waitForTimeout(2500);
  await shot(p2, `06_sibling_speed60_${theme}`);
  await p2.close();
  await ctx.close();
}
await browser.close(); srv.close();
