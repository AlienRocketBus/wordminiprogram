// X1: a new player opens 天梯排位 and just reads it. Does the watchdog cover it with 「这一局卡住了」?
import { env, sleep, out } from './slib.mjs';
const E = await env({ latencyMs: 40, consistencyLagMs: 0 });
try {
  const A = await E.phone('新玩家');
  out('visibility', await A.eval(() => document.visibilityState));
  await A.eval(() => { window.HansenLadderUI.open(); return 1; });
  await sleep(1500);
  const t = await A.eval(() => { const w = document.querySelector('.ld_wrap'); return w ? w.innerText.replace(/\s+/g, ' ') : ''; });
  out('ladder home has ⏱:', /⏱/.test(t), JSON.stringify((t.match(/.{0,6}⏱.{0,14}/) || [''])[0]));
  for (let s = 10; s <= 40; s += 10) {
    await sleep(10000);
    const r = await A.eval(() => { const x = document.getElementById('pkRescue'); return x && x.offsetParent !== null ? x.innerText.replace(/\s+/g, ' ').slice(0, 60) : null; });
    out(`t+${s}s rescue overlay:`, r);
    if (r) break;
  }
} catch (e) { out('THREW', String(e && e.stack || e).slice(0, 400)); }
await E.done(); process.exit(0);
