// 拼写大PK screen: in-page overlay on island page + standalone spelling_pk.html. Dark & light.
// Also checks: what happens when 天梯排位 is tapped from the in-page screen (stacking order).
import { startServer, launch, newCtx, openPage, shot, installMeasure, wire } from './lib.mjs';

const { srv, base } = await startServer();
const browser = await launch();
const out = {};
for (const theme of ['dark', 'light']) {
  const ctx = await newCtx(browser, { theme });
  // ── in-page PK on island
  const pg = await openPage(ctx, base, 'island_food.html', 6000);
  await pg.evaluate(() => { try { closeAlert(); } catch (e) {} });
  await pg.evaluate(() => openSpellPK());
  await pg.waitForTimeout(800);
  await shot(pg, `03_pk_inpage_${theme}`);
  await shot(pg, `03_pk_inpage_${theme}_full`, true);
  await installMeasure(pg);
  out['inpage_' + theme] = await pg.evaluate(() => ({
    contrast: __textAudit('#hsn_pk_screen', 'rgb(15,23,42)').filter(x => !x.ok),
    taps: __tapAudit('#hsn_pk_screen').filter(x => !x.ok),
    scrollH: document.getElementById('hsn_pk_screen').scrollHeight,
    hasFriends: !!document.querySelector('#hsn_pk_screen #kFriends, #hsn_pk_screen [id*=riend]')
  }));
  // tap 天梯排位 from in-page screen
  await wire(pg, {});
  await pg.evaluate(() => document.getElementById('kLadder').click());
  await pg.waitForTimeout(1200);
  await shot(pg, `03b_pk_inpage_tap_ladder_${theme}`);
  out['inpage_ladder_stack_' + theme] = await pg.evaluate(() => {
    const l = document.getElementById('hsn_ladder_screen');
    const p = document.getElementById('hsn_pk_screen');
    const topEl = document.elementFromPoint(195, 400);
    return {
      ladderOn: !!(l && l.classList.contains('on')), pkOn: !!(p && p.classList.contains('on')),
      ladderZ: l && getComputedStyle(l).zIndex, pkZ: p && getComputedStyle(p).zIndex,
      topAt195x400: topEl && (topEl.closest('[id^=hsn_]') || {}).id
    };
  });
  out['inpage_errs_' + theme] = pg.__errs;
  await pg.close();

  // ── standalone spelling_pk.html
  const pg2 = await openPage(ctx, base, 'spelling_pk.html', 4600);
  await shot(pg2, `04_pk_standalone_${theme}`);
  await shot(pg2, `04_pk_standalone_${theme}_full`, true);
  await installMeasure(pg2);
  out['standalone_' + theme] = await pg2.evaluate(() => ({
    cls: document.documentElement.className,
    contrast: __textAudit('#pkHome', 'rgb(15,23,42)').filter(x => !x.ok),
    taps: __tapAudit('#pkHome').filter(x => !x.ok)
  }));
  out['standalone_errs_' + theme] = pg2.__errs;
  await pg2.close();
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close(); srv.close();
