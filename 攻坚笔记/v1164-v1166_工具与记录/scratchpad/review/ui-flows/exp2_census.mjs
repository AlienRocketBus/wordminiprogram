// EXP2: timers / listeners / background requests before and after N open/close cycles of every
// cancelable flow (real spelling_pk.html, real SDK, emulator network, touch taps).
import { setup, docs, sleep, report, H, census } from './lib.mjs';
const N = Number(process.argv[2] || 10);
const rep = report(`EXP2 census over ${N} cycles`);
const env = await setup({ permissionMode: 'legacy', latencyMs: 30, jitterMs: 20, consistencyLagMs: 200 });
const reqsOf = (uid, since) => env.emu.log.filter((e) => e.uid === uid && e.t >= since && e.path === '/web');
async function idleReqs(p, ms = 12000) { const t = Date.now(); await sleep(ms); return reqsOf(p.cloudUid, t).map((e) => (e.action || '').replace('database.', '') + ':' + (e.docId || '').slice(-4)); }
function diff(a, b) {
  const out = {};
  const keys = new Set([...Object.keys(a.listeners || {}), ...Object.keys(b.listeners || {})]);
  for (const k of keys) { const d = (b.listeners[k] || 0) - (a.listeners[k] || 0); if (d) out[k] = d; }
  return { intervals: b.intervals - a.intervals, listeners: out };
}
try {
  const P = await env.phone('甲', { census: true, nick: '计数蜂' });
  await sleep(2500);
  const c0 = await census(P);
  rep.log('baseline intervals:', c0.intervals, c0.iv);
  rep.log('baseline listeners:', c0.listeners);
  const idle0 = await idleReqs(P);
  rep.log(`baseline idle DB requests in 12 s: ${idle0.length} ${idle0.slice(0, 8).join(' ')}`);

  // a. ladder: open -> 开始排位 -> × (cancel) -> × (close)
  for (let i = 0; i < N; i++) {
    await P.tap('#pkLadder'); await P.waitScreen(/开始排位/, { timeout: 8000 });
    await P.tap('#ldGo'); await P.waitScreen(/正在找对手/, { timeout: 5000 });
    await sleep(1200);
    await P.tap('#ldCancel'); await P.waitScreen(/开始排位/, { timeout: 5000 });
    await P.tap('#ldX'); await sleep(400);
  }
  await sleep(1500);
  const c1 = await census(P);
  rep.log('after ladder cycles:', diff(c0, c1), c1.iv.filter((x) => !c0.iv.includes(x)));
  const idle1 = await idleReqs(P);
  rep.log(`idle DB requests in 12 s after ladder cycles: ${idle1.length} ${idle1.slice(0, 10).join(' ')}`);

  // b. lobby open/back
  for (let i = 0; i < N; i++) {
    await P.tap('#pkRooms'); await P.waitScreen(/开一间/, { timeout: 8000 });
    await sleep(600);
    await P.tap('#prBack'); await sleep(400);
  }
  await sleep(1500);
  const c2 = await census(P);
  rep.log('after lobby cycles:', diff(c1, c2), c2.iv.filter((x) => !c1.iv.includes(x)));

  // c. open a room -> waiting screen -> 关掉房间
  for (let i = 0; i < N; i++) {
    await P.tap('#pkRooms'); await P.waitScreen(/开一间/, { timeout: 8000 });
    await P.tap('#prNew'); await P.tap('.pr_mode[data-mode="C"]');
    await P.waitScreen(/等对手进来/, { timeout: 15000 });
    await sleep(2500);
    await P.tap('#prBack'); await sleep(600);
  }
  await sleep(2000);
  const c3 = await census(P);
  rep.log('after create/close cycles:', diff(c2, c3), c3.iv.filter((x) => !c2.iv.includes(x)));
  const idle3 = await idleReqs(P);
  rep.log(`idle DB requests in 12 s after create/close cycles: ${idle3.length} ${idle3.slice(0, 10).join(' ')}`);
  const openRooms = docs(env.emu).filter((d) => d.kind === 'room' && d.status === 'open');
  rep.log(`rooms still open on the server: ${openRooms.length}`);
  const st = await P.eval(() => ({ room: window.HansenPkRoom._currentRoomId(), role: window.HansenPkRoom._currentRole() }));
  rep.log('data layer current room after all cycles:', st);
  rep.expect(c3.intervals - c0.intervals <= 0, `no interval growth (baseline ${c0.intervals}, now ${c3.intervals})`);
  rep.expect(idle3.length <= idle0.length + 1, 'no extra background DB traffic after the cycles');
  rep.log('page errors:', P.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
