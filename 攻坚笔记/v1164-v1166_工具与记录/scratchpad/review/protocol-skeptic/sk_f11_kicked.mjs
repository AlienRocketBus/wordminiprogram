// F11: G1 sees the ACK but none of its writes land for ~20 s -> host unacks and plays G2.
// Then G1's writes recover; its word-1 timeout writes W0=''. What happens to G2's word 1, and to G1's verdict?
import { env, call, bg, bgResult, wait, ev, doc, docs, sleep, out } from './slib.mjs';
const E = await env({ latencyMs: 40, jitterMs: 20, consistencyLagMs: 0, permissionMode: 'rules' });
const emu = E.emu;
try {
  const A = await E.phone('房主'), G1 = await E.phone('客一'), G2 = await E.phone('客二');
  const m = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await wait(A, m.roomId);
  const f = emu.fault({ uid: G1.cloudUid, action: 'database.updateDocument', do: 'abort' });   // G1's writes fail
  const t0 = Date.now();
  const j1 = await call(G1, 'joinRoom', m.roomId, {});
  out('G1 joinRoom ->', { ok: j1.ok }, 'at', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  out('G1 markReady ->', (await call(G1, 'markReady', m.roomId)).ok);
  // wait for the host to give up on G1 (unack -> open, seat 1)
  await new Promise(async (res) => { for (let k = 0; k < 60; k++) { const R = doc(emu, m.roomId); if (R.status === 'open' && R.seat >= 1) return res(); await sleep(500); } res(); });
  out('host gave up on G1 at', ((Date.now() - t0) / 1000).toFixed(1) + 's; room', (({ status, seat }) => ({ status, seat }))(doc(emu, m.roomId)));
  f.remove();
  out('G1 word-1 timeout skipRound(0) ->', await call(G1, 'skipRound', m.roomId, 0));
  const j2 = await call(G2, 'joinRoom', m.roomId, {});
  const e = await ev(A, 15000);
  out('G2 joinRoom ->', j2.ok, ' host event', e && Object.keys(e).filter((x) => e[x] === true).join(','), e && e.room && e.room.guestName);
  await Promise.all([call(A, 'markReady', m.roomId), call(G2, 'markReady', m.roomId)]);
  const c2 = await call(G2, 'claimRound', m.roomId, 0);
  out('real match word 1: G2 spells it, claimRound(0) ->', { first: c2.first, score: c2.score, winner: c2.winner }, '; W0 created by', (doc(emu, m.roomId + '_w0') || {})._openid === G1.cloudUid ? 'G1 (the replaced guest)' : '?');
  const rs = await call(G1, 'roundState', m.roomId);
  out('G1 roundState: hostReady', rs.hostReady, 'winners', rs.winners, '(UI sets _oppSeen when hostReady)');
  let g; for (let k = 0; k < 4; k++) { g = await call(G1, 'opponentGone', m.roomId); await sleep(1000); }
  out('G1 opponentGone ->', g);
  out('G1 claimAbandonWin ->', await call(G1, 'claimAbandonWin', m.roomId));
  const ha = await call(A, 'opponentGone', m.roomId);
  out('host (playing G2) opponentGone ->', ha, '; host roundState guest', (await call(A, 'roundState', m.roomId)).oppName);
} catch (e) { out('THREW', String(e && e.stack || e).slice(0, 500)); }
await E.done(); process.exit(0);
