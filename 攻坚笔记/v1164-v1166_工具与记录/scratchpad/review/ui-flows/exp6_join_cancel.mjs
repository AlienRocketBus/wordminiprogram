// EXP6: guest taps 「取消」 on 「正在进房，等房主确认…」 while the seat claim is still on the wire
//       (slow phone network: every request ~500 ms). How long until the screen reacts, and what does
//       the host see?
import { setup, docs, sleep, report, H, toLobby, openRoom, joinRoomUI } from './lib.mjs';
const LAT = Number(process.argv[2] || 500), AT = Number(process.argv[3] || 700);
const rep = report(`EXP6 join-cancel during the seat claim (latency ${LAT} ms, tap 取消 ${AT} ms after 进去打)`);
const env = await setup({ permissionMode: 'legacy', latencyMs: LAT, jitterMs: 50, consistencyLagMs: 300 });
try {
  const A = await env.phone('房主', { nick: '房主蜂' });
  const B = await env.phone('客人', { nick: '客人蜂' });
  await toLobby(A);
  const R = await openRoom(env.emu, A, 'C');
  rep.log('room', R && R._id);
  await joinRoomUI(B, R._id);            // taps 进去打
  const tTap = Date.now();
  await B.waitScreen(/正在进房/, { timeout: 5000 });
  await sleep(Math.max(0, AT - (Date.now() - tTap)));
  const seatThen = docs(env.emu).find((d) => d.kind === 'seat' && d.roomId === R._id);
  await B.tap('#prJoinCancel');
  const tCancel = Date.now();
  rep.log(`取消 tapped ${tCancel - tTap} ms after 进去打; seat on server at that moment: ${seatThen ? 'yes' : 'no (claim still in flight)'}`);
  let left = null; const samples = [];
  while (Date.now() - tCancel < 25000) {
    const s = (await B.screen()).replace(/\s+/g, ' ');
    const m = /已等\s*(\d+)\s*秒/.exec(s);
    if (!samples.length || samples[samples.length - 1] !== (m ? m[1] : s.slice(0, 12))) samples.push(m ? m[1] : s.slice(0, 12));
    if (!/正在进房/.test(s)) { left = Date.now() - tCancel; break; }
    await sleep(150);
  }
  rep.log(`guest screen after 取消: stayed on 「正在进房，等房主确认…」 for ${left} ms (counter kept running: ${samples.join(',')}); then shows: ${(await B.screen()).replace(/\s+/g, ' ').slice(0, 90)}`);
  rep.expect(left != null && left < 1500, '取消 reacts within ~1 s');
  await sleep(4000);
  const hs = (await A.screen()).replace(/\s+/g, ' ').slice(0, 120);
  const hb = await H.battleView(A);
  rep.log(`host screen 4 s later: ${hs} (battle screen: ${!!hb})`);
  await sleep(14000);
  rep.log(`host screen 18 s later: ${(await A.screen()).replace(/\s+/g, ' ').slice(0, 120)}`);
  rep.log('room docs:', H.describeRooms(env.emu));
  rep.log('errors', A.errors, B.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
