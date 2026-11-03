/* TI-1: when the ordered listOpen query is refused, the fallback takes 40 docs in natural order (oldest first).
   Seed N stale v1163-format open public rooms (no proto, can never be swept by v1164), then:
   A opens a fresh public room in the lobby; B opens the lobby → does B see it? */
import { H, overlay, phone, toLobby, flat } from './common.mjs';
const [N, REFUSE] = [Number(process.argv[2] || 45), process.argv[3] !== 'ok'];
const srv = await H.startStatic(); const browser = await H.launchBrowser();
const live = [], names = {};
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
const day = 86400000, old = Date.now() - 3 * day;
for (let i = 0; i < N; i++) {
  emu.seedDoc('hansen_pk_rooms', { _id: 'rold' + String(i).padStart(3, '0'), status: 'open', isPrivate: false, code: '', hostId: '1380000' + String(1000 + i), hostName: '旧版' + i, hostRating: 1000, guestId: '', guestName: '', seed: i, wordCount: 10, createdAt: old + i * 1000, heartbeatAt: old + i * 1000, hostBeat: old + i * 1000, guestBeat: 0, hostScore: null, guestScore: null }, '1700000000000000' + String(100 + i), 3 * day);
}
const stats = {};
const refuse = (ph) => overlay(ph, (b) => b.action === 'database.queryDocument' && b.collectionName === 'hansen_pk_rooms' && Array.isArray(b.order) && b.order.length,
  () => ({ status: 200, body: { code: 'DATABASE_REQUEST_FAILED', message: '[FailedOperation] sort field has no index (emulated)', requestId: 'x' } }), stats);
const out = { N, refuse: REFUSE };
try {
  const A = await phone(browser, emu, srv, 'A', '13800000071', '小蜂A', live, names);
  const B = await phone(browser, emu, srv, 'B', '13800000072', '小蜂B', live, names);
  if (REFUSE) { await refuse(A); await refuse(B); }
  await toLobby(A);
  await A.tap('#prNew'); await A.tap('.pr_mode[data-mode="C"]');
  await A.waitScreen(/等对手进来/, { timeout: 15000 });
  const RA = H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid);
  out.roomA = RA && { id: RA._id, status: RA.status, proto: RA.proto };
  await toLobby(B);
  let seen = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 15000 && !seen) {
    const h = await B.hitTest(`button[data-rid="${RA._id}"]`, { timeout: 500 });
    if (h.ok) seen = Math.round((Date.now() - t0) / 1000);
    else { await B.tap('#prRef').catch(() => {}); await H.sleep(1200); }
  }
  out.lobbyListsA_afterSec = seen;
  out.lobbyText = flat(await B.screen()).slice(0, 140);
  const lr = await B.eval(async () => { const r = await window.HansenPkRoom.listRooms(); return { ok: r.ok, n: (r.rooms || []).length, ids: (r.rooms || []).map((x) => x.id) }; });
  out.listRoomsB = lr;
  out.listRoomsIncludesA = !!(lr && lr.ids && lr.ids.includes(RA._id));
  out.refusedOrderedQueries = stats.hits || 0;
  out.openDocsInDb = H.roomDocs(emu).filter((d) => d.status === 'open').length;
  out.pageErrors = live.map((p) => p.errors.length);
} catch (e) { out.err = String(e && e.message || e).slice(0, 400); }
console.log(JSON.stringify(out));
for (const p of live) await p.close();
srv.close(); await browser.close();
process.exit(0);
