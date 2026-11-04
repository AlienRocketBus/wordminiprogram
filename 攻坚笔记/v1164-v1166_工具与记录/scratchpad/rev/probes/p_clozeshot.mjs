import { openIsland, done } from './h.mjs';
import fs from 'node:fs';
const OUT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/rev/shots/'; fs.mkdirSync(OUT, { recursive: true });
const file = process.argv[2] || 'island_animal.html';
const tag = process.argv[3] || 'cur';
const theme = process.argv[4] || '';
const { page, errs } = await openIsland(file, theme ? { seed: { hansen_palette_global: theme } } : {});
await page.evaluate(() => { startCloze(); startClozeLevel('easy'); });
await page.waitForTimeout(500);
// 记录 speak 调用
await page.evaluate(() => { window.__said = []; const o = window.speak; window.speak = function (t) { window.__said.push(String(t)); return o.apply(this, arguments); }; window.speak.__hansenMuteHooked = o.__hansenMuteHooked; });
await page.evaluate(() => { const opts = [...document.querySelectorAll('#clozeScreen .cloze-opt')]; opts[clozeQ.opts.findIndex(o => o.en !== clozeQ.word.en)].click(); });
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + `cloze_${tag}${theme ? '_' + theme : ''}.png` });
const said = await page.evaluate(() => ({ said: window.__said, ex: clozeQ.word.ex }));
console.log(JSON.stringify(said));
console.log('errs', errs);
await done();
