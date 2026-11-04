// End-to-end on the REAL app page (spelling_pk.html) with the REAL account + room modules
// (hansen_auth_v1004.js, hansen_pk_room_v1065.js, vendor SDK) — no _setTransportForTest, no _setAuthForTest.
// Only the Tencent hosts are answered by emulator.mjs.
// Usage: node poc_app.mjs [READONLY|PUBLIC_TEST_ONLY] [legacy|rules]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmulator, ACL } from './emulator.mjs';
import { startStatic, launch, newCtx, E } from './harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const roomsAcl = ACL[process.argv[2] || 'READONLY'];
const mode = process.argv[3] || 'legacy';
const emu = createEmulator({
  collections: { hansen_pk_rooms: roomsAcl, hansen_saves: ACL.READONLY, sb_profile: ACL.READONLY, counters: ACL.ADMINONLY, hansen_friends: ACL.READONLY, hansen_pk_records: ACL.READONLY },
  knobs: { permissionMode: mode, latencyMs: Number(process.env.EMU_LATENCY || 40) },
});
emu.seedUser({ username: 'alice_poc', password: 'pw123456', name: 'Alice' });
emu.seedUser({ username: 'bob_poc', password: 'pw123456', name: 'Bob' });

const srv = await startStatic();
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;
const browser = await launch();
const out = { roomsAcl, mode };
const open = async (tag) => {
  const c = await newCtx(browser, emu, ORIGIN, { tag, url: '/spelling_pk.html', waitReady: false, ctxOpts: { serviceWorkers: 'block', viewport: { width: 390, height: 844 } } });
  await c.page.waitForFunction(() => window.HansenAuth && window.HansenPkRoom && window.HansenAuth.loginByPassword, null, { timeout: 20000 });
  await c.page.waitForTimeout(1500);
  return c;
};
const login = (page, u) => E(page, async (u) => {
  const r = await window.HansenAuth.loginByPassword(u, 'pw123456').then((x) => ({ ok: true, x }), (e) => ({ ok: false, e: String(e && e.message || e) }));
  const s = await window.HansenAuth.ensureSession();
  return { login: r, session: s, local: window.HansenAuth.readLocal() };
}, u);

try {
  const A = await open('A');
  out.A_login = await login(A.page, 'alice_poc');
  out.A_create = await E(A.page, async () => {
    const r = await window.HansenPkRoom.createRoom({ mode: 'A', isPrivate: false, hostRating: 1000, wordCount: 10 });
    return r;
  });
  out.rooms_in_emulator = emu.dump('hansen_pk_rooms').map((d) => ({ _id: d._id, status: d.status, mode: d.mode, hostId: d.hostId, guestId: d.guestId, _openid: d._openid, keys: Object.keys(d).length }));

  const B = await open('B');
  out.B_login = await login(B.page, 'bob_poc');
  out.B_list = await E(B.page, async () => window.HansenPkRoom.listRooms());
  const rid = out.B_list && out.B_list.rooms && out.B_list.rooms[0] && out.B_list.rooms[0].id;
  out.B_join = rid ? await E(B.page, async (rid) => window.HansenPkRoom.joinRoom(rid), rid) : 'no room listed';
  out.room_after_join = emu.dump('hansen_pk_rooms').map((d) => ({ status: d.status, guestId: d.guestId, guestBeat: d.guestBeat }));
  out.B_trace = await E(B.page, () => window.HansenAuth._trace().split('\n').slice(-6));
  out.unrouted = [...A.unrouted, ...B.unrouted];
  out.endpoints = [...new Set(emu.log.map((x) => `${x.method} ${x.path}${x.body && x.body.action ? ' ' + x.body.action + ' ' + (x.body.collectionName || '') : ''}`))];
  out.dbErrorsReturned = emu.log.filter((x) => x.res && /"code":"/.test(x.res.body || '')).map((x) => `${x.body.action} ${x.body.collectionName} -> ${(/"code":"([A-Z_]+)"/.exec(x.res.body) || [])[1]}`);
  out.deniedWrites = emu.log.filter((x) => x.body && /update|delete/.test(x.body.action || '') && x.res && /"(updated|deleted)":0/.test(x.res.body)).map((x) => `${x.body.action} ${x.body.collectionName} q=${JSON.stringify(x.body.query).slice(0, 80)} -> 0`);
} finally {
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(HERE, `app_result_${roomsAcl}_${mode}.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 9000));
}
