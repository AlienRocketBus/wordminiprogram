// EXP18 (incidental, outside the room-protocol lens): a kid opens the ladder home and just looks at it for 40 s.
import { setup, sleep, makeReport, H } from './lib.mjs';
const rep = makeReport('EXP18 ladder home left open 40 s');
const env = await setup({ permissionMode: 'legacy', latencyMs: 40, consistencyLagMs: 300 });
try {
  const P = await env.phone('k1');
  await P.tap('#pkLadder'); await H.answerNameIfAsked(P, 'k1'); await P.waitScreen(/开始排位/, { timeout: 8000 });
  const ld = await P.eval(() => { const w = document.querySelector('.ld_wrap'); return w ? w.innerText.replace(/\s+/g, ' ').slice(0, 300) : '(no .ld_wrap)'; });
  rep.log('ladder home text:', ld);
  rep.log('matches watchdog "frozen battle" regex /⏱|第 \\d+ \\//:', /⏱|第 \d+ \//.test(ld));
  await sleep(40000);
  const resc = await P.eval(() => { const d = document.getElementById('pkRescue'); return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 160) : null; });
  rep.log('after 40 s, rescue overlay:', resc);
  rep.expect(!resc, 'no 「卡住了」 rescue overlay over an idle ladder home');
  const st = await P.eval(() => window.HansenPkWatchdog._stateForTest());
  rep.log('watchdog state:', st);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
