// EXP9: background / foreground. The page is told it is hidden (document.visibilityState='hidden' +
//       visibilitychange), timers keep running (= a phone WebView that is not frozen in the background).
//   a) lobby waiting room, hidden 33 s -> expected: room closed + 「你切出去太久…」
//   b) ladder: 开始排位, then hidden right away (kid switches to WeChat). Another kid starts ranked play.
//   c) battle: hidden 8 s mid-word -> how much time is given back?
import { setup, docs, sleep, report, H, toLobby, openRoom, rt } from './lib.mjs';
const rep = report('EXP9 background / foreground');
const env = await setup({ permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 });
const setVis = (p, v) => p.eval((v) => {
  if (!window.__visHooked) {
    window.__visHooked = 1;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis || 'visible' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
  }
  window.__vis = v; document.dispatchEvent(new Event('visibilitychange')); return true;
}, v);
try {
  // a)
  const P = await env.phone('甲', { nick: '后台蜂' });
  await toLobby(P);
  const R = await openRoom(env.emu, P, 'C');
  await setVis(P, 'hidden');
  await sleep(33000);
  const R1 = docs(env.emu).find((d) => d._id === R._id);
  await setVis(P, 'visible');
  await sleep(800);
  rep.log(`a) waiting room hidden 33 s: server room ${R1 ? R1.status : 'removed'}; screen: ${(await P.screen()).replace(/\s+/g, ' ').slice(0, 90)}`);
  rep.expect(!R1 && /切出去太久/.test(await P.screen()), 'a) room closed and the kid is told why');
  await P.tap('#prBack').catch(() => {}); await sleep(500);

  // b)
  await P.tap('#pkLadder'); await P.waitScreen(/开始排位/, { timeout: 8000 });
  await P.tap('#ldGo'); await P.waitScreen(/正在找对手/, { timeout: 5000 });
  await setVis(P, 'hidden');
  const tHide = Date.now();
  await sleep(26000);
  const mine = docs(env.emu).find((d) => d.kind === 'room' && d._openid === P.cloudUid && d.status === 'open');
  rep.log(`b) ${Math.round((Date.now() - tHide) / 1000)} s after hiding on the matching screen: hidden phone opened ranked room ${mine ? mine._id : '(none)'}`);
  const F = await env.phone('乙', { nick: '前台蜂' });
  await F.tap('#pkLadder'); await H.answerNameIfAsked(F, F.nick); await F.waitScreen(/开始排位/, { timeout: 8000 });
  await F.tap('#ldGo');
  const fb = await H.until(async () => H.battleView(F), { timeout: 40000 });
  rep.log(`b) the other kid got matched with the hidden kid and is in a ranked battle: ${!!fb}`);
  await sleep(20000);
  const pv = await P.eval(() => { const s = window.HansenPkRoomUI._stateForTest(); const r = window.HansenPkRoomUI._rtForTest(); return s ? { started: !!s.startAt, word: r ? r.idx + 1 : 0, my: s.myScore, opp: s.oppScore } : null; });
  rep.log(`b) still hidden after ${Math.round((Date.now() - tHide) / 1000)} s: hidden kid's battle state ${JSON.stringify(pv)}`);
  rep.expect(!fb, 'b) nobody is matched with a kid whose app is in the background');
  await setVis(P, 'visible');
  await sleep(1200);
  rep.log(`b) kid comes back and sees: ${(await P.screen()).replace(/\s+/g, ' ').slice(0, 110)}`);

  // c) grace on the current word
  const v0 = await H.battleView(P);
  if (v0) {
    const r0 = await rt(P);
    const left0 = r0.deadline - Date.now();
    await setVis(P, 'hidden');
    await sleep(8000);
    await setVis(P, 'visible');
    await sleep(1500);
    const r1 = await rt(P);
    if (r1 && r1.idx === r0.idx) {
      const left1 = r1.deadline - Date.now();
      rep.log(`c) word ${r0.idx + 1}: ${Math.round(left0)} ms left before hiding 8 s; ${Math.round(left1)} ms left after coming back (+1.5 s); time given back ≈ ${Math.round(left1 + 9500 - left0)} ms (code comment v1126: grace is capped at 3 s)`);
      rep.expect(left1 + 9500 - left0 <= 3500, 'c) at most 3 s grace for being away (v1126 rule)');
    } else rep.log('c) word changed while hidden (opponent answered or deadline passed):', JSON.stringify(r1));
  }
  rep.log('errors', P.errors, F.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
