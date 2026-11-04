// EXP11: merged-view monotonicity with a read that goes backwards (one read served by a lagging replica).
// Host claims the abandon win (R: abandonWin 'host', hostScore 1, status done). The returning guest's view caches
// hostScore=1 (c.hs) and status rank, but NOT abandonWin / endedBy. If the read inside the guest's reportResult()
// is served from before the abandon, the verdict is computed as a normal game: guest 500 vs host "1" -> 'win'.
import { setup, call, startWait, waitEv, docs, sleep, makeReport } from './lib.mjs';
const rep = makeReport('EXP11 stale read flips the final verdict (abandonWin not cached)');
const env = await setup({ permissionMode: 'legacy', latencyMs: 40, jitterMs: 20, consistencyLagMs: 0 });
try {
  const A = await env.phone('host'), B = await env.phone('guest');
  const made = await call(A, 'createRoom', { mode: 'A', hostRating: 1000, wordCount: 5 });
  await sleep(300);
  await startWait(A, made.roomId);
  await call(B, 'joinRoom', made.roomId, {});
  await waitEv(A, 20000);
  await Promise.all([call(A, 'markReady', made.roomId), call(B, 'markReady', made.roomId)]);
  await sleep(500);
  const g0 = await call(B, 'roundState', made.roomId);          // guest has a view of the live match
  await sleep(2500);                                            // (the pre-abandon version is now 2.5 s old)
  const ca = await call(A, 'claimAbandonWin', made.roomId);     // host judged the guest gone
  rep.log('host claimAbandonWin ->', ca);
  await sleep(300);
  const g1 = await call(B, 'roundState', made.roomId);          // guest polls once with a fresh read
  rep.log('guest roundState (fresh read): status=' + g1.status + ' endedBy=' + g1.endedBy + ' hostScore=' + g1.hostScore + ' abandonWin=' + (g1.room && g1.room.abandonWin));
  env.emu.knobs.consistencyLagMs = 2000;                        // the next reads hit a replica 2 s behind
  const rr = await call(B, 'reportResult', made.roomId, 500);
  env.emu.knobs.consistencyLagMs = 0;
  rep.log('guest reportResult with one stale read ->', rr);
  rep.expect(rr.result === 'lose' && rr.byAbandon, 'guest still gets the abandon verdict (lose) once it has seen it');
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
