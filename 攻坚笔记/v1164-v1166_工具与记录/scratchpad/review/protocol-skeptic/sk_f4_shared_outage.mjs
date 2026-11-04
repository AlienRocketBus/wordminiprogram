// F4: shared Wi-Fi outage of OUT seconds mid-match. Each page runs the UI's checkOpponentAlive cadence
// (opponentGone every 4 s; on gone -> claimAbandonWin), heartbeats keep running as in the real battle screen.
import { env, call, wait, ev, doc, sleep, out } from './slib.mjs';
const OUT = Number(process.argv[2] || 70), RUNS = Number(process.argv[3] || 1);
const E = await env({ latencyMs: 60, jitterMs: 40, consistencyLagMs: 0, permissionMode: 'rules' });
const emu = E.emu;
function loop(p, rid) {
  return p.eval((rid) => {
    window.__verdict = null; window.__gtrace = [];
    window.__gl = setInterval(() => {
      window.HansenPkRoom.opponentGone(rid).then((g) => {
        window.__gtrace.push((g.ok ? (g.gone ? 'G' + g.idleSecs : '.') : 'x'));
        if (g && g.ok && g.gone && !window.__verdict) {
          clearInterval(window.__gl);
          window.__verdict = 'claiming';
          window.HansenPkRoom.claimAbandonWin(rid).then((r) => { window.__verdict = '🏆 对手已离场，本局你胜 (claim ok=' + r.ok + ')'; });
        }
      });
    }, 4000);
    return 1;
  }, rid);
}
const A = await E.phone('房主'), B = await E.phone('客人');
let both = 0;
for (let run = 0; run < RUNS; run++) {
  const m = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await wait(A, m.roomId);
  await call(B, 'joinRoom', m.roomId, {}); await ev(A, 15000);
  await Promise.all([call(A, 'markReady', m.roomId), call(B, 'markReady', m.roomId)]);
  await Promise.all([loop(A, m.roomId), loop(B, m.roomId)]);
  await sleep(5000 + Math.random() * 8000);       // random phase relative to heartbeats
  emu.setOffline(true); const t0 = Date.now();
  await sleep(OUT * 1000);
  emu.setOffline(false);
  await sleep(20000);
  const va = await A.eval(() => [window.__verdict, window.__gtrace.join('')]), vb = await B.eval(() => [window.__verdict, window.__gtrace.join('')]);
  await A.eval(() => clearInterval(window.__gl)); await B.eval(() => clearInterval(window.__gl));
  const R = doc(emu, m.roomId), S = doc(emu, m.roomId + '_s0');
  out(`run ${run} outage ${OUT}s  host:`, va[0], va[1], ' | guest:', vb[0], vb[1]);
  out('   server: room abandonWin=', R && R.abandonWin, ' seat abandonWin=', S && S.abandonWin);
  if (va[0] && vb[0]) both++;
  await call(A, 'leaveRoom', m.roomId); await call(B, 'leaveRoom', m.roomId);
}
out(`BOTH-WIN runs: ${both}/${RUNS}`);
await E.done(); process.exit(0);
