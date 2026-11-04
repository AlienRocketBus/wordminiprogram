// F8: room freshness compares another phone's heartbeatAt with the local clock.
import { env, call, bg, bgResult, wait, ev, doc, docs, sleep, out } from './slib.mjs';
const E = await env({ latencyMs: 40, jitterMs: 20, consistencyLagMs: 0, permissionMode: 'rules' });
try {
  const Slow = await E.phone('慢钟房主', { skewMs: -60000 }), Fast = await E.phone('快钟房主', { skewMs: 600000 });
  const G = await E.phone('准钟客人'), H2 = await E.phone('准钟房主');
  // (a) slow-clock host: public room + private room
  const pub = await call(Slow, 'createRoom', { mode: 'C' });
  const lr = await call(G, 'listRooms');
  out('(a) accurate phone lists slow-clock host public room?', (lr.rooms || []).some((r) => r._id === pub.roomId));
  const j = await call(G, 'joinRoom', pub.roomId, {});
  out('    joinRoom ->', { ok: j.ok, kind: j.kind, reason: String(j.reason || '').slice(0, 40) });
  await call(Slow, 'leaveRoom', pub.roomId);
  const prv = await call(Slow, 'createRoom', { mode: 'C', private: true });
  const code = prv.room && prv.room.code;
  const f = await call(G, 'findByCode', code);
  out('    friend types the private code', code, '->', { ok: f.ok, reason: String(f.reason || '').slice(0, 40) });
  await call(Slow, 'leaveRoom', prv.roomId);
  // (b) ladder: slow-clock host self-hosts first, accurate host second
  const s1 = await call(Slow, 'createRoom', { mode: 'A', hostRating: 1000 });
  await sleep(2000);
  const a1 = await call(H2, 'createRoom', { mode: 'A', hostRating: 1000 });
  await wait(Slow, s1.roomId, 120000, { rating: 1000, band: 400 });
  await wait(H2, a1.roomId, 120000, { rating: 1000, band: 400 });
  const eS = await ev(Slow, 40000), eA = await ev(H2, 1000);
  out('(b) 40 s of ladder waiting: slow host event', eS && Object.keys(eS).join(','), '| accurate host event', eA && Object.keys(eA).join(','));
  for (const p of [Slow, H2]) await p.eval(() => { try { window.__cancel && window.__cancel(); } catch (e) {} return 1; });
  await call(Slow, 'leaveRoom', s1.roomId); await call(H2, 'leaveRoom', a1.roomId);
  // control: both accurate
  const c1 = await call(H2, 'createRoom', { mode: 'A', hostRating: 1000 });
  await sleep(2000);
  const c2 = await call(G, 'createRoom', { mode: 'A', hostRating: 1000 });
  await wait(H2, c1.roomId, 120000, { rating: 1000, band: 400 });
  await wait(G, c2.roomId, 120000, { rating: 1000, band: 400 });
  const t0 = Date.now(); const eG = await ev(G, 40000);
  out('    control (both clocks right): later host event', eG && Object.keys(eG).join(','), 'after', Math.round((Date.now() - t0) / 1000), 's');
  for (const p of [H2, G]) await p.eval(() => { try { window.__cancel && window.__cancel(); } catch (e) {} return 1; });
  await call(H2, 'leaveRoom', c1.roomId); await call(G, 'leaveRoom', c2.roomId);
  // (c) fast-clock host's phone dies
  const fr = await call(Fast, 'createRoom', { mode: 'C' });
  await call(Fast, 'stopHeartbeat'); await Fast.ctx.close();
  await sleep(45000);
  const lr2 = await call(G, 'listRooms');
  out('(c) 45 s after the fast-clock host phone died, still listed?', (lr2.rooms || []).some((r) => r._id === fr.roomId));
  const t1 = Date.now(); const j2 = await call(G, 'joinRoom', fr.roomId, {});
  out('    joinRoom ->', { ok: j2.ok, reason: String(j2.reason || '').slice(0, 30) }, 'after', Math.round((Date.now() - t1) / 1000), 's');
} catch (e) { out('THREW', String(e && e.stack || e).slice(0, 500)); }
await E.done(); process.exit(0);
