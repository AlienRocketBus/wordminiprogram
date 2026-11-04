// Screenshots of the 主题2.0 mockups (390x844 @2x) + pixel-true contrast of their final states.
import { newCtx, closeBrowser, sleep, save, BASE, TV } from './lib.mjs';
import { measureContrast } from './contrast_lib.mjs';
const THEMES = (process.env.THEMES || 'cosmos,cloud').split(',');
const EXTRA = (process.env.EXTRA || 'lantern,snow,kidsday,violet,sakura,mint').split(',').filter(Boolean);
const out = {};
const ctx = await newCtx({});
async function cap(name, url, waits, measure = true) {
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  const t0 = Date.now(); await pg.goto(BASE + url, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
  for (const [tag, ms] of waits) {
    const dt = ms - (Date.now() - t0); if (dt > 0) await sleep(dt);
    if (tag === 'final' && measure) { const r = await measureContrast(pg, `mock_${name}`); out[name] = { summary: r.summary, errs }; console.log(name, 'n', r.summary.n, 'fail', r.summary.fail, 'min', r.summary.minRatio); }
    else if (tag === 'action') {
      // burst of frames; keep the one with the most live effect particles (the "action" frame)
      let best = -1;
      for (let k = 0; k < 14; k++) {
        const n = await pg.evaluate(() => document.querySelectorAll('.fx-p').length);
        if (n > best) { best = n; await pg.screenshot({ path: `${TV}/shots/mock_${name}_mid.png` }); }
        await sleep(70);
      }
      (out[name + '_action'] = { particles: best });
    }
    else await pg.screenshot({ path: `${TV}/shots/mock_${name}_${tag}.png` });
  }
  await pg.close();
}
for (const th of THEMES) {
  await cap(`home_${th}`, `__mock/home.html?theme=${th}`, [['final', 1500]]);
  await cap(`island_${th}`, `__mock/island.html?theme=${th}`, [['final', 1500]]);
  await cap(`answer_q_${th}`, `__mock/answer.html?theme=${th}&s=q`, [['final', 1500]]);
  await cap(`answer_right_${th}`, `__mock/answer.html?theme=${th}&s=right`, [['action', 150], ['final', 2800]]);
  await cap(`answer_wrong_${th}`, `__mock/answer.html?theme=${th}&s=wrong`, [['final', 2000]]);
  await cap(`chest_${th}`, `__mock/chest.html?theme=${th}`, [['final', 1500]]);
  await cap(`chestopen_${th}`, `__mock/chest.html?theme=${th}&play=1`, [['action', 450], ['final', 3800]]);
  await cap(`result_${th}`, `__mock/result.html?theme=${th}`, [['action', 150], ['final', 4000]]);
}
for (const th of EXTRA) { await cap(`home_${th}`, `__mock/home.html?theme=${th}`, [['final', 1500]]); if (['lantern','snow','kidsday'].includes(th)) await cap(`island_${th}`, `__mock/island.html?theme=${th}`, [['final', 1500]]); }
{ const pg = await ctx.newPage(); await pg.goto(BASE + '__mock/themes.html', { waitUntil: 'load' }); await sleep(1500); await pg.screenshot({ path: `${TV}/shots/mock_themes_gallery.png`, fullPage: true }); await pg.close(); }
save('mock_contrast', out);
await closeBrowser();
