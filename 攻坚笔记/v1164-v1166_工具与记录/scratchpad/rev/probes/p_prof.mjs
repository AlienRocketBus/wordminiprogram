import { openIsland, done } from './h.mjs';
const file = process.argv[2] || 'island_animal.html';
const { page, errs } = await openIsland(file);
await page.evaluate(() => {
  const st = HansenCanonical.read();
  HansenCanonical.islands.forEach(isl => { const p = st.islands[isl.id]; for (let i = 0; i < isl.words; i++) { if (p.learned.indexOf(i) < 0) p.learned.push(i); p.mc[i] = 3; } });
  HansenCanonical.write(st); HansenCanonical.migrate(); HansenCanonical.syncCurrent();
});
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
await page.evaluate(() => { for (let k = 0; k < 15; k++) markAnswer(15 + (k % 10), k % 2 === 0); });
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
const dt = profile.timeDeltas; const counts = new Map();
profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
for (const [id, us] of counts) { const n = byId.get(id); const cf = n.callFrame; const key = (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').pop().split('?')[0] + ':' + (cf.lineNumber + 1); self.set(key, (self.get(key) || 0) + us); }
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, us]) => (us / 1000).toFixed(1) + 'ms ' + k);
console.log(top.join('\n'));
await done();
