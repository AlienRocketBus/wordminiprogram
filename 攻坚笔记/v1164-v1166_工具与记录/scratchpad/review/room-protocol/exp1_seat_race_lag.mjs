// EXP1: 3 guests race for one seat. Product timings (no _setTimingForTest).
// Under read lag >= ~3 s the losers' claim() read-back gives up and re-throws the duplicate-_id error,
// which kindOf() classifies as 'config' ("云端设置还差一步") — or 'network' for the http500 shape.
// usage: node exp1_seat_race_lag.mjs <lagMs> <duplicateStyle>
import { setup, call, startWait, waitEv, launch, result, docs, sleep, makeReport } from './lib.mjs';
const LAG = Number(process.argv[2] || 3500);
const STYLE = process.argv[3] || 'request_failed';
const rep = makeReport(`EXP1 seat race · lag=${LAG}ms · duplicateStyle=${STYLE}`);
const env = await setup({ permissionMode: 'rules', latencyMs: 60, jitterMs: 40, consistencyLagMs: LAG, duplicateStyle: STYLE });
try {
  const A = await env.phone('host');
  const G = [await env.phone('g1'), await env.phone('g2'), await env.phone('g3')];
  const made = await call(A, 'createRoom', { mode: 'C' });
  rep.log('createRoom', made.ok, made.roomId || made.reason);
  await sleep(LAG + 600);
  await startWait(A, made.roomId);
  /* guests find the room in the list first (as the UI does) */
  for (const g of G) {
    for (let i = 0; i < 20; i++) { const lr = await call(g, 'listRooms'); if (lr.ok && lr.rooms.some((x) => x._id === made.roomId)) break; await sleep(400); }
  }
  const t0 = Date.now();
  await Promise.all(G.map((g, i) => launch(g, 'j', 'joinRoom', made.roomId, {})));
  const rs = [];
  for (const g of G) rs.push(await result(g, 'j', 40000));
  rs.forEach((r, i) => rep.log(`g${i + 1}:`, r.r ? { ok: r.r.ok, kind: r.r.kind, reason: (r.r.reason || '').slice(0, 170) } : r, `after ${r.at ? r.at - t0 : '?'}ms`));
  const oks = rs.filter((r) => r.r && r.r.ok).length;
  const kinds = rs.filter((r) => r.r && !r.r.ok).map((r) => r.r.kind);
  rep.expect(oks === 1, `exactly one guest got the seat (got ${oks})`);
  rep.expect(kinds.every((k) => k === 'taken'), `losers are told kind=taken (got ${kinds.join(',')})`);
  const ev = await waitEv(A, 20000);
  rep.log('host event:', ev && Object.keys(ev).join(','), ev && ev.room && ev.room.guestName);
  rep.log('seats:', docs(env.emu).filter((d) => d.kind === 'seat').map((d) => d._id + ' by ' + d.guestName));
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT lag=${LAG} style=${STYLE}: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
