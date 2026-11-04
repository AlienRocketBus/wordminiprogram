// EXP13: guest G1 sees the host's ACK and enters the match, but its writes ("acked", ready, beats) don't get through
// for ~20 s (weak uplink). The host never hears back -> unack after seatStaleMs (20 s) -> room reopens -> G2 joins
// and the host plays G2 (host writes hostReady). G1, still on its battle screen, then sees: hostReady=true (so the UI
// marks _oppSeen) and room.guestId != me 3 times -> opponentGone {gone:true, kicked:true}. The UI ignores `kicked`:
// `if (g.gone && !st._oppSeen)` is false -> `if (g.gone)` -> 「🏆 对手已离场，本局你胜」 + ranked win for a match G1
// never played.
import { setup, call, startWait, waitEv, launch, result, docs, sleep, makeReport } from './lib.mjs';
const rep = makeReport('EXP13 kicked guest is told it won');
const env = await setup({ permissionMode: 'rules', latencyMs: 60, jitterMs: 30, consistencyLagMs: 300 });
const E = env.emu;
try {
  const A = await env.phone('host'), G1 = await env.phone('g1'), G2 = await env.phone('g2');
  const made = await call(A, 'createRoom', { mode: 'A', hostRating: 1000, wordCount: 5 });
  await sleep(500);
  await startWait(A, made.roomId, { ms: 120000 });
  const up = E.fault({ uid: G1.cloudUid, action: 'database.updateDocument', collection: 'hansen_pk_rooms', do: 'abort' });
  const j1 = await call(G1, 'joinRoom', made.roomId, {});
  rep.log('G1 joinRoom ->', j1.ok, '(its uplink for updates is failing)');
  await call(G1, 'markReady', made.roomId);
  /* G1's battle screen: nobody types, word 1's 20 s run out on G1's phone -> its UI calls skipRound(0) */
  setTimeout(() => { call(G1, 'skipRound', made.roomId, 0).then((r) => rep.log('   (G1 word-1 timeout) skipRound(0) ->', JSON.stringify(r))); }, 19500);
  /* G1's UI polls while on the battle screen */
  let lastG = null, lastS = null;
  const t0 = Date.now();
  let g2done = false;
  while (Date.now() - t0 < 60000) {
    const R = docs(E).find((d) => d._id === made.roomId) || {};
    if (!g2done && R.status === 'open' && R.seat === 1) {
      rep.log(`t+${Math.round((Date.now() - t0) / 1000)}s host gave up on G1 (unack) -> room open again at seat 1; G2 joins`);
      up.remove();
      const j2 = await call(G2, 'joinRoom', made.roomId, {});
      const ev = await waitEv(A, 20000);
      rep.log('   G2 joinRoom ->', j2.ok, ' host event:', ev && Object.keys(ev).join(','), ev && ev.room && ev.room.guestName);
      await Promise.all([call(A, 'markReady', made.roomId), call(G2, 'markReady', made.roomId)]);
      g2done = true;
      /* the real match (host vs G2), word 1: G2 spells it first */
      const c2 = await call(G2, 'claimRound', made.roomId, 0), ch = await call(A, 'roundState', made.roomId);
      rep.log('   real match word 1: G2 claimRound(0) ->', JSON.stringify({ first: c2.first, score: c2.score, winner: c2.winner }), ' host sees winners', JSON.stringify(ch.winners));
      const W0 = docs(E).find((d) => d._id === made.roomId + '_w0');
      rep.log('   W0 was written by', W0 && (W0._openid === G1.cloudUid ? 'G1 (the replaced guest!)' : W0._openid === G2.cloudUid ? 'G2' : 'host'));
    }
    lastS = await call(G1, 'roundState', made.roomId);
    lastG = await call(G1, 'opponentGone', made.roomId);
    if (lastG && lastG.gone) break;
    await sleep(4000);
  }
  rep.log('G1 roundState: hostReady=' + (lastS && lastS.hostReady) + ' (UI sets _oppSeen) ; G1 opponentGone ->', lastG);
  rep.expect(!(lastG && lastG.gone && lastS && lastS.hostReady), 'a guest the host replaced is not presented as "opponent left" with _oppSeen=true (UI would award 本局你胜)');
  const w = await call(G1, 'claimAbandonWin', made.roomId);
  rep.log('G1 claimAbandonWin (what the UI does next) ->', w);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
