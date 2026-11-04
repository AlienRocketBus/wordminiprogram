// EXP10: hypothetical duplicate-_id server behaviours the spec says to tolerate ("never trust the add result alone").
//   silent    : server acks the duplicate add and writes nothing
//   overwrite : server replaces the doc (last writer wins)
// claim() on success reads back ONCE, immediately; under read lag that read returns null (or the old version), so
// both racers are told mine:true -> two "first" winners of one word (A mode) / two guests "holding" one seat.
// usage: node exp10_dup_silent.mjs <silent|overwrite> <lagMs>
import { setup, call, startWait, waitEv, launch, result, docs, sleep, makeReport } from './lib.mjs';
import { createEmulator } from './emulator_dupstyles.mjs';
const STYLE = process.argv[2] || 'silent';
const LAG = Number(process.argv[3] || 400);
const rep = makeReport(`EXP10 duplicate add answered as success (${STYLE}) · lag ${LAG}ms`);
const env = await setup({ permissionMode: 'legacy', latencyMs: 50, jitterMs: 30, consistencyLagMs: LAG, duplicateStyle: STYLE }, undefined, createEmulator);
try {
  const A = await env.phone('host'), B = await env.phone('guest');
  const made = await call(A, 'createRoom', { mode: 'A', hostRating: 1000, wordCount: 5 });
  await sleep(LAG + 400);
  await startWait(A, made.roomId);
  const j = await call(B, 'joinRoom', made.roomId, {});
  await waitEv(A, 20000);
  await Promise.all([call(A, 'markReady', made.roomId), call(B, 'markReady', made.roomId)]);
  let both = 0;
  for (let i = 0; i < 4; i++) {
    const [ca, cb] = await Promise.all([call(A, 'claimRound', made.roomId, i), call(B, 'claimRound', made.roomId, i)]);
    const W = docs(env.emu).find((d) => d._id === made.roomId + '_w' + i);
    rep.log(`word ${i + 1}: host first=${ca.first} (${ca.score}) guest first=${cb.first} (${cb.score}); stored W winner=${W && W.winner}`);
    if (ca.first && cb.first) both++;
  }
  rep.expect(both === 0, `never two "first" winners for one word (happened ${both}/4)`);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT ${STYLE} lag=${LAG}: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
