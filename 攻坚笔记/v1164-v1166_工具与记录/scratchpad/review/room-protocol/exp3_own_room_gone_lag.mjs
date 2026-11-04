// EXP3: host creates a room and immediately waits (exactly what the UI does: doCreate -> waiting()).
// waitForOpponent counts 3 consecutive "my own room is missing" reads as {gone}. Under read lag >= ~4.5 s
// the brand-new room is still invisible on the 3rd poll -> the UI says 「房间已经不在了」 and the room is closed.
// usage: node exp3_own_room_gone_lag.mjs <lagMs>
import { setup, call, startWait, waitEv, docs, sleep, makeReport } from './lib.mjs';
const LAG = Number(process.argv[2] || 5000);
const rep = makeReport(`EXP3 host's own fresh room under lag=${LAG}ms`);
const env = await setup({ permissionMode: 'legacy', latencyMs: 60, jitterMs: 40, consistencyLagMs: LAG });
try {
  const A = await env.phone('host');
  for (let k = 0; k < 2; k++) {
    const made = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
    const t0 = Date.now();
    await startWait(A, made.roomId, { ms: 60000 });
    const ev = await waitEv(A, 15000);
    rep.log(`try ${k + 1}: room ${made.roomId} created ok=${made.ok}; host event after ${ev ? ev.at - t0 : '-'}ms:`, ev ? Object.keys(ev).filter((x) => x !== 'at').join(',') : '(none in 15s)');
    rep.expect(!ev || !ev.gone, 'host does NOT get {gone} for the room it just created');
    const R = docs(env.emu).find((d) => d._id === made.roomId);
    rep.log('   room doc on the server:', R ? `${R.status} heartbeatAt=${new Date(R.heartbeatAt).toISOString().slice(11, 19)}` : '(none)');
    await A.eval(() => { try { window.__cancel && window.__cancel(); } catch (e) {} return true; });
    await call(A, 'leaveRoom', made.roomId);
    await sleep(1000);
  }
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT lag=${LAG}: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
