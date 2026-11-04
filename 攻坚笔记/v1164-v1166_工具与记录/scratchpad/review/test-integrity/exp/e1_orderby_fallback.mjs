/* E1: emulator assumption "orderBy never fails" flipped.
 * The project itself believes "orderBy 要建索引，没建就整个查询报错" (hansen_pk_room_v1065.js listOpen comment, v1157).
 * Flip: every queryDocument that carries `order` gets HTTP 200 {code} (resolved by SDK, like the real server's business errors).
 * Plus: Z old-format (v1163, no proto:2) rooms still marked open on the server — v1164's sweep never removes them
 * (it lists {hostId:'u'+uid}; v1163 rooms carry the phone number as hostId).
 * Usage: node e1_orderby_fallback.mjs <ok|refuse> <Z> */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
const MODE = process.argv[2] || 'refuse';
const Z = Number(process.argv[3] || 45);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 30, consistencyLagMs: 300 } });
const day = 86400000, t0 = Date.now();
for (let i = 0; i < Z; i++) emu.seedDoc('hansen_pk_rooms', { _id: 'rold' + i, status: 'open', isPrivate: false, hostId: '1380000' + (1000 + i), guestId: '', hostName: '老房' + i, mode: 'A', seed: 1, wordCount: 10, winners: [], round: 0, heartbeatAt: t0 - 3 * day + i, createdAt: t0 - 3 * day + i }, '1999' + String(i).padStart(15, '0'), 3 * day);
let refused = 0;
async function overlay(p) {
  if (MODE !== 'refuse') return;
  await p.ctx.route((u) => /tencentcloudapi\.com$/.test(new URL(u).hostname), async (r) => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) { /* */ }
    if (b.action === 'database.queryDocument' && Array.isArray(b.order) && b.order.length) {
      refused++;
      return r.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ code: 'DATABASE_REQUEST_FAILED', message: '[FailedOperation] sort field has no index (emulated)', requestId: 'x' }) });
    }
    return r.fallback();
  });
}
const out = { MODE, Z };
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' }); await overlay(A);
  const B = await H.openPhone(browser, emu, srv.origin, { name: 'B' }); await overlay(B);
  const warns = [];
  B.page.on('console', (m) => { if (/orderBy/.test(m.text())) warns.push(m.text().slice(0, 120)); });
  out.loginA = (await H.loginPhone(A, '13800000901')).ok; out.loginB = (await H.loginPhone(B, '13800000902')).ok;
  const made = await A.eval(() => window.HansenPkRoom.createRoom({ mode: 'C' }).then((r) => ({ ok: r.ok, roomId: r.roomId, reason: r.reason })));
  out.created = made;
  await H.sleep(1500);
  const ls = await B.eval(() => window.HansenPkRoom.listRooms().then((r) => ({ ok: r.ok, n: (r.rooms || []).length, ids: (r.rooms || []).map((x) => x._id || x.roomId || x.id), reason: r.reason })));
  out.list = ls;
  out.hostRoomListed = !!(ls && ls.ids && ls.ids.includes(made.roomId));
  /* UI: what the kid sees in the public lobby */
  await B.tap('#pkRooms'); await H.answerNameIfAsked(B, '小乙');
  await H.sleep(3000);
  out.lobbyHasJoinButton = (await B.hitTest(`button[data-rid="${made.roomId}"]`, { timeout: 1500 })).ok;
  out.lobbyText = (await B.screen()).replace(/\s+/g, ' ').slice(0, 160);
  out.refusedQueries = refused;
  out.consoleWarn = warns.slice(0, 2);
} catch (e) { out.err = String(e && e.stack || e).slice(0, 400); }
console.log(JSON.stringify(out, null, 1));
await browser.close(); srv.close();
process.exit(0);
