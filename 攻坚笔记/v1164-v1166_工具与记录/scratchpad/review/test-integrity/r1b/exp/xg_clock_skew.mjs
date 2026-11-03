/* XG: the harness runs every "phone" on the same machine clock, so cross-device clock skew is never tested.
 * Kid A's phone clock is OFF ms off (Date.now shifted); kid B is correct. Both press 开始排位.
 * Do they ever meet? And does B's public lobby list A's room? Usage: node xg_clock_skew.mjs <offsetMs> */
import * as H from '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/test-integrity/r1b/cur/cloudbase_e2e_harness.mjs';
const OFF = Number(process.argv[2] || -45000);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 40, consistencyLagMs: 300 } });
const out = { OFF };
const live = [];
async function skew(p, off) {
  if (!off) return;
  await p.ctx.addInitScript((o) => { const n = Date.now.bind(Date); Date.now = () => n() + o; }, off);
  await p.page.reload({ waitUntil: 'domcontentloaded' });
  await p.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI && window.HansenLadderUI && window.HANSEN_VOCAB_ALL), null, { timeout: 45000 });
  await H.sleep(600);
}
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' }); live.push(A); await skew(A, OFF);
  const Bp = await H.openPhone(browser, emu, srv.origin, { name: 'B' }); live.push(Bp);
  out.clockA_minus_B = await A.eval(() => Date.now()) - await Bp.eval(() => Date.now());
  out.login = [(await H.loginPhone(A, '13800000971')).ok, (await H.loginPhone(Bp, '13800000972')).ok];
  /* lobby: A opens a public room, B looks at the list */
  for (const [p, n] of [[A, '小甲'], [Bp, '小乙']]) { await p.tap('#pkRooms'); await H.answerNameIfAsked(p, n); await p.waitScreen(/开一间/, { timeout: 8000 }); }
  await A.tap('#prNew'); await A.tap('.pr_mode[data-mode="C"]'); await A.waitScreen(/等对手进来/, { timeout: 15000 });
  const R = H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid && d.status === 'open');
  const seen = await H.until(async () => { const h = await Bp.hitTest(`button[data-rid="${R && R._id}"]`, { timeout: 400 }); if (h.ok) return true; await Bp.tap('#prRef').catch(() => {}); return null; }, { timeout: 15000, interval: 900 });
  out.lobbyListsA = !!seen;
  out.lobbyB = (await Bp.screen()).replace(/\s+/g, ' ').slice(0, 120);
  await A.tap('#prBack').catch(() => {}); await Bp.tap('#prBack').catch(() => {});
  await H.sleep(1500);
  await A.page.reload({ waitUntil: 'domcontentloaded' }); await Bp.page.reload({ waitUntil: 'domcontentloaded' });
  for (const p of [A, Bp]) await p.page.waitForFunction(() => !!(window.HansenAuth && window.HansenLadderUI && window.HANSEN_VOCAB_ALL), null, { timeout: 45000 });
  await H.sleep(800);
  /* ladder: A first (self-hosts after 20 s), then B */
  for (const [p, n] of [[A, '小甲'], [Bp, '小乙']]) { await p.tap('#pkLadder'); await H.answerNameIfAsked(p, n); await p.waitScreen(/开始排位/, { timeout: 8000 }); }
  await A.tap('#ldGo');
  out.aSelfHosted = await A.waitScreen(/等对手进来/, { timeout: 45000 }).then(() => true, () => false);
  const ts = Date.now();
  await Bp.tap('#ldGo');
  let met = null;
  while (Date.now() - ts < 90000) { if ((await H.battleView(A)) && (await H.battleView(Bp))) { met = Math.round((Date.now() - ts) / 1000); break; } await H.sleep(1000); }
  out.ladderMetAfterSec = met;
  out.openRooms = H.roomDocs(emu).filter((d) => d.kind === 'room' && d.status === 'open').length;
} catch (e) { out.err = String(e && e.stack || e).slice(0, 500); }
console.log(JSON.stringify(out));
for (const p of live) await p.close().catch(() => {});
await browser.close(); srv.close(); process.exit(0);
