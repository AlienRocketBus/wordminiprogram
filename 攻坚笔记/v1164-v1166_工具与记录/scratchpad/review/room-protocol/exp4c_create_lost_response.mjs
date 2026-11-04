// EXP4c: same flaky-network pattern on createRoom(): the room add commits, the reply is lost, the retry hits the
// duplicate _id, and the 3 read-backs fail -> createRoom reports 'config' while the room exists and is listed.
import { setup, call, launch, result, docs, sleep, makeReport } from './lib.mjs';
const rep = makeReport('EXP4c createRoom: lost reply + failed read-backs');
const env = await setup({ permissionMode: 'rules', latencyMs: 60, jitterMs: 30, consistencyLagMs: 0 });
const E = env.emu;
try {
  const A = await env.phone('host'), B = await env.phone('other');
  const h = E.hold({ uid: A.cloudUid, action: 'database.addDocument', collection: 'hansen_pk_rooms' });
  await launch(A, 'x', 'createRoom', { mode: 'A', hostRating: 1000 });
  for (let i = 0; i < 100 && !h.pending; i++) await sleep(50);
  E.fault({ uid: A.cloudUid, action: 'database.addDocument', collection: 'hansen_pk_rooms', do: 'commitThenAbort', times: 1 });
  E.fault({ uid: A.cloudUid, action: 'database.queryDocument', collection: 'hansen_pk_rooms', do: 'abort', times: 3 });
  h.release();
  const r = await result(A, 'x', 60000);
  rep.log('host createRoom ->', r.r && { ok: r.r.ok, kind: r.r.kind, reason: (r.r.reason || '').slice(0, 90) });
  const rooms = docs(E).filter((d) => d.kind === 'room');
  rep.log('rooms on server:', rooms.map((d) => `${d._id} ${d.status} by host=${d._openid === A.cloudUid}`));
  await sleep(800);
  const lr = await call(B, 'listRooms');
  rep.log('another player sees it in the list:', lr.rooms.map((x) => x._id));
  rep.expect(!(r.r && r.r.kind === 'config'), 'a lost reply on my own add is not 「云端设置还差一步」');
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
