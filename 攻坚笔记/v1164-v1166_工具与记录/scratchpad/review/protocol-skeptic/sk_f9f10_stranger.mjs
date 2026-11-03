// F9/F10: an outsider with an ordinary logged-in account writes docs through the real SDK.
import { env, call, bg, bgResult, wait, ev, doc, docs, sleep, out } from './slib.mjs';
const E = await env({ latencyMs: 40, jitterMs: 20, consistencyLagMs: 0, permissionMode: 'rules' });
const emu = E.emu;
const sdkAdd = (p, list) => p.eval(async (list) => {
  const app = await window.HansenAuth._app(); const col = app.database().collection('hansen_pk_rooms'); const r = [];
  for (const d of list) { try { const x = await col.add(d); r.push(x && x.code ? 'code:' + x.code : 'ok'); } catch (e) { r.push('threw:' + String(e && e.message || e).slice(0, 60)); } }
  return r;
}, list);
const sdkRead = (p, id) => p.eval(async (id) => { const app = await window.HansenAuth._app(); const r = await app.database().collection('hansen_pk_rooms').doc(id).get(); return r && r.data && r.data[0]; }, id);
try {
  const A = await E.phone('房主'), B = await E.phone('客人'), X = await E.phone('捣乱的人'), C = await E.phone('另一个客人');
  // F9: squat win docs of a live match
  const m = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await wait(A, m.roomId);
  await call(B, 'joinRoom', m.roomId, {}); await ev(A, 15000);
  const R = await sdkRead(X, m.roomId);   // anyone can read the room (READONLY)
  out('(F9) stranger reads the live room: status', R && R.status, 'hostId', R && R.hostId ? 'visible' : '-');
  const forged = [0, 1, 2, 3].map((i) => ({ _id: m.roomId + '_w' + i, proto: 2, kind: 'win', roomId: m.roomId, i, winner: i < 2 ? 'host' : '', by: i < 2 ? R.hostId : 'u0', at: Date.now() }));
  out('    stranger adds W0..W3:', await sdkAdd(X, forged));
  await Promise.all([call(A, 'markReady', m.roomId), call(B, 'markReady', m.roomId)]);
  const sa = await call(A, 'roundState', m.roomId), sb = await call(B, 'roundState', m.roomId);
  out('    before anyone typed: host sees winners', sa.winners, ' guest sees', sb.winners);
  const ca = await call(A, 'claimRound', m.roomId, 0), cb = await call(B, 'claimRound', m.roomId, 1), cc = await call(B, 'claimRound', m.roomId, 2), cd = await call(A, 'claimRound', m.roomId, 3);
  out('    host claimRound(0):', { first: ca.first, score: ca.score }, ' guest claimRound(1):', { first: cb.first, score: cb.score }, ' guest claimRound(2) (squatted ""):', { first: cc.first, score: cc.score }, ' host claimRound(3):', { first: cd.first, score: cd.score });
  const W0 = doc(emu, m.roomId + '_w0');
  out('    server W0: by==hostKey', W0.by === A.key, ' createdBy stranger', W0._openid === X.cloudUid);
  // F10a: flood the public list
  const far = Date.now() + 365 * 864e5;
  const fakes = Array.from({ length: 40 }, (_, k) => ({ _id: 'rfake' + k, proto: 2, kind: 'room', status: 'open', isPrivate: false, mode: 'A', askMode: 'cn', seed: 1, wordCount: 10, hostId: 'ufake' + k, hostName: '小蜂' + k, hostRating: 1000, guestId: '', seat: 0, createdAt: far + k, heartbeatAt: far + k, hostBeat: far }));
  out('(F10a) stranger adds 40 fake rooms:', (await sdkAdd(X, fakes)).filter((s) => s === 'ok').length, 'ok');
  const real = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await wait(A, real.roomId);
  const lr = await call(C, 'listRooms');
  out('    another kid listRooms: n=', (lr.rooms || []).length, ' real room listed?', (lr.rooms || []).some((r) => r._id === real.roomId), ' first:', (lr.rooms || []).slice(0, 2).map((r) => r.hostName));
  const t0 = Date.now(); const jf = await call(C, 'joinRoom', 'rfake0', {});
  out('    joining a fake ->', String(jf.reason || '').slice(0, 20), 'after', Math.round((Date.now() - t0) / 1000), 's');
  // F10b: squat seats of the real room
  const seats = Array.from({ length: 8 }, (_, e) => ({ _id: real.roomId + '_s' + e, proto: 2, kind: 'seat', roomId: real.roomId, epoch: e, guestId: 'ux', guestName: 'x', createdAt: Date.now(), guestBeat: Date.now(), left: true }));
  out('(F10b) stranger squats seats s0..s7:', (await sdkAdd(X, seats)).filter((s) => s === 'ok').length, 'ok');
  for (let k = 0; k < 3; k++) {
    await sleep(3500);
    const j = await call(C, 'joinRoom', real.roomId, {});
    out(`    t+${(k + 1) * 3.5}s real guest join ->`, { ok: j.ok, kind: j.kind }, ' room.seat now', (doc(emu, real.roomId) || {}).seat);
  }
} catch (e) { out('THREW', String(e && e.stack || e).slice(0, 500)); }
await E.done(); process.exit(0);
