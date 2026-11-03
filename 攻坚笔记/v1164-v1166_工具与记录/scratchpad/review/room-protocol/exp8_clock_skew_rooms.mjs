// EXP8: what is still clock-dependent in the room protocol.
//  (a) a host whose phone clock is 60 s SLOW: its heartbeatAt looks 60 s old to everyone else ->
//      hidden from listRooms, private code not found, joinRoom refuses 「房主已经离开了」.
//  (b) ladder: slow-clock host opened first (older createdAt), accurate host opens later. The accurate host's
//      rescan can't see the slow room (stale); the slow host sees the accurate room but it is NEWER -> no switchTo.
//      Both wait the full 2 minutes (control with both clocks right: switchTo within one rescan).
//  (c) a host whose clock is 10 min FAST dies: its room keeps looking fresh to everyone for ~10 min.
import { setup, call, startWait, waitEv, launch, result, docs, sleep, makeReport } from './lib.mjs';
const rep = makeReport('EXP8 clock skew vs room freshness / ladder convergence');
const env = await setup({ permissionMode: 'legacy', latencyMs: 50, jitterMs: 30, consistencyLagMs: 300 });
try {
  const SLOW = await env.phone('slow', { skewMs: -60000 });
  const OK1 = await env.phone('accurate');
  const OK2 = await env.phone('accurate2');
  rep.log('clock check (ms vs real):', await SLOW.eval(() => Date.now() - performance.timeOrigin - performance.now()));
  /* (a) */
  const pub = await call(SLOW, 'createRoom', { mode: 'C' });
  const priv = await call(SLOW, 'createRoom', { mode: 'C', private: true });
  rep.log('slow host created public', pub.ok, 'and private', priv.ok, 'code', priv.room && priv.room.code);
  await sleep(1500);
  const lr = await call(OK1, 'listRooms');
  const fc = await call(OK1, 'findByCode', priv.room.code);
  const jr = await call(OK1, 'joinRoom', priv.roomId, {});
  rep.log('(a) accurate phone: list shows slow room?', lr.rooms.some((x) => x._id === priv.roomId || x._id === pub.roomId), ' findByCode ->', fc.ok ? 'ok' : fc.reason, ' joinRoom ->', jr.ok ? 'ok' : jr.reason);
  rep.expect(fc.ok && jr.ok, '(a) a friend can join a room whose host clock is 60 s slow');
  await call(SLOW, 'leaveRoom', '');
  await sleep(800);

  /* (b) ladder: slow opens first, accurate opens 3 s later; both wait with ladder rescans */
  for (const ctl of [false, true]) {
    const first = ctl ? OK2 : SLOW, second = OK1;
    const r1 = await call(first, 'createRoom', { mode: 'A', hostRating: 1000 });
    await sleep(3000);
    const r2 = await call(second, 'createRoom', { mode: 'A', hostRating: 1000 });
    await sleep(500);
    await startWait(first, r1.roomId, { ms: 60000, ladder: { rating: 1000, band: 400 } });
    await startWait(second, r2.roomId, { ms: 60000, ladder: { rating: 1000, band: 400 } });
    const t0 = Date.now();
    let e1 = null, e2 = null;
    while (Date.now() - t0 < 40000 && !e1 && !e2) {
      e1 = await first.eval(() => (window.__ev || [])[0] || null);
      e2 = await second.eval(() => (window.__ev || [])[0] || null);
      await sleep(500);
    }
    const tag = ctl ? 'control (both clocks right)' : 'slow-clock host first';
    rep.log(`(b) ${tag}: after ${Math.round((Date.now() - t0) / 1000)}s first-host event=${e1 ? Object.keys(e1).filter((k) => k !== 'at' && k !== 'room').join('+') : 'none'}, second-host event=${e2 ? Object.keys(e2).filter((k) => k !== 'at' && k !== 'room').join('+') + (e2.switchTo === r1.roomId ? '(to the older room)' : '') : 'none'}`);
    if (!ctl) rep.expect(!!(e1 || e2), '(b) two ladder hosts converge (one is told switchTo) even if one clock is 60 s slow');
    for (const p of [first, second]) { await p.eval(() => { try { window.__cancel && window.__cancel(); } catch (e) {} return true; }); await call(p, 'leaveRoom', ''); }
    await sleep(1000);
  }

  /* (c) fast-clock host dies -> ghost room */
  const FAST = await env.phone('fast', { skewMs: 600000 });
  const g = await call(FAST, 'createRoom', { mode: 'C' });
  await sleep(1000);
  await FAST.kill();
  rep.log('(c) fast-clock host created', g.roomId, 'then its phone died (no goodbye)');
  await sleep(45000);
  const lr2 = await call(OK1, 'listRooms');
  rep.log('    45 s later the room is still listed as fresh to others?', lr2.rooms.some((x) => x._id === g.roomId));
  const t1 = Date.now();
  const jg = await call(OK1, 'joinRoom', g.roomId, {});
  rep.log('    joining it ->', jg.ok ? 'ok' : jg.reason, `after ${Math.round((Date.now() - t1) / 1000)}s`);
  rep.expect(!lr2.rooms.some((x) => x._id === g.roomId), '(c) a dead host\'s room disappears from the list within ~30 s');
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
