// EXP13: after a full game -> result -> 再来一局 (free room) -> new room -> 关掉, are all timers / pollers gone?
//        (stale pollResult / nextWord / heartbeat loops must not survive into the next screen)
import { setup, docs, sleep, report, H, toLobby, openRoom, joinRoomUI, census } from './lib.mjs';
const rep = report('EXP13 timers & pollers after a full game');
const env = await setup({ permissionMode: 'legacy', latencyMs: 30, jitterMs: 20, consistencyLagMs: 200 });
const reqs = (uid, since) => env.emu.log.filter((e) => e.uid === uid && e.t >= since && e.path === '/web').map((e) => (e.action || '').replace('database.', '') + ':' + String(e.docId || '').slice(-6));
try {
  const A = await env.phone('房主', { census: true, nick: '房主蜂' });
  const B = await env.phone('客人', { census: true, nick: '客人蜂' });
  await sleep(2000);
  const a0 = await census(A), b0 = await census(B);
  await toLobby(A);
  const R = await openRoom(env.emu, A, 'B');
  await joinRoomUI(B, R._id);
  await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: 40000 });
  const words = await H.wordsOfRoom(A, R);
  const run = await H.playMatch({ host: A, guest: B }, words, (i) => ({ first: i % 2 ? 'guest' : 'host', second: i % 2 ? 'host' : 'guest', delayMs: 300 }), { timeout: 240000 });
  const rA = await H.waitResult(A, 60000), rB = await H.waitResult(B, 60000);
  rep.log(`result: A ${rA && rA.mine}:${rA && rA.theirs}, B ${rB && rB.mine}:${rB && rB.theirs}; maxGap ${run.maxGap}`);
  await sleep(1500);
  const a1 = await census(A);
  rep.log('A on the result screen, extra intervals:', a1.iv.filter((x) => !a0.iv.includes(x)));
  // A: 再来一局 -> lobby -> open a new room -> close it -> back home
  await A.tap('#prAgain'); await A.waitScreen(/开一间/, { timeout: 8000 });
  await openRoom(env.emu, A, 'C');
  await sleep(2500);
  await A.tap('#prBack'); await sleep(600);
  await B.tap('#prBack2'); await B.waitScreen(/开一间/, { timeout: 8000 }); await B.tap('#prBack'); await sleep(600);
  await sleep(1500);
  const a2 = await census(A), b2 = await census(B);
  rep.log('A back home, extra intervals vs before the game:', a2.iv.filter((x) => !a0.iv.includes(x)), 'count', a0.intervals, '->', a2.intervals);
  rep.log('B back home, extra intervals vs before the game:', b2.iv.filter((x) => !b0.iv.includes(x)), 'count', b0.intervals, '->', b2.intervals);
  const t = Date.now();
  await sleep(15000);
  const ra = reqs(A.cloudUid, t), rb = reqs(B.cloudUid, t);
  rep.log(`DB requests in the next 15 s while both sit on the PK home: A ${ra.length} [${ra.join(' ')}], B ${rb.length} [${rb.join(' ')}]`);
  rep.expect(a2.intervals <= a0.intervals && b2.intervals <= b0.intervals, 'no intervals left behind by the game');
  rep.expect(ra.filter((x) => !/updateDocument|queryDocument:.{0,6}$/.test(x) || /queryDocument/.test(x)).length <= 1 && rb.filter((x) => /queryDocument/.test(x)).length <= 1, 'no room polling after the game (only the 20 s friends presence beat)');
  rep.log('errors', A.errors, B.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
