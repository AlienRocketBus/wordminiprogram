// Verify cloze rendering for specific words: blank capitalisation ("it", "year") and the gold Chinese highlight (frightened, galaxy, available).
import { launch, BASE, SHOTS, sleep } from './lib.mjs';
import fs from 'node:fs';
const { browser, ctx } = await launch();
const cases = [
  ['question', 'it', 'easy'], ['time', 'year', 'easy'], ['season', 'frightened', 'easy'], ['season', 'galaxy', 'hard'], ['season', 'available', 'easy'],
];
const out = [];
for (const [isl, word, level] of cases) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.goto(BASE + 'island_' + isl + '.html', { waitUntil: 'load' });
  await sleep(2500);
  await page.evaluate(() => { try { if (typeof closeAlert === 'function') closeAlert(); } catch (e) {} });
  const r = await page.evaluate(([word, level]) => {
    startCloze(); startClozeLevel(level);
    const idx = allW.findIndex(w => w.en === word);
    clozePool = [idx]; clozeTotal = 1; nextClozeQ();
    const sent = document.querySelector('#clozeContent .cloze-sentence');
    const cn = document.querySelector('#clozeContent .cloze-cn');
    const hl = cn && cn.querySelector('span');
    const opts = Array.from(document.querySelectorAll('#clozeContent .cloze-opt')).map(o => o.textContent);
    return { idx, sentenceHTML: sent && sent.innerHTML, cnText: cn && cn.textContent, highlighted: hl && hl.textContent, opts };
  }, [word, level]);
  await page.screenshot({ path: `${SHOTS}/t2_${isl}_${word}_question.png` });
  // answer correctly like a child would
  const i = r.opts.findIndex(o => o.toLowerCase() === word.toLowerCase());
  if (i >= 0) { await page.locator('#clozeContent .cloze-opt').nth(i).click(); await sleep(600); }
  r.afterAnswerSentence = await page.evaluate(() => { const s = document.querySelector('#clozeContent .cloze-sentence'); return s && s.textContent; });
  await page.screenshot({ path: `${SHOTS}/t2_${isl}_${word}_answered.png` });
  r.island = isl; r.word = word; r.errors = errs;
  out.push(r);
  await page.close();
}
fs.writeFileSync(SHOTS + '/t2_cloze.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
