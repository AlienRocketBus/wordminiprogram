// EXP9 (real UI, two phones, A mode = the ranked mode): who decides a word's deadline, and what a skip does to it.
//   variant 0       : clocks right. Host wins word 1; on word 2 nobody types. The guest's deadline comes from the
//                     shared roundAt (= W0.at), the host's from its own screen time (~1.5-2 s later). The guest times
//                     out first -> skipRound writes W1 = '' -> the host types the word while its clock still shows time
//                     -> claimRound loses the _id race to the skip -> 「⏱ 超时了」, 0 points.
//   variant +600000 : host clock 10 min fast. After the host wins word 1, the guest's word-2 clock shows ~620 s
//                     (roundAt = W0.at from the host's clock), and when the host times out (skip) the guest stays on it.
//   variant -15000  : host clock 15 s slow -> the guest's word-2 clock starts at ~3 s.
// usage: node exp9_ui_round_deadlines.mjs <hostSkewMs>
import { setup, call, docs, sleep, makeReport, H } from './lib.mjs';
const SKEW = Number(process.argv[2] || 0);
const rep = makeReport(`EXP9 UI round deadlines · host clock skew ${SKEW} ms`);
const env = await setup({ permissionMode: 'legacy', latencyMs: 50, jitterMs: 30, consistencyLagMs: 300 });
const clock = (p) => p.eval(() => ((document.getElementById('prClock') || {}).textContent || '').trim());
const hint = (p) => p.eval(() => ((document.getElementById('prHint') || {}).innerText || '').trim());
try {
  const A = await env.phone('房主', SKEW ? { skewMs: SKEW } : {});
  const B = await env.phone('客人');
  for (const p of [A, B]) { await p.tap('#pkRooms'); await H.answerNameIfAsked(p, p.name); await p.waitScreen(/开一间/, { timeout: 8000 }); }
  await A.tap('#prNew'); await A.tap('.pr_mode[data-mode="A"]');
  await A.waitScreen(/等对手进来/, { timeout: 15000 });
  const R = docs(env.emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid && d.status === 'open');
  const words = await H.wordsOfRoom(A, R);
  const btn = await H.until(async () => { const h = await B.hitTest(`button[data-rid="${R._id}"]`, { timeout: 400 }); if (h.ok) return h; await B.tap('#prRef').catch(() => {}); return null; }, { timeout: 15000, interval: 900 });
  await B.tap(`button[data-rid="${R._id}"]`);
  const both = await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: 30000 });
  rep.log('both on the battle screen:', !!both, 'words:', words.slice(0, 3).map((w) => w.en).join(','));
  /* word 1: host types it (fast) */
  await sleep(1500);
  await A.eval((w) => { const i = document.getElementById('prIn'); i.value = w; i.oninput(); return true; }, words[0].en);
  /* wait until both show word 2 */
  await H.until(async () => { const a = await H.battleView(A), b = await H.battleView(B); return a && b && a.round === 1 && b.round === 1; }, { timeout: 20000, interval: 150 });
  await sleep(1200);
  const ca = await clock(A), cb = await clock(B);
  rep.log(`word 2 just started: host clock ${ca}, guest clock ${cb}`);
  if (SKEW > 0) {
    rep.expect(parseInt(cb.replace(/\D/g, ''), 10) <= 20, 'guest\'s word-2 clock is at most the 20 s the rules give');
    await sleep(26000);   // host (fast clock) times out on its own 20 s and writes the skip
    const vb = await H.battleView(B), va = await H.battleView(A);
    rep.log(`26 s later: host on word ${va && va.round + 1} (clock ${await clock(A)}), guest still on word ${vb && vb.round + 1} with clock ${await clock(B)}`);
    rep.log('W1 on server:', JSON.stringify((docs(env.emu).find((d) => d._id === R._id + '_w1') || {}).winner));
    rep.expect(vb && vb.round > 1, 'guest moves on when the word is over');
  } else if (SKEW < 0) {
    rep.expect(parseInt(cb.replace(/\D/g, ''), 10) >= 12, 'guest gets a fair amount of time on word 2 (rules: 20 s)');
  } else {
    /* nobody types word 2; the moment the guest's skip doc appears, the host types the word */
    const t0 = Date.now();
    let W1 = null;
    while (Date.now() - t0 < 30000) { W1 = docs(env.emu).find((d) => d._id === R._id + '_w1'); if (W1) break; await sleep(40); }
    const hc = await clock(A);
    await A.eval((w) => { const i = document.getElementById('prIn'); i.value = w; i.oninput(); return true; }, words[1].en);
    await sleep(1500);
    const h2 = await hint(A), my = (await H.battleView(A) || {}).my;
    rep.log(`guest's skip landed (W1 winner=${JSON.stringify(W1 && W1.winner)} by guest=${W1 && W1._openid === B.cloudUid}); host's clock then showed ${hc}; host typed the word correctly ->`, JSON.stringify(h2.slice(0, 60)), 'host score', my);
    rep.expect(!/超时/.test(h2), 'a correct answer typed while my clock still shows time is not called 「超时了」');
  }
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT skew=${SKEW}: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
