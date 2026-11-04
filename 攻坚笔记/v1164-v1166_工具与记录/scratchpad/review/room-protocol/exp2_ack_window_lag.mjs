// EXP2: guest joins a host that has been waiting > 40 s (host polls every 5 s by then — nextDelay()).
// The guest only waits TM.ackMs = 15 s for the host's confirmation. Budget ≈ 2·lag + 5 s poll + 1 s + latencies.
// usage: node exp2_ack_window_lag.mjs <lagMs> <hostWaitedSec>
import { setup, call, startWait, waitEv, launch, result, docs, sleep, makeReport } from './lib.mjs';
const LAG = Number(process.argv[2] || 4500);
const WAITED = Number(process.argv[3] || 42);
const rep = makeReport(`EXP2 ACK window · lag=${LAG}ms · host already waited ${WAITED}s`);
const env = await setup({ permissionMode: 'legacy', latencyMs: 80, jitterMs: 60, consistencyLagMs: LAG });
try {
  const A = await env.phone('host'), B = await env.phone('guest');
  for (let k = 0; k < 2; k++) {
    const made = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
    await sleep(LAG + 800);                     // isolate from EXP3 (fresh-room "gone")
    await startWait(A, made.roomId, { ms: 170000 });
    await sleep(WAITED * 1000 + k * 2300);      // vary the phase against the host's 5 s poll
    const t0 = Date.now();
    await launch(B, 'j', 'joinRoom', made.roomId, {});
    const trace = [];
    let r = null;
    for (let i = 0; i < 120; i++) {
      const R = docs(env.emu).find((d) => d._id === made.roomId) || {};
      const S = docs(env.emu).filter((d) => d.kind === 'seat' && d.roomId === made.roomId).map((d) => `${d._id}${d.acked ? '(acked)' : ''}`);
      const line = `${((Date.now() - t0) / 1000).toFixed(1)}s room.status=${R.status} guestId=${R.guestId ? 'guest' : '-'} seat=${R.seat} seats=[${S.join(',')}]`;
      if (!trace.length || trace[trace.length - 1].slice(line.indexOf(' ')) !== line.slice(line.indexOf(' '))) trace.push(line);
      const p = await B.eval(() => (window.__pending || {}).j);
      if (p && p.done && !r) r = p;
      const ev = await A.eval(() => (window.__ev || []).slice());
      if (r && (Date.now() - t0 > 30000 || (ev && ev.length))) break;
      await sleep(500);
    }
    trace.forEach((l) => rep.log('   ' + l));
    const ev = await A.eval(() => (window.__ev || []).slice());
    rep.log(`try ${k + 1}: guest join ->`, r && r.r ? { ok: r.r.ok, kind: r.r.kind, reason: r.r.reason } : r, `after ${r && r.at ? r.at - t0 : '?'}ms; host events:`, (ev || []).map((e) => Object.keys(e).filter((x) => x !== 'at' && x !== 'room').join('+')).join(' '));
    rep.expect(r && r.r && r.r.ok, 'guest got into the waiting host\'s room');
    await A.eval(() => { try { window.__cancel && window.__cancel(); } catch (e) {} return true; });
    await call(A, 'leaveRoom', made.roomId); await call(B, 'leaveRoom', '');
    await sleep(1500);
  }
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT lag=${LAG} waited=${WAITED}: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
