// EXP6: host has written the ACK (room.guestId = guest) but has not yet seen the guest's "acked" reply,
// and the host closes the waiting screen / the page (UI close() -> _cancelWait() + leaveRoom()).
// leaveMine() sees role=host, started=false -> REMOVES the room. The guest had already seen the ACK and is in
// the match. From then on loadView() throws 'gone'; opponentGone()/roundState() return {ok:false,kind:'gone'}
// which the UI ignores (checkOpponentAlive: `if (!g || !g.ok ...) return;`, pollOpponent: 「网络不稳，正在重连…」).
import { setup, call, startWait, waitEv, launch, result, docs, sleep, makeReport } from './lib.mjs';
const rep = makeReport('EXP6 host removes room after ACK, before seeing the guest\'s reply');
const env = await setup({ permissionMode: 'rules', latencyMs: 60, jitterMs: 30, consistencyLagMs: 300 });
const E = env.emu;
try {
  const A = await env.phone('host'), B = await env.phone('guest');
  const made = await call(A, 'createRoom', { mode: 'A', hostRating: 1000, wordCount: 3 });
  await sleep(500);
  await startWait(A, made.roomId);
  /* the guest's write path is slow for a moment (its "acked" reply is delayed) */
  const h = E.hold({ uid: B.cloudUid, action: 'database.updateDocument', collection: 'hansen_pk_rooms' });
  await launch(B, 'j', 'joinRoom', made.roomId, {});
  /* wait until the host has written the ACK */
  for (let i = 0; i < 100; i++) { const R = docs(E).find((d) => d._id === made.roomId); if (R && R.guestId) break; await sleep(100); }
  const j = await result(B, 'j', 20000);
  rep.log('guest joinRoom ->', j.r && { ok: j.r.ok, mySide: j.r.mySide });
  /* host taps 「← 关掉房间」 (UI close(): cancel the wait, then leaveRoom) */
  await A.eval(() => { try { window.__cancel && window.__cancel(); } catch (e) {} return true; });
  const lv = await call(A, 'leaveRoom', made.roomId);
  rep.log('host leaveRoom ->', lv, 'room still on server?', !!docs(E).find((d) => d._id === made.roomId));
  h.release();
  await call(B, 'markReady', made.roomId);
  await sleep(2500);
  for (let k = 0; k < 4; k++) {
    const g = await call(B, 'opponentGone', made.roomId);
    const rs = await call(B, 'roundState', made.roomId);
    rep.log(`t+${k * 4}s guest opponentGone ->`, { ok: g.ok, gone: g.gone, kind: g.kind }, ' roundState ->', { ok: rs.ok, kind: rs.kind });
    await sleep(4000);
  }
  const g = await call(B, 'opponentGone', made.roomId);
  rep.expect(g.ok === true && g.gone === true, 'guest is told the host is gone (the UI only acts on ok:true + gone:true)');
  const cl = await call(B, 'claimRound', made.roomId, 0);
  rep.log('guest claimRound(0) in the dead room ->', { ok: cl.ok, first: cl.first, score: cl.score });
  const rr = await call(B, 'reportResult', made.roomId, 100);
  rep.log('guest reportResult at the end ->', { ok: rr.ok, kind: rr.kind, reason: rr.reason });
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
