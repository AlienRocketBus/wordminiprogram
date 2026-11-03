// F12: the guest has seen the host's abandon claim; one later read is served from a replica that is behind.
import { env, call, wait, ev, doc, sleep, out } from './slib.mjs';
const E = await env({ latencyMs: 40, jitterMs: 20, consistencyLagMs: 0, permissionMode: 'rules' });
const emu = E.emu;
try {
  const A = await E.phone('房主'), B = await E.phone('客人');
  const m = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await wait(A, m.roomId);
  await call(B, 'joinRoom', m.roomId, {}); await ev(A, 15000);
  await Promise.all([call(A, 'markReady', m.roomId), call(B, 'markReady', m.roomId)]);
  await call(A, 'opponentGone', m.roomId); await call(B, 'stopHeartbeat');
  let g; const t0 = Date.now();
  for (;;) { g = await call(A, 'opponentGone', m.roomId); if (g.gone || Date.now() - t0 > 90000) break; await sleep(4000); }
  const tc = Date.now(); await call(A, 'claimAbandonWin', m.roomId);
  await sleep(800);
  const rs = await call(B, 'roundState', m.roomId);
  out('guest fresh read:', { status: rs.status, endedBy: rs.endedBy, hostScore: rs.hostScore, abandonWin: rs.room && rs.room.abandonWin });
  emu.knobs.consistencyLagMs = Date.now() - tc + 1500;    // next reads come from a replica 1.5 s before the claim
  const r = await call(B, 'reportResult', m.roomId, 500);
  out('guest reportResult(500) on a lagging replica:', r);
  emu.knobs.consistencyLagMs = 0;
  out('guest reportResult(500) when the replica catches up:', await call(B, 'reportResult', m.roomId, 500));
} catch (e) { out('THREW', String(e && e.stack || e).slice(0, 500)); }
await E.done(); process.exit(0);
