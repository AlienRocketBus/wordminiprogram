/* 可行性：一轮轮询用一次 where({_id: in [房间, 座位, 回合]}) 取回三条文档（真 SDK → 模拟云端），两种权限模式都行 */
import { H, tally, fmt } from './meas_lib.mjs';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
for (const mode of ['legacy', 'rules']) {
  const emu = H.makeEmulator({ knobs: { permissionMode: mode, latencyMs: 30, consistencyLagMs: 0 } });
  const READY = () => !!(window.HansenAuth && window.HansenPkRoom);
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
  const B = await H.openPhone(browser, emu, srv.origin, { name: 'B', ready: READY });
  await H.loginPhone(A, '13300000001'); await H.loginPhone(B, '13300000002');
  /* 房主 A 的房、客人 B 的座位、B 拿下的第 0 词 —— 三个不同的人/文档 */
  emu.seedDoc('hansen_pk_rooms', { _id: 'rX', proto: 2, kind: 'room', status: 'playing', hostId: 'u' + A.cloudUid, seat: 0 }, A.cloudUid);
  emu.seedDoc('hansen_pk_rooms', { _id: 'rX_s0', proto: 2, kind: 'seat', roomId: 'rX', epoch: 0, guestId: 'u' + B.cloudUid }, B.cloudUid);
  emu.seedDoc('hansen_pk_rooms', { _id: 'rX_w0', proto: 2, kind: 'win', roomId: 'rX', i: 0, winner: 'guest', by: 'u' + B.cloudUid }, B.cloudUid);
  const t0 = Date.now();
  const r = await A.eval(async () => {
    const app = await window.HansenAuth._app();
    const db = app.database();
    const res = await db.collection('hansen_pk_rooms').where({ _id: db.command.in(['rX', 'rX_s0', 'rX_w0', 'rX_w1']) }).get();
    return { code: res.code || '', ids: (res.data || []).map((d) => d._id + ':' + d.kind).sort() };
  });
  const t = tally(emu, { uid: A.cloudUid, t0 });
  console.log(`[${mode}] 一次请求取回：${JSON.stringify(r)}；云端收到 ${t.total} 个请求（${Object.keys(t.by).join(', ')}）`);
  await A.close(); await B.close();
}
srv.close(); await browser.close();
