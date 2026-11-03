// EXP16: a stranger adds 40 fake "open" rooms with a far-future createdAt/heartbeatAt. listOpen() asks the server
// for status:open, isPrivate:false ORDER BY createdAt DESC LIMIT 40 -> the 40 slots are all fakes, every real room
// is cut off; the fakes also pass the local freshness check (now - future < 30 s) and look joinable.
import { setup, call, docs, sleep, makeReport } from './lib.mjs';
const rep = makeReport('EXP16 lobby flood by one stranger (40 docs)');
const env = await setup({ permissionMode: 'rules', latencyMs: 30, jitterMs: 20, consistencyLagMs: 200 });
try {
  const A = await env.phone('host'), B = await env.phone('guest'), M = await env.phone('stranger');
  const future = Date.now() + 365 * 86400e3;
  const n = await M.eval(async (future) => {
    const app = await window.HansenAuth._app(); const col = app.database().collection('hansen_pk_rooms');
    let ok = 0;
    for (let i = 0; i < 40; i++) {
      const r = await col.add({ _id: 'rzzfake' + i, proto: 2, kind: 'room', status: 'open', isPrivate: false, code: '', mode: 'A', askMode: 'cn', seed: i,
        wordCount: 10, hostId: 'ufake' + i, hostName: '小蜂' + i, hostRating: 1000, hostTier: '', guestId: '', seat: 0, createdAt: future + i, heartbeatAt: future + i, hostBeat: future });
      if (r && !r.code) ok++;
    }
    return ok;
  }, future);
  rep.log('stranger added fake rooms:', n);
  const made = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await sleep(800);
  const lr = await call(B, 'listRooms');
  rep.log('guest listRooms: ' + lr.rooms.length + ' rooms; real room listed?', lr.rooms.some((x) => x._id === made.roomId), ' first few:', lr.rooms.slice(0, 3).map((x) => x.hostName + '/' + x.mode));
  rep.expect(lr.rooms.some((x) => x._id === made.roomId), 'a real open room is still listed when a stranger adds fake rooms');
  const t0 = Date.now();
  const j = await call(B, 'joinRoom', lr.rooms[0]._id, {});
  rep.log('joining a fake ->', j.ok ? 'ok' : j.reason, `after ${Math.round((Date.now() - t0) / 1000)}s`);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
