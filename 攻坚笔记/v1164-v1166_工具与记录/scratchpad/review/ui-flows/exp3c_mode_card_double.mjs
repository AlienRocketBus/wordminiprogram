// EXP3c: a double tap on a choose-mode card (开一间 -> 选个玩法) vs a single tap.
//   Counts: rooms created, 「已等 N 秒」 intervals, DB reads of the room doc + seat doc per 10 s while waiting,
//   and requests that keep coming after 「关掉房间」.
import { setup, docs, sleep, report, H, census } from './lib.mjs';
const rep = report('EXP3c double tap on a mode card');
const env = await setup({ permissionMode: 'legacy', latencyMs: 120, jitterMs: 60, consistencyLagMs: 300 });
async function run(P, double) {
  const c0 = await census(P);
  await P.tap('#pkRooms'); await P.waitScreen(/开一间/, { timeout: 8000 });
  await P.tap('#prNew');
  const h = await P.hitTest('.pr_mode[data-mode="C"]', { timeout: 6000 });
  await P.page.touchscreen.tap(h.x, h.y);
  if (double) { await sleep(90); await P.page.touchscreen.tap(h.x, h.y); }
  await P.waitScreen(/等对手进来/, { timeout: 15000 });
  await sleep(1500);
  const R = docs(env.emu).filter((d) => d.kind === 'room' && d._openid === P.cloudUid && d.status === 'open');
  const rid = R[0] && R[0]._id;
  const t0 = Date.now();
  await sleep(10000);
  const reads = env.emu.log.filter((e) => e.uid === P.cloudUid && e.t >= t0 && e.action === 'database.queryDocument' && String(e.docId || '').startsWith(rid)).length;
  const c1 = await census(P);
  const waitIv = c1.iv.filter((x) => /waiting \(hansen_pk_room_ui/.test(x)).length;
  await P.tap('#prBack');
  const t1 = Date.now();
  await sleep(9000);
  const after = env.emu.log.filter((e) => e.uid === P.cloudUid && e.t >= t1 && String(e.docId || '').startsWith(rid)).map((e) => e.action.replace('database.', ''));
  rep.log(`${double ? 'DOUBLE' : 'single'} tap: open rooms ${R.length}; waiting-screen 1 s timers ${waitIv}; reads of room+seat docs in 10 s: ${reads}; requests on them in the 9 s after 关掉房间: ${after.length} [${after.join(',')}]`);
  await P.tap('#prBack').catch(() => {});
  await sleep(800);
  return { reads, waitIv, after: after.length };
}
try {
  const P = await env.phone('甲', { census: true, nick: '双击蜂' });
  await sleep(2000);
  const s = await run(P, false);
  const d = await run(P, true);
  rep.expect(d.waitIv <= s.waitIv, `double tap does not start a second 「已等 N 秒」 timer (${d.waitIv} vs ${s.waitIv})`);
  rep.expect(d.reads <= s.reads + 2, `double tap does not start a second waitForOpponent poll loop (reads ${d.reads} vs ${s.reads})`);
  rep.expect(d.after <= s.after, `closing the room stops all polling (after-close requests ${d.after} vs ${s.after})`);
  rep.log('page errors:', P.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
