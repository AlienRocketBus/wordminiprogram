import { env, H, sleep, out } from './slib.mjs';
const VIA = process.argv[2] || 'tap';
const E = await env({ latencyMs: 40, consistencyLagMs: 300 });
try {
  const A = await E.phone('新玩家');
  if (VIA === 'tap') { await A.tap('#pkLadder'); await H.answerNameIfAsked(A, '新玩家'); await A.waitScreen(/开始排位/, { timeout: 8000 }); }
  else { await A.eval(() => { window.HansenLadderUI.open(); return 1; }); await sleep(1500); }
  let prev = '';
  for (let s = 5; s <= 45; s += 5) {
    await sleep(5000);
    const r = await A.eval(() => { const x = document.getElementById('pkRescue'); const w = document.querySelector('.pr_wrap') || document.querySelector('.ld_wrap'); return { resc: x ? x.innerText.replace(/\s+/g, ' ').slice(0, 50) : null, scr: w ? (w.innerText || '').replace(/\s+/g, ' ').trim() : '', st: window.HansenPkWatchdog._stateForTest ? window.HansenPkWatchdog._stateForTest() : null }; });
    out(`t+${s}s changed=${r.scr !== prev} len=${r.scr.length} resc=${r.resc} wd=${JSON.stringify(r.st).slice(0, 160)}`);
    prev = r.scr;
    if (r.resc) break;
  }
} catch (e) { out('THREW', String(e && e.stack || e).slice(0, 400)); }
await E.done(); process.exit(0);
