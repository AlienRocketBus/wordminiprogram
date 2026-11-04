// EXP15: a FREE room in mode A (抢答赛 card says 「⭐ 计天梯」) is ranked by HansenPkRecord (mode === 'A').
//        Does the guest's ELO use the host's real rating?
import { setup, docs, sleep, report, H, toLobby, openRoom, joinRoomUI } from './lib.mjs';
const rep = report('EXP15 free mode-A room: ELO uses the real opponent rating?');
const env = await setup({ permissionMode: 'legacy', latencyMs: 30, jitterMs: 20, consistencyLagMs: 200 });
try {
  const A = await env.phone('房主', { nick: '高手蜂' });
  const B = await env.phone('客人', { nick: '新手蜂' });
  await A.eval(() => { localStorage.setItem('hansen_pk_record_v1', JSON.stringify({ rating: 1400, peakRating: 1400, placementGames: 5, wins: 5, losses: 0, history: [] })); return true; });
  await B.eval(() => { localStorage.setItem('hansen_pk_record_v1', JSON.stringify({ rating: 1000, peakRating: 1000, placementGames: 5, wins: 2, losses: 3, history: [] })); return true; });
  const a0 = await H.ladderRecord(A), b0 = await H.ladderRecord(B);
  await toLobby(A);
  const R = await openRoom(env.emu, A, 'A');
  rep.log(`free A room hostRating on the server: ${R && R.hostRating}`);
  await joinRoomUI(B, R._id);
  await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: 40000 });
  const words = await H.wordsOfRoom(A, R);
  await H.playMatch({ host: A, guest: B }, words, () => ({ first: 'guest' }), { timeout: 200000 });
  const rA = await H.waitResult(A, 60000), rB = await H.waitResult(B, 60000);
  const a1 = await H.ladderRecord(A), b1 = await H.ladderRecord(B);
  const eB = await B.eval(([my, g]) => ({ real: HansenSbLadder.nextRating({ myRating: my, oppRating: 1400, won: true, games: g }).rating, as1000: HansenSbLadder.nextRating({ myRating: my, oppRating: 1000, won: true, games: g }).rating }), [b0.rating, (b0.placementGames || 0) + 1]);
  const eA = await A.eval(([my, g]) => ({ real: HansenSbLadder.nextRating({ myRating: my, oppRating: 1000, won: false, games: g }).rating }), [a0.rating, (a0.placementGames || 0) + 1]);
  rep.log(`result: host ${rA && rA.text.split('\n')[0]} ${a0.rating}->${a1.rating} (expected vs real 1000: ${eA.real}); guest ${rB && rB.text.split('\n')[0]} ${b0.rating}->${b1.rating} (expected vs real 1400: ${eB.real}; vs a made-up 1000: ${eB.as1000})`);
  rep.expect(b1.rating === eB.real, 'guest ELO uses the host\'s real rating 1400');
  rep.expect(a1.rating === eA.real, 'host ELO uses the guest\'s real rating 1000');
  rep.log('errors', A.errors, B.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
