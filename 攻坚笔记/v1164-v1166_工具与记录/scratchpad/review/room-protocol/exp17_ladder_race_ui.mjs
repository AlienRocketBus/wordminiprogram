// EXP17 (real UI, ladder): k1 is waiting in its ladder room; k2 and k3 tap 「开始排位」 at the same moment, both find
// k1's room and race for its seat. The loser should be told "taken" and keep searching automatically. Under read lag
// ≥ ~3.2 s the loser's claim() read-back gives up and the duplicate-_id error is classified 'config' ->
// the ladder stops on 「🛠️ 云端设置还差一步 … 这不是你的问题，把这一屏截图发给负责的老师就好」.
// usage: node exp17_ladder_race_ui.mjs <lagMs>
import { setup, docs, sleep, makeReport, H } from './lib.mjs';
const LAG = Number(process.argv[2] || 3500);
const rep = makeReport(`EXP17 ladder seat race (UI) · lag ${LAG}ms`);
const env = await setup({ permissionMode: 'rules', latencyMs: 60, jitterMs: 40, consistencyLagMs: LAG });
try {
  const K = [await env.phone('k1'), await env.phone('k2'), await env.phone('k3')];
  const toHome = async (p) => { await p.tap('#pkLadder'); await H.answerNameIfAsked(p, p.name); await p.waitScreen(/开始排位/, { timeout: 8000 }); };
  await toHome(K[0]);
  await K[0].tap('#ldGo');
  await K[0].waitScreen(/等对手进来/, { timeout: 45000 });
  await sleep(LAG + 1500);
  rep.log('k1 is hosting a ladder room; k2 and k3 start at the same moment');
  await toHome(K[1]); await toHome(K[2]);   /* (opened just now: an idle ladder home trips the watchdog after 25 s — see EXP18) */
  await Promise.all([K[1].tap('#ldGo'), K[2].tap('#ldGo')]);
  const t0 = Date.now();
  let last = '';
  let out = null;
  while (Date.now() - t0 < 60000) {
    const st = [];
    for (const p of K) st.push((await H.battleView(p)) ? 'BATTLE' : (await p.screen()).replace(/\s+/g, ' ').slice(0, 70));
    const line = st.join(' | ');
    if (line !== last) { rep.log(`t+${Math.round((Date.now() - t0) / 1000)}s  ${line}`); last = line; }
    if (st.some((s) => /云端设置还差一步/.test(s))) { out = st; break; }
    if (st.filter((s) => s === 'BATTLE').length === 2 && Date.now() - t0 > 25000) { out = st; break; }
    await sleep(800);
  }
  const bad = (out || []).find((s) => /云端设置还差一步/.test(s));
  if (bad) { const p = K[(out || []).indexOf(bad)]; rep.log('that screen in full:', (await p.screen()).replace(/\n+/g, ' / ').slice(0, 400)); }
  rep.expect(!bad, 'the kid who lost the seat race keeps searching (no 「云端设置还差一步」 screen)');
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT lag=${LAG}: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
