// F2: guest goes silent > 60 s; host claims the abandon win; what does the returning guest's opponentGone say,
// and can the guest keep scoring in the decided room? Then the mirror (guest claims, host returns).
import { env, call, wait, ev, doc, sleep, out } from './slib.mjs';
const E = await env({ latencyMs: 40, jitterMs: 20, consistencyLagMs: 0, permissionMode: 'rules' });
async function match(A, B) {
  const m = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await wait(A, m.roomId);
  const j = await call(B, 'joinRoom', m.roomId, {});
  const e = await ev(A, 15000);
  await Promise.all([call(A, 'markReady', m.roomId), call(B, 'markReady', m.roomId)]);
  return m.roomId;
}
async function silentUntilGone(watcher, silent, rid) {
  await call(silent, 'stopHeartbeat');
  const t0 = Date.now(); let g;
  for (;;) { g = await call(watcher, 'opponentGone', rid); if (g.gone || Date.now() - t0 > 90000) break; await sleep(4000); }
  return { g, secs: Math.round((Date.now() - t0) / 1000) };
}
try {
  const A = await E.phone('房主'), B = await E.phone('客人');
  const rid = await match(A, B);
  out('(1) match', rid);
  const r1 = await silentUntilGone(A, B, rid);
  out('    host opponentGone after guest silent', r1.secs + 's:', r1.g);
  out('    host claimAbandonWin:', await call(A, 'claimAbandonWin', rid));
  const R = doc(E.emu, rid);
  out('    room on server:', { status: R.status, endedBy: R.endedBy, abandonWin: R.abandonWin, hostScore: R.hostScore });
  out('    guest returns -> opponentGone:', await call(B, 'opponentGone', rid));
  const rs = await call(B, 'roundState', rid);
  out('    guest roundState:', { status: rs.status, endedBy: rs.endedBy, hostScore: rs.hostScore });
  for (let i = 0; i < 3; i++) { const c = await call(B, 'claimRound', rid, i); out(`    guest claimRound(${i}):`, { ok: c.ok, first: c.first, score: c.score }); }
  out('    guest reportResult(300):', await call(B, 'reportResult', rid, 300));
  // mirror
  const rid2 = await match(A, B);
  out('(2) match', rid2);
  const r2 = await silentUntilGone(B, A, rid2);
  out('    guest opponentGone after host silent', r2.secs + 's:', r2.g);
  out('    guest claimAbandonWin:', await call(B, 'claimAbandonWin', rid2));
  out('    host returns -> opponentGone:', await call(A, 'opponentGone', rid2));
  const c = await call(A, 'claimRound', rid2, 0); out('    host claimRound(0):', { ok: c.ok, first: c.first, score: c.score });
  out('    host reportResult(200):', await call(A, 'reportResult', rid2, 200));
} catch (e) { out('THREW', String(e && e.stack || e)); }
await E.done(); process.exit(0);
