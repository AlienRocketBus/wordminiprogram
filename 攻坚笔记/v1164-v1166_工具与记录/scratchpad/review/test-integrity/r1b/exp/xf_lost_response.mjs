/* XF: the emulator's 'commitThenAbort' fault (write lands on the server, response lost — weak 4G) is never used by any test.
 * Exercise it on (1) the guest's seat add and (2) the host's first round-win add, with the real pages + SDK.
 * Usage: node xf_lost_response.mjs */
import * as H from '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/test-integrity/r1b/cur/cloudbase_e2e_harness.mjs';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 50, jitterMs: 50, consistencyLagMs: 300 } });
const out = {};
const live = [];
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' }); live.push(A);
  const Bp = await H.openPhone(browser, emu, srv.origin, { name: 'B' }); live.push(Bp);
  out.login = [(await H.loginPhone(A, '13800000961')).ok, (await H.loginPhone(Bp, '13800000962')).ok];
  for (const [p, n] of [[A, '小甲'], [Bp, '小乙']]) { await p.tap('#pkRooms'); await H.answerNameIfAsked(p, n); await p.waitScreen(/开一间/, { timeout: 8000 }); }
  await A.tap('#prNew'); await A.tap('.pr_mode[data-mode="A"]');
  await A.waitScreen(/等对手进来/, { timeout: 15000 });
  const R = H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid && d.status === 'open');
  const btn = await H.until(async () => { const h = await Bp.hitTest(`button[data-rid="${R._id}"]`, { timeout: 400 }); if (h.ok) return h; await Bp.tap('#prRef').catch(() => {}); return null; }, { timeout: 15000, interval: 900 });
  /* (1) guest's seat add: committed on the server, response lost */
  const f1 = emu.fault({ uid: Bp.cloudUid, action: 'database.addDocument', collection: 'hansen_pk_rooms', do: 'commitThenAbort', times: 1 });
  await Bp.tap(`button[data-rid="${R._id}"]`);
  const both = await H.until(async () => (await H.battleView(A)) && (await H.battleView(Bp)), { timeout: 40000 });
  out.seatLostResponse = { faultHits: f1.hits, bothInBattle: !!both, guestScreen: both ? '' : (await Bp.screen()).replace(/\s+/g, ' ').slice(0, 160),
    seats: H.roomDocs(emu).filter((d) => d.kind === 'seat' && d.roomId === R._id).map((d) => ({ owner: d._openid === Bp.cloudUid ? 'B' : '?', left: !!d.left })) };
  if (both) {
    const words = await H.wordsOfRoom(A, H.roomDocs(emu).find((d) => d._id === R._id));
    const ok = words.map((w, i) => (H.typeable(w) ? i : -1)).filter((i) => i >= 0);
    /* (2) host's first round-win add: committed, response lost */
    const f2 = emu.fault({ uid: A.cloudUid, action: 'database.addDocument', collection: 'hansen_pk_rooms', do: 'commitThenAbort', times: 1 });
    const plan = (i) => (ok.indexOf(i) < 0 ? {} : { first: 'host' });
    const exp = H.expectedScores(words, plan, { firstScore: 100, secondScore: 0, waitAll: false });
    const run = await H.playMatch({ host: A, guest: Bp }, words, plan);
    const rA = await H.waitResult(A, 60000), rB = await H.waitResult(Bp, 60000);
    const W = H.roomDocs(emu).filter((d) => d.kind === 'win' && d.roomId === R._id);
    out.winLostResponse = { faultHits: f2.hits, expected: exp, hostSaw: rA && [rA.mine, rA.theirs], guestSaw: rB && [rB.mine, rB.theirs],
      winDocs: W.length, hostWins: W.filter((w) => w.winner === 'host').length, wrongCn: run.wrongCn.slice(0, 3) };
  }
  out.pageErrors = live.map((p) => p.errors.slice(0, 2));
} catch (e) { out.err = String(e && e.stack || e).slice(0, 500); }
console.log(JSON.stringify(out));
for (const p of live) await p.close().catch(() => {});
await browser.close(); srv.close(); process.exit(0);
