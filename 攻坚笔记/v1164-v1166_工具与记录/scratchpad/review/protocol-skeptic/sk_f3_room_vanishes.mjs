// F3(a): host leaves (close page / 关掉房间) after writing the ACK but before seeing the guest's reply.
// F3(b): host claims the abandon win, leaves the result screen, keeps matching; the sweep removes the done room;
//        the guest comes back afterwards.
import { env, call, bg, bgResult, wait, ev, doc, docs, sleep, out } from './slib.mjs';
const PART = process.argv[2] || 'a';
const E = await env({ latencyMs: 40, jitterMs: 20, consistencyLagMs: 0, permissionMode: 'rules' });
const emu = E.emu;
async function probeGuest(B, rid, label) {
  for (let k = 0; k < 4; k++) {
    const g = await call(B, 'opponentGone', rid), s = await call(B, 'roundState', rid);
    out(`    ${label} t+${k * 3}s opponentGone:`, { ok: g.ok, gone: g.gone, kind: g.kind, oppFinished: g.oppFinished, ended: g.ended }, ' roundState:', { ok: s.ok, kind: s.kind, status: s.status });
    await sleep(3000);
  }
  const c = await call(B, 'claimRound', rid, 3); out(`    ${label} claimRound(3):`, { ok: c.ok, first: c.first, score: c.score });
  const r = await call(B, 'reportResult', rid, 400); out(`    ${label} reportResult:`, { ok: r.ok, kind: r.kind, result: r.result, reason: String(r.reason || '').slice(0, 40) });
}
try {
  const A = await E.phone('房主'), B = await E.phone('客人');
  if (PART === 'a') {
    const m = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
    await wait(A, m.roomId);
    const h = emu.hold({ uid: B.cloudUid, action: 'database.updateDocument' });   // guest's acked/ready writes are slow
    const j = await call(B, 'joinRoom', m.roomId, {});
    out('(a) guest joinRoom ->', { ok: j.ok, kind: j.kind });
    out('    room:', (({ status, guestName }) => ({ status, guestName }))(doc(emu, m.roomId)), ' host events so far:', await A.eval(() => (window.__ev || []).length));
    await A.eval(() => { try { window.__cancel && window.__cancel(); } catch (e) {} return 1; });
    out('    host leaveRoom (close page / 关掉房间):', await call(A, 'leaveRoom', m.roomId), ' role was', await A.eval(() => window.HansenPkRoom._currentRole()));
    out('    room on server after host left:', doc(emu, m.roomId) ? 'still there' : 'REMOVED');
    out('    released held guest writes:', h.release());
    out('    guest markReady:', await call(B, 'markReady', m.roomId));
    await probeGuest(B, m.roomId, 'guest');
  } else {
    await A.eval(() => window.HansenPkRoom._setTimingForTest({ doneGraceMs: 5000 }));   // stand-in for the 2-min grace
    const m = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
    await wait(A, m.roomId);
    await call(B, 'joinRoom', m.roomId, {}); await ev(A, 15000);
    await Promise.all([call(A, 'markReady', m.roomId), call(B, 'markReady', m.roomId)]);
    await call(A, 'claimRound', m.roomId, 0);
    await call(A, 'opponentGone', m.roomId);
    await call(B, 'stopHeartbeat');
    let g; const t0 = Date.now();
    for (;;) { g = await call(A, 'opponentGone', m.roomId); if (g.gone || Date.now() - t0 > 90000) break; await sleep(4000); }
    out('(b) host sees guest gone:', g.gone, 'claim:', (await call(A, 'claimAbandonWin', m.roomId)).ok);
    out('    host leaves result screen:', await call(A, 'leaveRoom', m.roomId));
    await sleep(5500);
    await call(A, 'listRooms'); await sleep(2500);   // next ladder search runs the sweep
    out('    room on server after host sweep:', doc(emu, m.roomId) ? 'still there' : 'REMOVED', ' W0:', !!doc(emu, m.roomId + '_w0'));
    await probeGuest(B, m.roomId, 'returning guest');
  }
} catch (e) { out('THREW', String(e && e.stack || e)); }
await E.done(); process.exit(0);
