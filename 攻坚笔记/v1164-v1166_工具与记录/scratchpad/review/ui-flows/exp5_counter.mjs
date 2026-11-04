// EXP5: is the 「已等 N 秒」 counter smooth across matching -> self-hosted waiting room?
//   Samples whatever 「已等 N 秒」 text is on the top layer every 100 ms for ~34 s.
import { setup, sleep, report, H } from './lib.mjs';
const rep = report('EXP5 已等 N 秒 smoothness');
const env = await setup({ permissionMode: 'legacy', latencyMs: 60, jitterMs: 40, consistencyLagMs: 300 });
try {
  const P = await env.phone('甲', { nick: '计时蜂' });
  await P.tap('#pkLadder'); await P.waitScreen(/开始排位/, { timeout: 8000 });
  await P.tap('#ldGo');
  const t0 = Date.now(), seq = [];
  while (Date.now() - t0 < 34000) {
    const s = await P.screen();
    const m = /已等\s*(?:(\d+)\s*分\s*)?(\d+)\s*秒/.exec(s);
    const n = m ? (Number(m[1] || 0) * 60 + Number(m[2])) : null;
    const where = /等对手进来/.test(s) ? 'W' : (/正在找对手/.test(s) ? 'M' : '?');
    if (!seq.length || seq[seq.length - 1].n !== n || seq[seq.length - 1].where !== where) seq.push({ t: Date.now() - t0, n, where });
    await sleep(100);
  }
  rep.log('changes (ms since tap: value @ screen M=matching W=waiting):');
  rep.log(seq.map((x) => `${x.t}:${x.n}@${x.where}`).join('  '));
  const vals = seq.filter((x) => x.n != null);
  const bad = [];
  for (let i = 1; i < vals.length; i++) {
    const d = vals[i].n - vals[i - 1].n;
    if (d !== 1) bad.push(`${vals[i - 1].n}@${vals[i - 1].where} -> ${vals[i].n}@${vals[i].where} (at ${vals[i].t} ms)`);
  }
  rep.log('non +1 steps:', bad);
  rep.expect(!bad.length, 'the counter only ever goes up by 1 per second');
  await P.tap('#prBack').catch(() => {});
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
