/* XN: mid-battle variant of the F2 path. Mode A (抢答): host spells each word first, guest finishes the same word right after
 * (duplicate round-win add). Right after the guest's FIRST duplicate rejection, its next N reads fail (flaky 4G).
 * What does the guest see, and does the match still finish consistently? Usage: node xn_round_dup_readfail.mjs <N> */
import * as H from '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/test-integrity/r1b/cur/cloudbase_e2e_harness.mjs';
const N = Number(process.argv[2] || 5);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 50, jitterMs: 50, consistencyLagMs: 300 } });
const out = { N };
const live = [];
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' }); live.push(A);
  const G = await H.openPhone(browser, emu, srv.origin, { name: 'G' }); live.push(G);
  out.login = [(await H.loginPhone(A, '13800000993')).ok, (await H.loginPhone(G, '13800000994')).ok];
  for (const [p, n] of [[A, '小甲'], [G, '小乙']]) { await p.tap('#pkRooms'); await H.answerNameIfAsked(p, n); await p.waitScreen(/开一间/, { timeout: 8000 }); }
  await A.tap('#prNew'); await A.tap('.pr_mode[data-mode="A"]'); await A.waitScreen(/等对手进来/, { timeout: 15000 });
  const R = H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid && d.status === 'open');
  await H.until(async () => { const h = await G.hitTest(`button[data-rid="${R._id}"]`, { timeout: 400 }); if (h.ok) return h; await G.tap('#prRef').catch(() => {}); return null; }, { timeout: 15000, interval: 900 });
  await G.tap(`button[data-rid="${R._id}"]`);
  const both = await H.until(async () => (await H.battleView(A)) && (await H.battleView(G)), { timeout: 40000 });
  out.inBattle = !!both;
  let armed = false;
  const firstDup = () => emu.log.find((e) => e.action === 'database.addDocument' && e.code === 'DATABASE_REQUEST_FAILED' && e.uid === G.cloudUid);
  const f = emu.fault({ test: (ctx) => { if (ctx.uid !== G.cloudUid || ctx.action !== 'database.queryDocument') return false; const d = firstDup(); return !!d; }, do: 'abort', times: N });
  const words = await H.wordsOfRoom(A, H.roomDocs(emu).find((d) => d._id === R._id));
  const okIdx = words.map((w, i) => (H.typeable(w) ? i : -1)).filter((i) => i >= 0);
  const plan = (i) => (okIdx.indexOf(i) < 0 ? {} : { first: 'host', second: 'guest', delayMs: 0 });
  const seen = new Set();
  const watcher = (async () => { const t0 = Date.now(); while (Date.now() - t0 < 150000) { const s = (await G.screen()).replace(/\s+/g, ' '); for (const k of ['云端设置还差一步', '连不上网络', '这次没成功', '网络不太顺', '出了点问题', '对手已离场', '你赢了', '这局输了']) if (s.includes(k)) seen.add(k); if (/你赢了|这局输了|打平/.test(s)) break; await H.sleep(500); } })();
  const run = await H.playMatch({ host: A, guest: G }, words, plan, { timeout: 150000 });
  const rA = await H.waitResult(A, 60000), rG = await H.waitResult(G, 60000);
  await watcher;
  out.faultHits = f.hits;
  out.guestDups = emu.log.filter((e) => e.action === 'database.addDocument' && e.code === 'DATABASE_REQUEST_FAILED' && e.uid === G.cloudUid).length;
  out.guestSaw = [...seen];
  out.hostResult = rA && [rA.mine, rA.theirs, rA.win ? 'win' : rA.lose ? 'lose' : rA.draw ? 'draw' : '?'];
  out.guestResult = rG && [rG.mine, rG.theirs, rG.win ? 'win' : rG.lose ? 'lose' : rG.draw ? 'draw' : '?'];
  out.wins = H.roomDocs(emu).filter((d) => d.kind === 'win' && d.roomId === R._id).map((d) => d.winner).join(',');
  out.pageErrors = live.map((p) => p.errors.slice(0, 2));
} catch (e) { out.err = String(e && e.stack || e).slice(0, 500); }
console.log(JSON.stringify(out));
for (const p of live) await p.close().catch(() => {});
await browser.close(); srv.close(); process.exit(0);
