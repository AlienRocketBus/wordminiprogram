// UI-10 skeptic b: hidden on the matching screen, nobody joins. Does the 30 s background clean-up ever close the room?
import { env, sleep, H, report, flat, setHidden, roomDocs, myOpenRoom } from './sk.mjs';
const rep = report('UI-10 skeptic b · hidden on matching screen, nobody joins');
const E = await env({ latencyMs: 60, jitterMs: 30 });
try {
  const P = await E.phone('切走的孩子', { nick: '切走蜂' });
  await P.tap('#pkLadder'); await P.waitScreen(/开始排位/, { timeout: 8000 });
  await P.tap('#ldGo'); await P.waitScreen(/正在找对手/, { timeout: 4000 });
  await sleep(1000);
  await setHidden(P.page, true);
  const tHide = Date.now();
  const room = await H.until(async () => myOpenRoom(E.emu, P.cloudUid) || null, { timeout: 40000, interval: 300 });
  rep.log(`${Math.round((Date.now() - tHide) / 1000)} s after hiding: ranked room ${room && room._id} open`);
  for (const at of [35, 50, 62]) {
    while (Date.now() - tHide < at * 1000) await sleep(300);
    const R = roomDocs(E.emu).find((d) => d._id === room._id);
    rep.log(`${at} s after hiding: room ${R ? R.status + ', heartbeat ' + (Date.now() - R.heartbeatAt) + ' ms old' : 'removed'}; listed to others: ${R && R.status === 'open' && Date.now() - R.heartbeatAt < 30000}`);
  }
  await setHidden(P.page, false); await sleep(600);
  rep.log('comes back to:', flat(await P.screen(), 100));
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 500)); }
await E.done(); process.exit(0);
