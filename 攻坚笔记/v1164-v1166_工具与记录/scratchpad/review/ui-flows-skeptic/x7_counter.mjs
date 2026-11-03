// UI-7 skeptic: sample the 「已等 N 秒」 text every 100 ms from 开始排位 through the switch to self-hosting (default 20 s).
import { env, sleep, H, report, flat } from './sk.mjs';
const LAT = Number(process.argv[2] || 60);
const rep = report(`UI-7 skeptic · latency ${LAT} ms`);
const E = await env({ latencyMs: LAT, jitterMs: 20 });
try {
  const P = await E.phone('孩子', { nick: '计时蜂' });
  await P.tap('#pkLadder'); await P.waitScreen(/开始排位/, { timeout: 8000 });
  await P.tap('#ldGo');
  const t0 = Date.now(), seq = [];
  let prev = '';
  while (Date.now() - t0 < 26000) {
    const r = await P.eval(() => {
      const ids = ['ldWaited', 'prWaited', 'prJoinWait'];
      for (const id of ids) { const e = document.getElementById(id); if (e && e.offsetParent) { const m = /已等\s*(?:(\d+)\s*分\s*)?(\d+)\s*秒/.exec(e.textContent || ''); return id + ':' + (m ? (Number(m[1] || 0) * 60 + Number(m[2])) : '?'); } }
      const scr = document.getElementById('hsn_pkroom_screen');
      return 'none:' + ((scr && scr.classList.contains('on')) ? (scr.innerText || '').replace(/\s+/g, ' ').slice(0, 30) : '');
    });
    if (r !== prev) { seq.push(`${Date.now() - t0}ms ${r}`); prev = r; }
    await sleep(100);
  }
  rep.log('value changes:', '\n    ' + seq.filter((s, i) => i < 3 || /prWaited|none/.test(s) || /ldWaited:(1[7-9]|2\d)/.test(s)).join('\n    '));
  rep.log('errors', P.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 600)); }
await E.done();
process.exit(0);
