// Idle main-thread busy % (CDP Performance.getMetrics TaskDuration delta over 10 s, CPU throttled 4x) — real screens vs mockups.
import { newCtx, closeBrowser, sleep, save, BASE, tapText } from './lib.mjs';
const ROUNDS = +(process.env.ROUNDS || 3);
const WIN = +(process.env.WIN || 10000);
const CASES = [
  // [label, kind, url, prep]
  ['home.real.cosmos', 'real', 'index.html', null, {}],
  ['home.mock.cosmos', 'mock', '__mock/home.html?theme=cosmos', null, {}],
  ['island.real.cosmos', 'real', 'island_food.html', 'island', {}],
  ['island.mock.cosmos', 'mock', '__mock/island.html?theme=cosmos', null, {}],
  ['answer.real.cosmos', 'real', 'island_food.html', 'listen', {}],
  ['answer.mock.cosmos', 'mock', '__mock/answer.html?theme=cosmos&s=q', null, {}],
  ['chest.real.cosmos', 'real', 'island_food.html', 'chest', {}],
  ['chest.mock.cosmos', 'mock', '__mock/chest.html?theme=cosmos', null, {}],
  ['result.real.cosmos', 'real', 'island_food.html', 'result', {}],
  ['result.mock.cosmos', 'mock', '__mock/result.html?theme=cosmos', null, {}],
  ['home.real.cloud', 'real', 'index.html', null, { palette: 'cloud' }],
  ['home.mock.cloud', 'mock', '__mock/home.html?theme=cloud', null, {}],
  ['island.real.cloud', 'real', 'island_food.html', 'island', { palette: 'cloud' }],
  ['island.mock.cloud', 'mock', '__mock/island.html?theme=cloud', null, {}],
  ['island.real.imax', 'real', 'island_food.html', 'island', { dia: 'theme_candyland' }],
  ['island.real.gallery', 'real', 'island_food.html', 'island', { dia: 'theme_photo_fairytown' }],
];
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const out = {};
async function measure([label, kind, url, prep, preset]) {
  const ctx = await newCtx(preset);
  await ctx.route(/hansen_room_warm_v1023\.js/, r => r.abort()); // conservative baseline: no hidden pre-warm iframes
  await ctx.addInitScript(() => {
    window.__raf = 0; const _r = window.requestAnimationFrame; window.requestAnimationFrame = function (cb) { window.__raf++; return _r.call(window, cb); };
    window.__iv = 0; const _si = window.setInterval; window.setInterval = function (f, ms) { window.__iv++; return _si.call(window, f, ms); };
  });
  const pg = await ctx.newPage(); pg.on('dialog', d => d.dismiss().catch(() => {}));
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Performance.enable');
  await pg.goto(BASE + url, { waitUntil: 'load' });
  await sleep(kind === 'real' ? 9000 : 3500);
  if (prep) {
    await tapText(pg, /开始冒险/); await sleep(600);
    await pg.evaluate(() => document.querySelectorAll('.modal-bg.show').forEach(m => m.classList.remove('show')));
    if (prep === 'listen') await pg.evaluate(() => { showScreen('listen'); startListenLevel('easy'); });
    if (prep === 'chest') await pg.evaluate(() => openChest());
    if (prep === 'result') await pg.evaluate(() => { showScreen('listen'); listenActive = true; listenRight = 7; listenTotal = 8; listenComplete(); });
    await sleep(4000); // let one-shot effects (confetti, toasts) finish so we measure idle
  }
  const g = async () => { const m = await cdp.send('Performance.getMetrics'); const o = {}; for (const x of m.metrics) o[x.name] = x.value; return o; };
  const r0 = await pg.evaluate(() => window.__raf); const m0 = await g();
  await sleep(WIN);
  const r1 = await pg.evaluate(() => window.__raf); const m1 = await g();
  const anim = await pg.evaluate(() => { const a = document.getAnimations(); return { total: a.length, running: a.filter(x => x.playState === 'running').length, intervals: window.__iv, canvases: document.querySelectorAll('canvas').length }; });
  const s = WIN / 1000;
  const res = { busyPct: +((m1.TaskDuration - m0.TaskDuration) / s * 100).toFixed(1), scriptPct: +((m1.ScriptDuration - m0.ScriptDuration) / s * 100).toFixed(1),
    stylePct: +((m1.RecalcStyleDuration - m0.RecalcStyleDuration) / s * 100).toFixed(1), layoutPct: +((m1.LayoutDuration - m0.LayoutDuration) / s * 100).toFixed(1),
    rafPerSec: +((r1 - r0) / s).toFixed(1), ...anim };
  await ctx.close();
  return res;
}
for (let r = 0; r < ROUNDS; r++) {
  for (const c of CASES) {
    if (only.length && !only.some(o => c[0].startsWith(o))) continue;
    const res = await measure(c).catch(e => ({ err: String(e).slice(0, 200) }));
    (out[c[0]] = out[c[0]] || []).push(res);
    console.log('round', r, c[0], JSON.stringify(res));
  }
}
const med = a => { const v = a.filter(x => x != null).sort((p, q) => p - q); return v.length ? v[Math.floor(v.length / 2)] : null; };
const summary = {};
for (const [k, arr] of Object.entries(out)) summary[k] = { busyPctMedian: med(arr.map(x => x.busyPct)), busyPctAll: arr.map(x => x.busyPct), runningAnims: med(arr.map(x => x.running)), rafPerSec: med(arr.map(x => x.rafPerSec)), intervals: med(arr.map(x => x.intervals)), canvases: med(arr.map(x => x.canvases)) };
save('idle_cpu', { method: 'CDP Performance.getMetrics TaskDuration delta / window, Emulation.setCPUThrottlingRate=4, room_warm blocked, 390x844 DPR2 isMobile', rounds: ROUNDS, windowMs: WIN, summary, raw: out });
console.log(JSON.stringify(summary, null, 1));
await closeBrowser();
