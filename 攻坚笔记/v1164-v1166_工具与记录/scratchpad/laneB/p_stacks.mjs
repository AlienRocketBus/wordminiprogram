import { openIsland, done } from '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/rev/probes/h.mjs';
const file = process.argv[2] || 'island_food.html';
const { page, errs } = await openIsland(file);
await page.evaluate(() => {
  const st = HansenCanonical.read();
  HansenCanonical.islands.forEach(isl => { const p = st.islands[isl.id]; for (let i = 0; i < isl.words; i++) { if (p.learned.indexOf(i) < 0) p.learned.push(i); p.mc[i] = 3; } });
  HansenCanonical.write(st); HansenCanonical.migrate(); HansenCanonical.syncCurrent();
});
const r = await page.evaluate(() => {
  const orig = JSON.parse; const stacks = {}; let n = 0;
  JSON.parse = function (s) { if (typeof s === 'string' && s.length > 20000) { n++; const st = (new Error().stack || '').split('\n').slice(2, 9).map(l => l.trim().replace(/\(http[^)]*\/([^/?]+)\?v=\d+:(\d+):\d+\)/, '($1:$2)').replace(/at http[^ ]*\/([^/?]+)\?v=\d+:(\d+):\d+/, 'at $1:$2')).join(' < '); stacks[st] = (stacks[st] || 0) + 1; } return orig.apply(this, arguments); };
  const t0 = performance.now(); markAnswer(15, true); const t1 = performance.now(); markAnswer(16, false); const t2 = performance.now();
  JSON.parse = orig;
  return { n, ms: [t1 - t0, t2 - t1], stacks: Object.entries(stacks).sort((a, b) => b[1] - a[1]) };
});
console.log('big parses', r.n, 'ms', r.ms);
for (const [s, c] of r.stacks) console.log(c, s);
console.log('ledger bytes', await page.evaluate(() => localStorage.getItem(HansenCanonical.STORE_KEY).length));
console.log('errs', errs.slice(0, 3));
await done();
