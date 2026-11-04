// EXP3: rapid double taps on every "go" button (touch taps ~90 ms apart, like an impatient kid).
//   a) choose-mode card in 开一间  -> how many waitForOpponent loops / 1 s timers / rooms?
//   b) 开始排位 double tap         -> how many matching runs (clock intervals)?
//   c) 「取消，回天梯」 double tap   -> does the 2nd tap land on 「开始排位」 and restart matching?
//   d) 再来一局 double tap (result screen) is covered in exp6.
import { setup, docs, sleep, report, H, census } from './lib.mjs';
const rep = report('EXP3 rapid double taps');
const env = await setup({ permissionMode: 'legacy', latencyMs: 120, jitterMs: 60, consistencyLagMs: 300 });
async function dbl(p, sel, gap = 90) {
  const h = await p.hitTest(sel, { timeout: 6000 });
  if (!h.ok) throw new Error('no ' + sel + ' ' + h.why);
  await p.page.touchscreen.tap(h.x, h.y);
  await sleep(gap);
  await p.page.touchscreen.tap(h.x, h.y);
  return h;
}
try {
  const P = await env.phone('甲', { census: true, nick: '双击蜂' });
  await sleep(2000);
  const c0 = await census(P);
  // a) mode card double tap
  await P.tap('#pkRooms'); await P.waitScreen(/开一间/, { timeout: 8000 });
  await P.tap('#prNew');
  await dbl(P, '.pr_mode[data-mode="C"]');
  await P.waitScreen(/等对手进来/, { timeout: 15000 });
  await sleep(1000);
  const rooms = docs(env.emu).filter((d) => d.kind === 'room' && d._openid === P.cloudUid);
  const rid = rooms[0] && rooms[0]._id;
  const t0 = Date.now();
  await sleep(10000);
  const reads = env.emu.log.filter((e) => e.uid === P.cloudUid && e.t >= t0 && e.action === 'database.getDocument' && e.docId === rid).length;
  const c1 = await census(P);
  const newIv = c1.iv.filter((x) => !c0.iv.includes(x));
  rep.log(`rooms created: ${rooms.length}; reads of own room doc in 10 s: ${reads} (one waitForOpponent loop polls it every ~2 s => ~5)`);
  rep.log('new intervals while waiting:', newIv);
  const waitTimers = newIv.filter((x) => /waiting/.test(x)).length;
  rep.expect(waitTimers <= 1, `one 「已等 N 秒」 timer on the waiting screen (found ${waitTimers})`);
  rep.expect(reads <= 7, `one waitForOpponent loop (reads ${reads})`);
  await P.tap('#prBack'); await sleep(1500);
  const c2 = await census(P);
  rep.log('after 关掉房间: intervals', c2.intervals, 'vs baseline', c0.intervals, c2.iv.filter((x) => !c0.iv.includes(x)));
  const t1 = Date.now();
  await sleep(8000);
  const reads2 = env.emu.log.filter((e) => e.uid === P.cloudUid && e.t >= t1 && e.docId === rid).map((e) => e.action.replace('database.', ''));
  rep.log(`requests on that room doc in the 8 s after closing it: ${reads2.length} ${reads2.join(',')}`);
  rep.expect(reads2.length === 0, 'closing the room stops every loop that polls it');
  await P.tap('#prBack').catch(() => {});
  await sleep(500);

  // b) 开始排位 double tap
  await P.tap('#pkLadder'); await P.waitScreen(/开始排位/, { timeout: 8000 });
  const c3 = await census(P);
  await dbl(P, '#ldGo', 90);
  await sleep(2500);
  const c4 = await census(P);
  const clocks = c4.iv.filter((x) => !c3.iv.includes(x));
  rep.log('new intervals after double-tapping 开始排位:', clocks);
  rep.expect(clocks.length <= 1, `one matching clock (found ${clocks.length})`);

  // c) 「取消，回天梯」 double tap
  const hc = await P.hitTest('#ldCancel2', { timeout: 3000 });
  await dbl(P, '#ldCancel2', 120);
  await sleep(1500);
  const s = (await P.screen()).replace(/\s+/g, ' ').slice(0, 80);
  const go = await P.eval(() => { const b = document.getElementById('ldGo'); if (!b) return null; const r = b.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
  rep.log(`取消 button at y=${hc.y}; 开始排位 button spans y=${go && go.top}..${go && go.bottom}; screen now: ${s}`);
  rep.expect(!/正在找对手/.test(s), 'a double tap on 「取消，回天梯」 does not restart matching');
  await P.tap('#ldX').catch(() => {});
  rep.log('page errors:', P.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
