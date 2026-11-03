// Cost of one celebration EVENT (busy % in the 3 s after an in-page trigger, CPU 4x) + proof nothing keeps running
// afterwards + prefers-reduced-motion check (no animations created, final state shown).
import { newCtx, closeBrowser, sleep, save, BASE, tapText } from './lib.mjs';
const ROUNDS = +(process.env.ROUNDS || 3);
const CASES = [
  ['answer_right.real', 'real', 'island_food.html', async pg => { await pg.evaluate(() => { showScreen('listen'); startListenLevel('easy'); }); await sleep(2500); return () => pg.evaluate(() => { const i = listenQ.opts.findIndex(o => o.cn === listenQ.word.cn); listenAnswer(i); }); }],
  ['answer_right.mock', 'mock', '__mock/answer.html?theme=cosmos&s=q', async pg => () => pg.evaluate(() => answer('right'))],
  ['round_result.real', 'real', 'island_food.html', async pg => { await pg.evaluate(() => showScreen('listen')); await sleep(800); return () => pg.evaluate(() => { listenActive = true; listenRight = 7; listenTotal = 8; listenComplete(); }); }],
  ['round_result.mock', 'mock', '__mock/result.html?theme=cosmos', async pg => { await sleep(2500); return () => pg.evaluate(() => replay()); }],
  ['chest_open.real', 'real', 'island_food.html', async pg => { await pg.evaluate(() => openChest()); await sleep(1500); return () => pg.evaluate(() => doOpenChest()); }],
  ['chest_open.mock', 'mock', '__mock/chest.html?theme=cosmos', async pg => () => pg.evaluate(() => openChest())],
];
const out = {};
const g = async cdp => { const m = await cdp.send('Performance.getMetrics'); const o = {}; for (const x of m.metrics) o[x.name] = x.value; return o; };
async function run([label, kind, url, prep]) {
  const ctx = await newCtx({});
  await ctx.route(/hansen_room_warm_v1023\.js/, r => r.abort());
  await ctx.addInitScript(() => { window.__lt = 0; try { new PerformanceObserver(l => { window.__lt += l.getEntries().length; }).observe({ type: 'longtask', buffered: true }); } catch (e) {} });
  const pg = await ctx.newPage(); pg.on('dialog', d => d.dismiss().catch(() => {}));
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Performance.enable');
  await pg.goto(BASE + url, { waitUntil: 'load' });
  await sleep(kind === 'real' ? 8000 : 2500);
  if (kind === 'real') { await tapText(pg, /开始冒险/); await sleep(500); await pg.evaluate(() => document.querySelectorAll('.modal-bg.show').forEach(m => m.classList.remove('show'))); }
  const trig = await prep(pg);
  await sleep(1500);
  const lt0 = await pg.evaluate(() => window.__lt || 0);
  const m0 = await g(cdp); await trig(); await sleep(3000); const m1 = await g(cdp);
  const after = await pg.evaluate(() => ({ running: document.getAnimations().filter(a => a.playState === 'running').length, longtasks: window.__lt || 0, particles: document.querySelectorAll('.confetti,.fx-p').length }));
  await sleep(1500);
  const later = await pg.evaluate(() => ({ running: document.getAnimations().filter(a => a.playState === 'running').length, all: document.getAnimations().length, layer: !!document.querySelector('.fx-layer') }));
  await ctx.close();
  return { busyPct3s: +((m1.TaskDuration - m0.TaskDuration) / 3 * 100).toFixed(1), runningAt3s: after.running, particlesAt3s: after.particles, runningAt4_5s: later.running, animsAt4_5s: later.all, fxLayerLeft: later.layer, longtasks: after.longtasks - lt0 };
}
for (let r = 0; r < ROUNDS; r++) for (const c of CASES) {
  const res = await run(c).catch(e => ({ err: String(e).slice(0, 200) }));
  (out[c[0]] = out[c[0]] || []).push(res); console.log(r, c[0], JSON.stringify(res));
}
const rm = {};
for (const [lab, u, trig] of [['chest', '__mock/chest.html?theme=cosmos', 'openChest()'], ['result', '__mock/result.html?theme=cosmos', 'replay()'], ['answer', '__mock/answer.html?theme=cosmos&s=q', "answer('right')"]]) {
  const ctx = await newCtx({ reducedMotion: true }); const pg = await ctx.newPage();
  await pg.goto(BASE + u, { waitUntil: 'load' }); await sleep(700);
  await pg.evaluate(trig); await sleep(200);
  rm[lab] = await pg.evaluate(() => ({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, anims: document.getAnimations().length, fxLayer: !!document.querySelector('.fx-layer'),
    opened: document.getElementById('app') ? document.getElementById('app').classList.contains('opened') : null, coin: (document.getElementById('coinN') || {}).textContent, right: (document.getElementById('right') || {}).textContent, card: !!document.getElementById('card') }));
  await ctx.close();
}
console.log('reduced', JSON.stringify(rm));
const med = a => { const v = a.filter(x => x != null).sort((p, q) => p - q); return v.length ? v[Math.floor(v.length / 2)] : null; };
const summary = {}; for (const [k, arr] of Object.entries(out)) summary[k] = { busyPct3sMedian: med(arr.map(x => x.busyPct3s)), all: arr.map(x => x.busyPct3s), runningAfter4_5s: arr.map(x => x.runningAt4_5s), longtasks: arr.map(x => x.longtasks), particlesAt3s: arr.map(x => x.particlesAt3s) };
save('event_cpu', { method: 'busy % over 3 s after an in-page trigger, CPU 4x, room_warm blocked', summary, raw: out, reducedMotion: rm });
console.log(JSON.stringify(summary, null, 1));
await closeBrowser();
