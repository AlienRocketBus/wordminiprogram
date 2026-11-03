// EXP6b: deferred removal vs a returning player. The host claimed the abandon win (room status done, endedAt=t),
// went back to the ladder/lobby (every listRooms schedules sweepMyDeadRooms). After TM.doneGraceMs (product: 120 s;
// shortened here with the test knob so the run is quick) the sweep removes the room. The guest, coming back later,
// can no longer learn the verdict: opponentGone/roundState -> {ok:false,kind:'gone'} (UI: 「网络不稳，正在重连…」),
// claims still succeed, reportResult -> gone (UI after 5 tries: 「这一局的结果没拿到」).
import { setup, call, startWait, waitEv, docs, sleep, makeReport } from './lib.mjs';
const rep = makeReport('EXP6b room swept 2 min after an abandon verdict; guest comes back later');
const env = await setup({ permissionMode: 'legacy', latencyMs: 50, jitterMs: 30, consistencyLagMs: 300 });
try {
  const A = await env.phone('host'), B = await env.phone('guest');
  const made = await call(A, 'createRoom', { mode: 'A', hostRating: 1000, wordCount: 5 });
  await sleep(500);
  await startWait(A, made.roomId);
  await call(B, 'joinRoom', made.roomId, {});
  await waitEv(A, 20000);
  await Promise.all([call(A, 'markReady', made.roomId), call(B, 'markReady', made.roomId)]);
  await call(B, 'roundState', made.roomId);
  const ca = await call(A, 'claimAbandonWin', made.roomId);
  await call(A, 'leaveRoom', made.roomId);            // host's result screen leaves the room (kept as 'done')
  rep.log('host claimAbandonWin', ca.ok, '-> room kept as done for the grace period');
  await A.eval(() => { window.HansenPkRoom._setTimingForTest({ doneGraceMs: 1500 }); return true; });   // stand-in for "2 minutes later"
  await sleep(2000);
  await call(A, 'listRooms');                         // host is back in the ladder/lobby
  await sleep(2500);
  rep.log('room still on the server?', !!docs(env.emu).find((d) => d._id === made.roomId));
  /* guest comes back */
  const out = [];
  for (let k = 0; k < 4; k++) {
    const g = await call(B, 'opponentGone', made.roomId), rs = await call(B, 'roundState', made.roomId);
    out.push(`opponentGone ok=${g.ok} kind=${g.kind || '-'} / roundState ok=${rs.ok} kind=${rs.kind || '-'}`);
    await sleep(1200);
  }
  out.forEach((x) => rep.log('   guest ' + x));
  const cl = await call(B, 'claimRound', made.roomId, 1);
  const rr = await call(B, 'reportResult', made.roomId, 300);
  rep.log('   guest claimRound(1) ->', { ok: cl.ok, first: cl.first }, ' reportResult ->', { ok: rr.ok, kind: rr.kind });
  rep.expect(rr.ok && rr.result === 'lose', 'the returning guest still learns it lost by abandon');
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
