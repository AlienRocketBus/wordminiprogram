import { openIsland, done } from './h.mjs';
const files = process.argv.slice(2);
for (const f of files) {
  const { page, ctx } = await openIsland(f);
  const r = await page.evaluate(() => {
    const out = {};
    Object.keys(CLOZE_LEVEL_IDX).forEach(lv => {
      const bad = CLOZE_LEVEL_IDX[lv].filter(i => { const w = allW[i]; if (!w || !w.ex) return true; const re = new RegExp('\\b' + w.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'); return !re.test(w.ex); }).map(i => allW[i].en + ' | ' + (allW[i].ex || ''));
      out[lv] = { n: CLOZE_LEVEL_IDX[lv].length, bad };
    });
    return out;
  });
  console.log(f, JSON.stringify(r));
  await ctx.close();
}
await done();
