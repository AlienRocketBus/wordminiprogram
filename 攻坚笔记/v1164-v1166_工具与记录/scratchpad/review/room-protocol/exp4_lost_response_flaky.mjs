// EXP4: flaky phone network, NO read lag.
//  (a) guest's seat add reaches the server but the response is lost (connection reset); wrapTimeout retries the add
//      300 ms later -> duplicate _id -> resolved {code:DATABASE_REQUEST_FAILED}; claim() reads back, but the next 3 reads
//      also fail (still flaky) -> readBack rejects -> claim() re-throws the duplicate error -> kind 'config'.
//      The seat IS the guest's (orphan): the host confirms it and the room is blocked; the guest sees 「云端设置还差一步」.
//  (b) same thing on claimRound(): the round winner's W doc lands, the client reports failure ->
//      UI gives the winner 0 points while the opponent's screen counts +100 for him.
import { setup, call, startWait, waitEv, launch, result, docs, sleep, makeReport } from './lib.mjs';
const rep = makeReport('EXP4 lost add response + 3 failed reads (flaky network, lag 0)');
const env = await setup({ permissionMode: 'rules', latencyMs: 60, jitterMs: 30, consistencyLagMs: 0 });
const E = env.emu;
async function flaky(p, fn, ...args) {
  /* hold this phone's next add, then arm: add commits but the reply is lost; the next 3 room reads fail */
  const h = E.hold({ uid: p.cloudUid, action: 'database.addDocument', collection: 'hansen_pk_rooms' });
  await launch(p, 'x', fn, ...args);
  for (let i = 0; i < 100 && !h.pending; i++) await sleep(50);
  E.fault({ uid: p.cloudUid, action: 'database.addDocument', collection: 'hansen_pk_rooms', do: 'commitThenAbort', times: 1 });
  E.fault({ uid: p.cloudUid, action: 'database.queryDocument', collection: 'hansen_pk_rooms', do: 'abort', times: 3 });
  h.release();
  return result(p, 'x', 60000);
}
try {
  const A = await env.phone('host'), B = await env.phone('guest');
  /* (a) seat */
  const made = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await sleep(500);
  await startWait(A, made.roomId);
  const j = await flaky(B, 'joinRoom', made.roomId, {});
  rep.log('(a) guest joinRoom ->', j.r ? { ok: j.r.ok, kind: j.r.kind, reason: (j.r.reason || '').slice(0, 120) } : j);
  const seat = docs(E).find((d) => d.kind === 'seat' && d.roomId === made.roomId);
  rep.log('    seat on server:', seat ? `${seat._id} created by guest=${seat._openid === B.cloudUid}` : '(none)');
  rep.expect(!(j.r && j.r.kind === 'config'), '(a) a duplicate of my OWN add is not reported as 「云端设置还差一步」');
  rep.expect(!seat || (j.r && j.r.ok), '(a) no orphan seat left behind when join reports failure');
  await sleep(6000);
  const R = docs(E).find((d) => d._id === made.roomId);
  rep.log('    6 s later, room:', R && `status=${R.status} guestId=${R.guestId ? (R.guestId === B.key ? 'THE GUEST (who was told it failed)' : R.guestId) : '-'}`);
  await A.eval(() => { try { window.__cancel && window.__cancel(); } catch (e) {} return true; });
  await call(A, 'leaveRoom', made.roomId); await call(B, 'leaveRoom', made.roomId);
  await sleep(800);

  /* (b) round claim during a match */
  const m2 = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await sleep(500);
  await startWait(A, m2.roomId);
  const j2 = await call(B, 'joinRoom', m2.roomId, {});
  const ev = await waitEv(A, 20000);
  rep.log('(b) match start: join', j2.ok, 'host event', ev && Object.keys(ev).join(','));
  await Promise.all([call(A, 'markReady', m2.roomId), call(B, 'markReady', m2.roomId)]);
  const c = await flaky(B, 'claimRound', m2.roomId, 0);
  rep.log('    guest claimRound(0) ->', c.r ? { ok: c.r.ok, kind: c.r.kind, first: c.r.first, score: c.r.score, reason: (c.r.reason || '').slice(0, 100) } : c);
  const W = docs(E).find((d) => d._id === m2.roomId + '_w0');
  rep.log('    W0 on server:', W && `winner=${W.winner} createdBy=${W._openid === B.cloudUid ? 'guest' : 'host'}`);
  await sleep(1500);
  const sa = await call(A, 'roundState', m2.roomId);
  rep.log('    host roundState winners:', sa.winners);
  rep.expect(!(c.r && c.r.ok === false && W && W.winner === 'guest'), '(b) the player whose W doc landed is told he won (UI: !r.ok -> after(0) 「⏱ 超时了」, 0 points; host screen counts +100 for him)');
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
