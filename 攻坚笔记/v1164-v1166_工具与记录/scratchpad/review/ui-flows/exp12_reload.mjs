// EXP12: reload mid-flow (spelling_pk.html).
//   a) ranked host on 「等对手进来」 reloads -> its room must disappear
//   b) guest on 「正在进房，等房主确认…」 reloads (host's confirm is slow) -> seat gone, host keeps waiting cleanly
import { setup, docs, sleep, report, H, toLobby, openRoom, joinRoomUI } from './lib.mjs';
const rep = report('EXP12 reload mid-flow');
const env = await setup({ permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 });
async function reload(p) {
  await p.page.reload({ waitUntil: 'domcontentloaded' });
  await p.page.waitForFunction(() => !!(window.HansenPkRoomUI && window.HANSEN_VOCAB_ALL), null, { timeout: 30000 });
  await sleep(800);
}
try {
  const P = await env.phone('甲', { nick: '刷新蜂' });
  await P.tap('#pkLadder'); await P.waitScreen(/开始排位/, { timeout: 8000 });
  await P.tap('#ldGo');
  await P.waitScreen(/等对手进来/, { timeout: 40000 });
  const R = docs(env.emu).find((d) => d.kind === 'room' && d._openid === P.cloudUid && d.status === 'open');
  await reload(P);
  await sleep(1500);
  const R1 = docs(env.emu).find((d) => d._id === R._id);
  rep.log(`a) reload on 等对手进来: room after reload: ${R1 ? R1.status : 'removed'}; screen: ${(await P.screen()).replace(/\s+/g, ' ').slice(0, 50)}`);
  rep.expect(!R1, 'a) the ranked room is gone after the reload');

  const Hh = await env.phone('房主', { nick: '房主蜂' });
  const G = await env.phone('客人', { nick: '客人蜂' });
  await toLobby(Hh);
  const R2 = await openRoom(env.emu, Hh, 'C');
  const slow = env.emu.fault({ uid: Hh.cloudUid, db: true, do: 'delay', ms: 2500 });   // host's confirm is slow
  await joinRoomUI(G, R2._id);
  await G.waitScreen(/正在进房/, { timeout: 5000 });
  await sleep(1800);
  const seatBefore = docs(env.emu).find((d) => d.kind === 'seat' && d.roomId === R2._id);
  await reload(G);
  slow.remove();
  await sleep(1500);
  const seatAfter = docs(env.emu).find((d) => d.kind === 'seat' && d.roomId === R2._id);
  rep.log(`b) guest reload on 正在进房: seat before ${seatBefore ? seatBefore._id : '-'}, after ${seatAfter ? seatAfter._id + (seatAfter.left ? ' left' : '') : 'removed'}`);
  await sleep(25000);
  const R3 = docs(env.emu).find((d) => d._id === R2._id);
  const hs = (await Hh.screen()).replace(/\s+/g, ' ').slice(0, 90);
  rep.log(`b) host 25 s later: room status=${R3 && R3.status} seat#=${R3 && R3.seat} guest=${R3 && R3.guestName || '-'}; host screen: ${hs}`);
  rep.expect(R3 && R3.status === 'open' && !R3.guestId && /等对手进来/.test(hs), 'b) the host is back to a clean open room');
  rep.log('errors', P.errors, Hh.errors, G.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
