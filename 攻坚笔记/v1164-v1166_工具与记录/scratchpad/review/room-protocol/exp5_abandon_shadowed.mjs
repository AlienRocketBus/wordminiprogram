// EXP5: one side claims the abandon win (the other was away > 60 s). When the "abandoned" side comes back,
// opponentGone() must tell it the match is over. claimAbandonWin writes score 1 for the claimer, and
// opponentGone() checks "opponent already has a score" (oppFinished) BEFORE the abandon/ended check,
// so the returning player is told {oppFinished} and plays on alone; only reportResult at the very end says "lose".
import { setup, call, startWait, waitEv, docs, sleep, makeReport } from './lib.mjs';
const rep = makeReport('EXP5 abandon verdict shadowed by oppFinished');
const env = await setup({ permissionMode: 'legacy', latencyMs: 50, jitterMs: 30, consistencyLagMs: 300 });
async function match(A, B) {
  const made = await call(A, 'createRoom', { mode: 'A', hostRating: 1000, wordCount: 5 });
  await sleep(500);
  await startWait(A, made.roomId);
  const j = await call(B, 'joinRoom', made.roomId, {});
  await waitEv(A, 20000);
  await Promise.all([call(A, 'markReady', made.roomId), call(B, 'markReady', made.roomId)]);
  await sleep(600);
  return made.roomId;
}
try {
  const A = await env.phone('host'), B = await env.phone('guest');
  /* (1) host claims abandon (guest was away) -> guest comes back */
  let rid = await match(A, B);
  const ca = await call(A, 'claimAbandonWin', rid);
  rep.log('(1) host claimAbandonWin ->', ca);
  await sleep(800);
  const g1 = await call(B, 'opponentGone', rid);
  rep.log('    returning guest opponentGone ->', g1);
  rep.expect(g1.ended === true && g1.abandonWin === 'host', 'guest is told the match ended (ended/abandonWin) — UI line ~1384 relies on this');
  const rs1 = await call(B, 'roundState', rid);
  rep.log('    guest roundState: status=' + rs1.status + ' endedBy=' + rs1.endedBy + ' round=' + rs1.round);
  const cl = await call(B, 'claimRound', rid, 0);
  rep.log('    guest can still claim rounds in the decided match:', { ok: cl.ok, first: cl.first, score: cl.score });
  const rr = await call(B, 'reportResult', rid, 300);
  rep.log('    ...and only at the end reportResult says:', rr);
  await call(A, 'leaveRoom', rid); await call(B, 'leaveRoom', rid);
  await sleep(500);

  /* (2) guest claims abandon (host was away) -> host comes back */
  rid = await match(A, B);
  const cb = await call(B, 'claimAbandonWin', rid);
  rep.log('(2) guest claimAbandonWin ->', cb);
  await call(B, 'leaveRoom', rid);   // the guest's UI shows the result and leaves (seat marked left)
  await sleep(800);
  const g2 = await call(A, 'opponentGone', rid);
  rep.log('    returning host opponentGone ->', g2);
  rep.expect(g2.gone === true || g2.ended === true, 'host is told the match is over (gone/ended)');
  const rr2 = await call(A, 'reportResult', rid, 500);
  rep.log('    ...host reportResult at the end:', rr2);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
