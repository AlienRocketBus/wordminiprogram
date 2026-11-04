// EXP14 (real UI): N kids tap 「开始排位」 at the same moment. Nobody finds a room for 20 s -> all self-host
// at about the same time -> rescans + oldest-wins switchTo must pair them up (N=3: one pair + one waiting;
// N=4: two pairs). Records every phone's screen over time and the room docs.
// usage: node exp14_ladder_n_hosts_ui.mjs <N> <lagMs>
import { setup, docs, sleep, makeReport, H } from './lib.mjs';
const N = Number(process.argv[2] || 3);
const LAG = Number(process.argv[3] || 400);
const rep = makeReport(`EXP14 ladder · ${N} kids start at once · lag ${LAG}ms`);
const env = await setup({ permissionMode: 'rules', latencyMs: 60, jitterMs: 60, consistencyLagMs: LAG });
const state = async (p) => {
  if (await H.battleView(p)) return 'BATTLE';
  const s = (await p.screen()).replace(/\s+/g, ' ');
  if (/等对手进来/.test(s)) return 'hosting';
  if (/正在找对手/.test(s)) return 'matching';
  if (/进房中|等房主确认/.test(s)) return 'joining';
  if (/先开好的房/.test(s)) return 'switching';
  return s.slice(0, 40);
};
try {
  const P = [];
  for (let i = 0; i < N; i++) P.push(await env.phone('k' + (i + 1)));
  for (const p of P) { await p.tap('#pkLadder'); await H.answerNameIfAsked(p, p.name); await p.waitScreen(/开始排位/, { timeout: 8000 }); }
  await Promise.all(P.map((p) => p.tap('#ldGo')));
  const t0 = Date.now();
  let last = '';
  let pairedAt = 0;
  while (Date.now() - t0 < 90000) {
    const st = []; for (const p of P) st.push(await state(p));
    const line = st.join(' | ');
    if (line !== last) { rep.log(`t+${Math.round((Date.now() - t0) / 1000)}s  ${line}`); last = line; }
    const inB = st.filter((x) => x === 'BATTLE').length;
    if (inB >= 2 * Math.floor(N / 2)) { if (!pairedAt) pairedAt = Date.now(); if (Date.now() - pairedAt > 6000) break; }
    await sleep(700);
  }
  const st = []; for (const p of P) st.push(await state(p));
  const inB = st.filter((x) => x === 'BATTLE').length;
  rep.log('rooms:', docs(env.emu).filter((d) => d.kind === 'room').map((d) => `${d._id.slice(-5)}:${d.status}${d.guestId ? '+guest' : ''}`).join(' '));
  rep.expect(inB === 2 * Math.floor(N / 2), `${2 * Math.floor(N / 2)} of ${N} kids end up in a battle within 90 s (got ${inB})`);
  rep.expect(H.foreignWrites(env.emu).length === 0, 'nobody wrote someone else\'s doc');
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT N=${N} lag=${LAG}: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
