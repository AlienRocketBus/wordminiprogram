// EXP1 (real pages, real SDK, emulator network, touch taps): B/C scoring rules.
//   Published rules (HansenPkRoom.MODES): 先拼对 100 分，后拼对 60(C)/80(B)；两人都答完才翻篇。
//   Word 1: the phone whose word-1 clock ends first stays idle (times out -> skipRound writes W0 = '');
//           the other phone (still has time on its own clock) spells the word correctly right after.
//           It is the FIRST (only) correct speller -> rules say 100.
//   Word 2: phone X answers fast, phone Y 4 s later -> X 100, Y 60/80, and X must wait (两人都答完才翻篇).
// usage: node exp1_bc_scoring.mjs [C|B|A]
import { setup, docs, sleep, report, H, toLobby, openRoom, joinRoomUI, rt, hint } from './lib.mjs';
const MODE = process.argv[2] || 'C';
const rep = report(`EXP1 scoring in mode ${MODE}`);
const env = await setup({ permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 });
async function tapLetters(p, word) { for (const ch of String(word).toLowerCase()) await p.tap(`#prKb .pr_key[data-k="${ch}"]`, { timeout: 4000 }); }
try {
  const A = await env.phone('房主', { nick: '房主蜂' });
  const B = await env.phone('客人', { nick: '客人蜂' });
  await toLobby(A);
  const R = await openRoom(env.emu, A, MODE);
  rep.log('room', R && R._id, 'mode', R && R.mode);
  await joinRoomUI(B, R._id);
  const both = await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: 40000 });
  rep.log('both on battle screen:', !!both);
  const words = await H.wordsOfRoom(A, R);
  rep.log('words:', words.map((w) => w.en).join(','));
  await sleep(1500);
  const ra = await rt(A), rb = await rt(B);
  rep.log(`word-1 deadlines: host ${ra && ra.deadline}, guest ${rb && rb.deadline}, host - guest = ${ra && rb ? ra.deadline - rb.deadline : '?'} ms`);
  const early = (ra.deadline <= rb.deadline) ? A : B;       // its clock runs out first -> stays idle
  const late = early === A ? B : A;
  const w0 = words[0].en;
  rep.log(`early(idle)=${early.name}, late(spells)=${late.name}, word1=${w0}`);
  await tapLetters(late, w0.slice(0, -1));
  // wait for the idle phone's skip doc W0
  let W0 = null; const t0 = Date.now();
  while (Date.now() - t0 < 30000) { W0 = docs(env.emu).find((d) => d._id === R._id + '_w0'); if (W0) break; await sleep(25); }
  const lr = await rt(late);
  const leftMs = lr ? lr.deadline - Date.now() : null;
  const clockTxt = await late.eval(() => ((document.getElementById('prClock') || {}).textContent || '').trim());
  rep.log(`W0 landed: winner=${JSON.stringify(W0 && W0.winner)} written by ${W0 && W0._openid === early.cloudUid ? early.name : '?'}; ${late.name} still has ${leftMs} ms on its own clock (shows ${clockTxt})`);
  await late.tap(`#prKb .pr_key[data-k="${w0.slice(-1).toLowerCase()}"]`, { timeout: 3000 });
  await sleep(1300);
  const h1 = await hint(late), v1 = await H.battleView(late);
  rep.log(`${late.name} spelled 「${w0}」 correctly before its clock ran out, nobody else spelled it -> hint: ${JSON.stringify(h1)} score ${v1 && v1.my}`);
  const M = await A.eval((m) => window.HansenPkRoom.modeOf(m), MODE);
  rep.expect(v1 && v1.my === M.firstScore, `the only (first) correct speller gets firstScore ${M.firstScore} (got ${v1 && v1.my})`);
  rep.expect(!/超时/.test(h1), 'a correct answer is not called 「超时了」');

  if (MODE !== 'A') {
    // word 2: X answers immediately, Y 4 s later
    const both2 = await H.until(async () => { const a = await H.battleView(A), b = await H.battleView(B); return a && b && a.round === 1 && b.round === 1 && !a.disabled && !b.disabled; }, { timeout: 30000, interval: 150 });
    rep.log('both on word 2:', !!both2);
    const X = A, Y = B, w1 = words[1].en;
    const s0X = (await H.battleView(X)).my, s0Y = (await H.battleView(Y)).my;
    await tapLetters(X, w1);
    const tX = Date.now();
    await sleep(800);
    const samples = [];
    while (Date.now() - tX < 4000) { const v = await H.battleView(X); samples.push(v ? v.round : -1); await sleep(300); }
    await tapLetters(Y, w1);
    await sleep(1500);
    const vX = await H.battleView(X), vY = await H.battleView(Y);
    const hY = await hint(Y);
    rep.log(`X samples while Y still spelling (word index): ${samples.join(',')}`);
    rep.expect(samples.every((r) => r === 1), 'X waits on word 2 until Y has answered (两人都答完才翻篇)');
    rep.log(`Y hint after spelling second: ${JSON.stringify(hY)}; X score ${s0X}->${vX && vX.my}, Y score ${s0Y}->${vY && vY.my}`);
    rep.expect(vY && vY.my - s0Y === M.secondScore, `second correct speller gets secondScore ${M.secondScore}`);
  }
  for (const p of [A, B]) rep.log(`[${p.name}] page errors: ${p.errors.length} ${p.errors.slice(0, 2).join(' | ')}`);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT mode=${MODE}: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
