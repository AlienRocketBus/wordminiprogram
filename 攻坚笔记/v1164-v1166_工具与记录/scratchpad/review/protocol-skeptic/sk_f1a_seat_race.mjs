// F1(a): N guests race for one seat with read lag LAG; what are the losers told?
import { env, call, bg, bgResult, wait, ev, docs, sleep, out } from './slib.mjs';
const LAG = Number(process.argv[2] || 3500), STYLE = process.argv[3] || 'request_failed', NG = Number(process.argv[4] || 3);
const E = await env({ latencyMs: 50, jitterMs: 30, consistencyLagMs: LAG, duplicateStyle: STYLE, permissionMode: 'rules' });
try {
  const A = await E.phone('房主');
  const G = []; for (let i = 0; i < NG; i++) G.push(await E.phone('客' + i));
  const m = await call(A, 'createRoom', { mode: 'C' });
  out('create', m.ok, m.roomId);
  await sleep(LAG + 800);
  await wait(A, m.roomId);
  const t0 = Date.now();
  await Promise.all(G.map((g) => bg(g, 'j', 'joinRoom', m.roomId, {})));
  const rs = await Promise.all(G.map((g) => bgResult(g, 'j', 45000)));
  rs.forEach((r, i) => out(`客${i}`, r.r ? { ok: r.r.ok, kind: r.r.kind, reason: String(r.r.reason || '').slice(0, 150) } : r, 'after', r.at ? r.at - (r.at - (Date.now() - t0)) : '?'));
  const e = await ev(A, 25000);
  out('host event', e && Object.keys(e).filter((k) => e[k] === true || k === 'room').join(','), e && e.room && e.room.guestName);
  out('seats', docs(E.emu).filter((d) => d.kind === 'seat').map((d) => `${d._id.slice(-3)} ${d.guestName}`));
} catch (e) { out('THREW', String(e && e.stack || e)); }
await E.done(); process.exit(0);
