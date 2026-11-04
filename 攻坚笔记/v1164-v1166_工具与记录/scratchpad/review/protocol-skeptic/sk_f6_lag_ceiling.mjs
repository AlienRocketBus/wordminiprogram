// F6: (1) UI order: createRoom then waitForOpponent immediately, under read lag LAG -> does the host get {gone}?
//     (2) ACK budget: host already waited > 40 s (5-s polls); a guest joins under lag LAG.
import { env, call, bg, bgResult, wait, ev, doc, sleep, out } from './slib.mjs';
const LAG = Number(process.argv[2] || 5000), PART = process.argv[3] || '1', N = Number(process.argv[4] || 2);
const E = await env({ latencyMs: 50, jitterMs: 30, consistencyLagMs: LAG, permissionMode: 'rules' });
try {
  const A = await E.phone('房主'), B = await E.phone('客人');
  for (let k = 0; k < N; k++) {
    const m = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
    const t0 = Date.now();
    await wait(A, m.roomId);
    if (PART === '1') {
      const e = await ev(A, 15000);
      out(`lag ${LAG} run ${k}: host event`, e ? Object.keys(e).filter((x) => e[x] === true).join(',') + ' after ' + ((e.at - t0) / 1000).toFixed(1) + 's' : 'none in 15 s',
          ' | server room status', (doc(E.emu, m.roomId) || {}).status);
    } else {
      await sleep(42000 + k * 1300);   // host is now on 5-s polls
      const tj = Date.now(); const j = await call(B, 'joinRoom', m.roomId, {});
      const R = doc(E.emu, m.roomId);
      out(`lag ${LAG} run ${k}: guest join ->`, { ok: j.ok, reason: String(j.reason || '').slice(0, 14) }, 'after', ((Date.now() - tj) / 1000).toFixed(1), 's;',
          ' room now', R && R.status, 'guest', R && R.guestName ? R.guestName : '-', '; seat doc', doc(E.emu, m.roomId + '_s0') ? 'exists' : 'removed');
    }
    await A.eval(() => { try { window.__cancel && window.__cancel(); } catch (e) {} return 1; });
    await call(A, 'leaveRoom', m.roomId); await call(B, 'leaveRoom', m.roomId);
    await sleep(LAG + 500);
  }
} catch (e) { out('THREW', String(e && e.stack || e).slice(0, 500)); }
await E.done(); process.exit(0);
