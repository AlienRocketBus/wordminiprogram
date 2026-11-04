// EXP15 (real UI, ranked A mode): the guest's phone loses the network for 70 s mid-match. The host is told
// 「对手已离场，本局你胜」 (correct). When the guest's network comes back, its battle screen just carries on:
// opponentGone() answers {oppFinished} (claimAbandonWin wrote hostScore=1) instead of the abandon verdict, so the
// guest keeps spelling and "winning" words alone; only the final screen says it lost.
import { setup, docs, sleep, makeReport, H } from './lib.mjs';
const rep = makeReport('EXP15 returning player keeps playing a match that is already decided (UI)');
const env = await setup({ permissionMode: 'legacy', latencyMs: 50, jitterMs: 30, consistencyLagMs: 300 });
const E = env.emu;
const hint = (p) => p.eval(() => ((document.getElementById('prHint') || {}).innerText || '').trim());
const type = (p, w) => p.eval((w) => { const i = document.getElementById('prIn'); if (!i || i.disabled) return false; i.value = w; i.oninput(); return true; }, w);
try {
  const A = await env.phone('房主'), B = await env.phone('客人');
  for (const p of [A, B]) { await p.tap('#pkRooms'); await H.answerNameIfAsked(p, p.name); await p.waitScreen(/开一间/, { timeout: 8000 }); }
  await A.tap('#prNew'); await A.tap('.pr_mode[data-mode="A"]');
  await A.waitScreen(/等对手进来/, { timeout: 15000 });
  const R = docs(E).find((d) => d.kind === 'room' && d._openid === A.cloudUid && d.status === 'open');
  const words = await H.wordsOfRoom(A, R);
  await H.until(async () => { const h = await B.hitTest(`button[data-rid="${R._id}"]`, { timeout: 400 }); if (h.ok) return h; await B.tap('#prRef').catch(() => {}); return null; }, { timeout: 15000, interval: 900 });
  await B.tap(`button[data-rid="${R._id}"]`);
  await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: 30000 });
  await sleep(1500);
  await type(A, words[0].en);                     // host takes word 1
  await sleep(3000);
  rep.log('word 1 played; now the guest\'s phone loses the network for 70 s');
  const off = E.fault({ uid: B.cloudUid, do: 'abort' });
  const hostRes = await H.waitResult(A, 90000);
  rep.log('host screen:', hostRes && hostRes.text.split('\n').slice(0, 2).join(' / '));
  await sleep(8000);
  off.remove();
  rep.log('guest network back; guest is on word', ((await H.battleView(B)) || {}).round + 1);
  const seen = [];
  for (let k = 0; k < 30; k++) {
    const v = await H.battleView(B);
    if (!v) break;
    if (!v.disabled && words[v.round]) { await type(B, words[v.round].en); await sleep(900); const h = await hint(B); if (seen[seen.length - 1] !== h) seen.push(`word ${v.round + 1}: ${h.slice(0, 40)}`); }
    await sleep(700);
  }
  seen.forEach((s) => rep.log('   guest ' + s));
  const gTxt = await H.until(async () => { const s = await B.screen(); return /判给了对手|你赢了|这局输了|打平|本局你胜|没拿到/.test(s) ? s : null; }, { timeout: 90000, interval: 500 });
  rep.log('guest final screen:', gTxt && gTxt.replace(/\n+/g, ' / ').slice(0, 160));
  rep.expect(seen.length === 0, 'once the host has been awarded the game, the returning guest is told so instead of playing on');
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.pass} as-expected, ${rep.fail} unexpected`);
process.exit(0);
