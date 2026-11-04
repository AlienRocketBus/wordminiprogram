// EXP7: a stranger (third account, normal client permissions under READONLY) squats docs of someone else's room.
//  (a) win docs R_w<i> with a forged `by` = host key: accepted by isWinDoc() (no creator check) -> every round is
//      decided before anyone types; host gets first:true/100, guest is forced off each word (A mode).
//  (b) seat docs R_s<e> marked left -> host bumps through epochs; real guests are told "taken".
import { setup, call, startWait, waitEv, launch, result, docs, sleep, makeReport } from './lib.mjs';
const rep = makeReport('EXP7 squatting other people\'s seat / win docs');
const env = await setup({ permissionMode: 'rules', latencyMs: 50, jitterMs: 30, consistencyLagMs: 300 });
const E = env.emu;
/* the stranger uses the page's own SDK instance to add arbitrary docs (what any logged-in client can do) */
const addAs = (p, doc) => p.eval(async (doc) => {
  const app = await window.HansenAuth._app();
  const r = await app.database().collection('hansen_pk_rooms').add(doc);
  return r && (r.code ? { code: r.code } : { id: r.id || r._id || (r.data && r.data._id) });
}, doc);
try {
  const A = await env.phone('host'), B = await env.phone('guest'), M = await env.phone('stranger');
  /* (a) */
  const made = await call(A, 'createRoom', { mode: 'A', hostRating: 1000, wordCount: 5 });
  await sleep(500);
  /* the stranger reads the public list, learns roomId + hostId, and pre-creates the 5 win docs */
  const lr = await call(M, 'listRooms');
  const item = lr.rooms.find((x) => x._id === made.roomId);
  const Rpub = await M.eval(async (rid) => { const app = await window.HansenAuth._app(); const r = await app.database().collection('hansen_pk_rooms').doc(rid).get(); return r.data && r.data[0]; }, made.roomId);
  rep.log('stranger sees room in list:', !!item, ' hostId readable:', Rpub && Rpub.hostId);
  for (let i = 0; i < 5; i++) {
    const r = await addAs(M, { _id: made.roomId + '_w' + i, proto: 2, kind: 'win', roomId: made.roomId, i, winner: 'host', by: Rpub.hostId, at: Date.now(), nonce: 'x' });
    if (i === 0) rep.log('stranger add W0 ->', r);
  }
  await startWait(A, made.roomId);
  const j = await call(B, 'joinRoom', made.roomId, {});
  await waitEv(A, 20000);
  await Promise.all([call(A, 'markReady', made.roomId), call(B, 'markReady', made.roomId)]);
  await sleep(800);
  /* like the UI: both poll roundState every second while the word is on screen */
  const [sa, sb] = await Promise.all([call(A, 'roundState', made.roomId), call(B, 'roundState', made.roomId)]);
  rep.log('before anyone typed: host sees winners', sa.winners, '/ guest sees winners', sb.winners);
  const [ca, cb] = await Promise.all([call(A, 'claimRound', made.roomId, 0), call(B, 'claimRound', made.roomId, 0)]);
  rep.log('host claimRound(0) ->', { first: ca.first, score: ca.score, winner: ca.winner }, ' guest claimRound(0) ->', { first: cb.first, score: cb.score, winner: cb.winner });
  const W0 = docs(E).find((d) => d._id === made.roomId + '_w0');
  rep.log('W0 on server: winner=' + W0.winner + ' by=' + (W0.by === A.key ? 'HOST key (forged)' : W0.by) + ' created by=' + (W0._openid === M.cloudUid ? 'STRANGER' : W0._openid));
  rep.expect(!(sb.winners && sb.winners.length === 5), 'a win doc created by a non-player is ignored (guest must not see all 5 words already decided)');
  rep.expect(!(ca.first === true && W0._openid === M.cloudUid), 'host does not get first-score for a round decided by a stranger\'s doc');
  await A.eval(() => { try { window.__cancel && window.__cancel(); } catch (e) {} return true; });
  await call(A, 'leaveRoom', made.roomId); await call(B, 'leaveRoom', made.roomId);
  await sleep(500);

  /* (b) seat squatting */
  const m2 = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await sleep(500);
  for (let e = 0; e < 8; e++) await addAs(M, { _id: m2.roomId + '_s' + e, proto: 2, kind: 'seat', roomId: m2.roomId, epoch: e, guestId: 'uSTRANGER', guestName: '路人', createdAt: Date.now(), guestBeat: Date.now(), left: true });
  await startWait(A, m2.roomId);
  const t0 = Date.now();
  const tries = [];
  for (let k = 0; k < 3; k++) {
    const jj = await call(B, 'joinRoom', m2.roomId, {});
    const R = docs(E).find((d) => d._id === m2.roomId);
    tries.push(`t+${Math.round((Date.now() - t0) / 1000)}s join -> ${jj.ok ? 'ok' : jj.kind} (room.seat now ${R && R.seat})`);
    if (jj.ok) break;
    await sleep(2000);
  }
  tries.forEach((x) => rep.log('   ' + x));
  rep.expect(tries.some((x) => / ok /.test(x)), 'a real guest can join although a stranger squatted the seat ids');
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
