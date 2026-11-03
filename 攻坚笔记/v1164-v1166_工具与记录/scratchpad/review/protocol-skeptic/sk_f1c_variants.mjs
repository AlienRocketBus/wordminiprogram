// F1(b): no read lag. The add commits but its reply is lost (connection reset); the wrapped add retries,
// hits its own duplicate; then the read-back's reads fail for ~1 s. What does each caller report?
import { env, call, bg, bgResult, wait, ev, docs, doc, sleep, out } from './slib.mjs';
const NREADFAIL = Number(process.argv[2] || 3);
const E = await env({ latencyMs: 50, jitterMs: 20, consistencyLagMs: 0, permissionMode: 'rules' });
const emu = E.emu;
function arm(uid) {
  let armed = false;
  const fa = emu.fault({ uid, action: 'database.addDocument', test: () => { armed = true; return true; }, do: 'commitThenAbort', times: 1 });
  const fr = emu.fault({ uid, action: 'database.queryDocument', test: () => armed, do: (process.argv[3]==='hang' ? 'hang' : 'abort'), ms: 9000, times: NREADFAIL });
  return () => { fa.remove(); fr.remove(); };
}
try {
  const A = await E.phone('房主'), B = await E.phone('客人'), C = await E.phone('路人');
  // (1) joinRoom
  const m = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await wait(A, m.roomId);
  await sleep(300);
  let disarm = arm(B.cloudUid);
  const j = await call(B, 'joinRoom', m.roomId, {});
  disarm();
  out('(1) joinRoom ->', { ok: j.ok, kind: j.kind, reason: String(j.reason || '').slice(0, 90) });
  const seat = docs(emu).find((d) => d.kind === 'seat' && d.roomId === m.roomId);
  out('    seat on server:', seat ? { id: seat._id.slice(-3), byGuest: seat._openid === B.cloudUid, acked: !!seat.acked } : null);
  const e1 = await ev(A, 8000);
  out('    host event within 8s:', e1 && Object.keys(e1).filter((k) => e1[k] === true).join(','), e1 && e1.room && e1.room.guestName);
  await sleep(1500);
  const R1 = doc(emu, m.roomId);
  out('    room now:', { status: R1.status, guest: R1.guestName || '-', seat: R1.seat });
  await A.eval(() => { try { window.__cancel && window.__cancel(); } catch (e) {} return 1; });
  await call(A, 'leaveRoom', m.roomId); await call(B, 'leaveRoom', m.roomId);
  await sleep(800);

  // (2) claimRound during a match
  const m2 = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await wait(A, m2.roomId);
  const j2 = await call(B, 'joinRoom', m2.roomId, {});
  const e2 = await ev(A, 15000);
  out('(2) match start', j2.ok, e2 && Object.keys(e2).filter((k) => e2[k] === true).join(','));
  await Promise.all([call(A, 'markReady', m2.roomId), call(B, 'markReady', m2.roomId)]);
  disarm = arm(B.cloudUid);
  const c = await call(B, 'claimRound', m2.roomId, 0);
  disarm();
  out('    guest claimRound(0) ->', { ok: c.ok, kind: c.kind, first: c.first, score: c.score, reason: String(c.reason || '').slice(0, 80) });
  const W = doc(emu, m2.roomId + '_w0');
  out('    W0 on server:', W && { winner: W.winner, createdByGuest: W._openid === B.cloudUid });
  await sleep(500);
  const sa = await call(A, 'roundState', m2.roomId);
  out('    host roundState winners:', sa.winners);
  const sb = await call(B, 'roundState', m2.roomId);
  out('    guest roundState winners:', sb.winners, '(guest cache)');
  const c2 = await call(B, 'claimRound', m2.roomId, 0);
  out('    guest claimRound(0) again ->', { ok: c2.ok, first: c2.first, score: c2.score });
  await A.eval(() => { try { window.__cancel && window.__cancel(); } catch (e) {} return 1; });
  await call(A, 'leaveRoom', m2.roomId); await call(B, 'leaveRoom', m2.roomId);
  await sleep(800);

  // (3) createRoom
  disarm = arm(A.cloudUid);
  const m3 = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  disarm();
  out('(3) createRoom ->', { ok: m3.ok, kind: m3.kind, reason: String(m3.reason || '').slice(0, 80) });
  const rooms = docs(emu).filter((d) => d.kind === 'room' && d.status === 'open' && d._openid === A.cloudUid);
  out('    open rooms by host on server:', rooms.map((r) => r._id));
  const lr = await call(C, 'listRooms');
  out('    stranger listRooms sees:', (lr.rooms || []).map((r) => r._id));
  out('    host _currentRoomId:', await A.eval(() => window.HansenPkRoom._currentRoomId()));
} catch (e) { out('THREW', String(e && e.stack || e)); }
await E.done(); process.exit(0);
