import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 20 } });
const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' });
const r = await H.loginPhone(A, '13800000077');
console.log('login', JSON.stringify(r).slice(0, 200));
const n0 = emu.log.length;
const x = await A.eval(async () => {
  const P = window.HansenPkRoom;
  const c = await P.createRoom({ mode: 'C' });
  const l = await P.listRooms();
  return { c: c && { ok: c.ok, roomId: c.roomId, reason: c.reason }, l: l && { ok: l.ok, n: (l.rooms || []).length } };
});
console.log(JSON.stringify(x));
await H.sleep(3000);
for (const e of emu.log.slice(n0)) console.log(e.method, e.path, e.action, e.collection, 'docId=' + JSON.stringify(e.docId), e.status, e.code || '');
await A.close(); srv.close(); await browser.close();
