// EXP12: the classroom Wi-Fi drops for ~70 s in the middle of a match (both phones offline at once; the UI keeps
// polling opponentGone every 4 s, those reads fail). When the network comes back, each side's first successful
// opponentGone() sees the opponent's beat VALUE unchanged since before the outage (measured on its own clock) ->
// both are "gone" -> both claimAbandonWin -> the UI shows 「🏆 对手已离场，本局你胜」 on BOTH phones
// (hansen_pk_room_ui_v1065.js checkOpponentAlive: claimAbandonWin().then(showResult win), no read-back).
import { setup, call, startWait, waitEv, docs, sleep, makeReport } from './lib.mjs';
const rep = makeReport('EXP12 shared network outage > 60 s during a match');
const env = await setup({ permissionMode: 'legacy', latencyMs: 60, jitterMs: 30, consistencyLagMs: 300 });
try {
  const A = await env.phone('host'), B = await env.phone('guest');
  const made = await call(A, 'createRoom', { mode: 'A', hostRating: 1000, wordCount: 5 });
  await sleep(500);
  await startWait(A, made.roomId);
  await call(B, 'joinRoom', made.roomId, {});
  await waitEv(A, 20000);
  await Promise.all([call(A, 'markReady', made.roomId), call(B, 'markReady', made.roomId)]);
  for (let k = 0; k < 3; k++) { await Promise.all([call(A, 'opponentGone', made.roomId), call(B, 'opponentGone', made.roomId)]); await sleep(4000); }
  rep.log('both alive and polling; Wi-Fi drops for 70 s');
  env.emu.setOffline(true);
  const t0 = Date.now();
  let seen = '';
  while (Date.now() - t0 < 70000) {
    const [ga, gb] = await Promise.all([call(A, 'opponentGone', made.roomId), call(B, 'opponentGone', made.roomId)]);
    seen = `${ga.ok ? 'ok' : ga.kind}/${gb.ok ? 'ok' : gb.kind}`;
    await sleep(4000);
  }
  rep.log('during the outage opponentGone returned', seen);
  env.emu.setOffline(false);
  await sleep(1000);
  const [ga, gb] = await Promise.all([call(A, 'opponentGone', made.roomId), call(B, 'opponentGone', made.roomId)]);
  rep.log('first poll after Wi-Fi is back: host', ga, ' guest', gb);
  if (ga.gone && gb.gone) {
    const [wa, wb] = await Promise.all([call(A, 'claimAbandonWin', made.roomId), call(B, 'claimAbandonWin', made.roomId)]);
    rep.log('both claimAbandonWin ->', JSON.stringify(wa), JSON.stringify(wb));
    const R = docs(env.emu).find((d) => d._id === made.roomId), S = docs(env.emu).find((d) => d.kind === 'seat' && d.roomId === made.roomId);
    rep.log('server: room abandonWin=' + R.abandonWin + ', seat abandonWin=' + S.abandonWin);
  }
  rep.expect(!(ga.gone && gb.gone), 'the same outage does not make BOTH players the winner');
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
