#!/usr/bin/env node
/* test_room_protocol_r2_cloud_v1164.mjs —— 房间协议第二轮审查（F-R2-1~7、T6、R2-UI-7、安全 R2-1）
 *
 * 真页面、真账号模块、真房间模块、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答（不换模块、不调时间）。
 * 「陌生人」= 另一个登录了的孩子（改过前端），用页面自己的 SDK 实例往集合里写东西 ——「读取全部、修改本人」下谁都能新建文档。
 *
 *   ① 回合赛：房主先交卷、走了（房标成「打完了」），客人还在自己的最后一词里 —— 他拼对的照样算（F-R2-1/FX-5）
 *   ② 读有延迟：点了取消马上再进同一间房 / 上一个孩子刚走、下一个马上坐上同一个座位 —— 都进得去（F-R2-2）
 *   ③ 开房那一下云端回了一次「这一次没办成」（DATABASE_REQUEST_FAILED）：不许说「开好了」其实没有房（F-R2-3）
 *   ④ 陌生人往座位号上塞一条随便什么东西：房主换号，真客人照样进得来（F-R2-4）
 *   ⑤ 一个账号塞 100 间「建于未来」的假房：真房照样列得出来，天梯两个房主照样收到一起（F-R2-5）
 *   ⑥ 陌生人往回合号上塞空文档：第一个拼对的照样「先拼对」100 分（F-R2-6）
 *   ⑦ 陌生人把一词的三个回合号全占了：两个孩子拼对都照样得分，不说「网络不稳」（F-R2-7 / 安全 R2-1）
 *   ⑧ 重复 _id 的报错长得像「权限不对」：抢座输了的是「被占了」，不是「云端设置还差一步」（T6）
 *   ⑨ 数据库不认令牌（SDK 自己还觉得没过期）：能换新令牌就换了接着用；换不到 → 本机「已登录」清掉，「重新登录」出登录表单（R2-UI-7）
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('房间协议第二轮（F-R2-1~7 / T6 / R2-UI-7）· 真 SDK 端到端');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
let seq = 10;

async function phone(name, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, { name });
  live.push(p);
  const r = await H.loginPhone(p, '135000000' + (seq++));
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.nick = nick; p.key = 'u' + r.uid;
  await p.eval((nm) => { try { window.HansenSbProfile.setName(nm); } catch (e) { /* 起过名了 */ } return true; }, nick);
  return p;
}
async function closeAll() { await H.cleanPhones(t, live); for (const p of live) await p.close(); live.length = 0; }
async function seeRoom(p, rid, ms = 20000) {
  return H.until(async () => { const lr = await H.room(p, 'listRooms'); return lr && lr.ok && lr.rooms.some((x) => x._id === rid) ? lr : null; }, { timeout: ms, interval: 700 });
}
/* 陌生人直接用页面自己的 SDK 往集合里写 —— 「读取全部、修改本人」下谁都能新建 */
async function addAs(p, d) {
  return p.eval(async (d) => {
    const app = await window.HansenAuth._app();
    const r = await app.database().collection('hansen_pk_rooms').add(d);
    return r && (r.code ? { code: r.code } : { id: r.id || r._id });
  }, d);
}
async function pairUp(Hst, Gst, opts) {
  const made = await H.room(Hst, 'createRoom', opts);
  await H.roomWait(Hst, made.roomId);
  await seeRoom(Gst, made.roomId);
  const j = await H.room(Gst, 'joinRoom', made.roomId, {});
  const ev = await H.roomEvent(Hst, 40000);
  await H.room(Hst, 'markReady', made.roomId); await H.room(Gst, 'markReady', made.roomId);
  return { rid: made.roomId, made, j, ev };
}
const docOf = (id) => H.roomDocs(emu).find((d) => d._id === id) || null;
async function section(name, fn) {
  t.section(name);
  try { await fn(); }
  catch (e) { await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 500), () => explain()); }
  for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
  live.length = 0;
}

await section('① 回合赛：房主交了卷、走了，客人最后一词拼对照样算分（F-R2-1/FX-5）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 20, consistencyLagMs: 200 } });
  names = {};
  const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
  const { rid, j } = await pairUp(A, B, { mode: 'B', wordCount: 3 });
  await t.ok(j && j.ok, '开打了', () => explain());
  /* 第 1、2 词房主先拼对（客人后拼对 80），第 3 词房主超时；房主交卷 200 分、点了退出 */
  for (const i of [0, 1]) {
    const a = await H.room(A, 'claimRound', rid, i);
    await H.sleep(300);
    const b = await H.room(B, 'claimRound', rid, i);
    await t.ok(a && a.first && b && b.ok && !b.first && b.score === 80, `第 ${i + 1} 词：房主先拼对、客人后拼对 80（房主 ${a && a.score}，客人 ${b && b.score}）`, () => explain());
  }
  await H.room(A, 'skipRound', rid, 2);
  const ra = await H.room(A, 'reportResult', rid, 200);
  await t.ok(ra && ra.ok, `房主交卷 200（${ra && (ra.waiting ? '等对手' : ra.result)}）`, () => explain());
  await H.room(A, 'leaveRoom', rid);
  await H.sleep(1500);
  const R = docOf(rid);
  await t.ok(R && R.status === 'done' && R.endedBy === 'finished', `房主走了：房间标成「打完了」（${R && R.status}/${R && R.endedBy}）`, () => explain());
  /* 客人还在自己的第 3 词里：拼对了 */
  await H.room(B, 'roundState', rid);
  const c = await H.room(B, 'claimRound', rid, 2);
  await t.ok(c && c.ok && c.first && c.score === 100, `客人第 3 词拼对：照样「先拼对」100 分（${JSON.stringify(c && { ok: c.ok, first: c.first, score: c.score, reason: c.reason })}）—— 以前「这一局已经结束了」0 分`, () => explain());
  const rb = await H.room(B, 'reportResult', rid, 260);
  await t.ok(rb && rb.ok && rb.result === 'win' && rb.mine === 260 && rb.theirs === 200, `按两边真实的分判：客人 260 : 200 赢（${JSON.stringify(rb)}）—— 以前算成 160 : 200 输`, () => explain());
  await closeAll();
});

await section('② 读有延迟：取消了马上再进同一间房 / 上一个孩子刚走、下一个马上坐上同一个座位（F-R2-2）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 20, consistencyLagMs: 300 } });
  names = {};
  const A = await phone('房主', '小蜂房主'), G = await phone('客人', '小蜂客人');
  let made = await H.room(A, 'createRoom', { mode: 'C' });
  await H.roomWait(A, made.roomId);
  await seeRoom(G, made.roomId);
  /* (a) 点「进去打」→ 半秒后「取消」→ 马上再点同一间 */
  await H.roomLaunch(G, 'j1', 'joinRoom', made.roomId, {});
  await H.sleep(500);
  await H.room(G, 'leaveRoom', made.roomId);
  const j2 = await H.room(G, 'joinRoom', made.roomId, {});
  const j1 = await H.roomResult(G, 'j1', 40000);
  const ev = await H.roomEvent(A, 30000);
  await t.ok(j1.r && !j1.r.ok && j1.r.cancelled, `取消掉的那一次：「已经退出这间房了」（${j1.r && j1.r.reason}）`, () => explain());
  await t.ok(j2 && j2.ok && ev && ev.joined && ev.room.guestId === G.key, `马上再点：进去了，房主确认的就是他（${j2 && (j2.ok ? 'ok' : j2.kind + ' ' + j2.reason)}）—— 以前「这间房刚被别人占了」`, () => explain());
  const seats = H.roomDocs(emu).filter((d) => d.kind === 'seat' && d.roomId === made.roomId);
  await t.ok(seats.length === 1 && !seats[0].left, `库里只有一个座位、没被取消掉的那一次标成「走了」（${seats.map((d) => d._id + (d.left ? '(left)' : '')).join(',')}）`, () => explain());
  await closeAll();

  /* (b) 主从延迟 3 秒：客人一占了座位又走了，客人二 1 秒后点同一间 */
  emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 20, consistencyLagMs: 3000 } });
  names = {};
  const A2 = await phone('房主', '小蜂房主'), G1 = await phone('客人一', '小蜂一'), G2 = await phone('客人二', '小蜂二');
  made = await H.room(A2, 'createRoom', { mode: 'C' });
  await H.roomWait(A2, made.roomId);
  await seeRoom(G1, made.roomId, 25000); await seeRoom(G2, made.roomId, 25000);
  await H.roomLaunch(G1, 'g1', 'joinRoom', made.roomId, {});
  await H.until(async () => H.roomDocs(emu).some((d) => d.kind === 'seat' && d.roomId === made.roomId && d._openid === G1.cloudUid), { timeout: 20000, interval: 150 });
  await H.room(G1, 'leaveRoom', made.roomId);
  await H.until(async () => !H.roomDocs(emu).some((d) => d.kind === 'seat' && d.roomId === made.roomId), { timeout: 10000, interval: 100 });
  await H.sleep(1100);
  const jb = await H.room(G2, 'joinRoom', made.roomId, {});
  const evb = await H.roomEvent(A2, 45000);
  await t.ok(jb && jb.ok && evb && evb.joined && evb.room.guestId === G2.key,
    `客人二进去了，房主确认的是他（${jb && (jb.ok ? 'ok' : jb.kind + ' ' + jb.reason)}；房主：${evb && Object.keys(evb).join(',')}）—— 以前读到客人一刚删掉的旧座位，说「被别人占了」`, () => explain());
  await closeAll();
});

await section('③ 开房那一下云端回了「这一次没办成」（F-R2-3）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, consistencyLagMs: 300 } });
  names = {};
  const A = await phone('房主', '小蜂房主'), G = await phone('别人', '小蜂别人');
  const f1 = emu.fault({ uid: A.cloudUid, db: true, collection: 'hansen_pk_rooms', action: 'database.addDocument', do: 'code', code: 'DATABASE_REQUEST_FAILED', message: 'write concern timeout (emulated)', times: 1 });
  const m1 = await H.room(A, 'createRoom', { mode: 'C' });
  await t.ok(f1.hits === 1 && m1 && m1.ok && !!docOf(m1.roomId), `一次没办成 → 再写一次：开好了、库里真有这间房（${m1 && (m1.ok ? m1.roomId : m1.reason)}；库里 ${m1 && m1.roomId && docOf(m1.roomId) ? '有' : '没有'}）`, () => explain());
  if (m1 && m1.ok) {
    const seen = await seeRoom(G, m1.roomId);
    await t.ok(!!seen, '别人列得到这间房', () => explain());
    await H.room(A, 'leaveRoom', m1.roomId);
  }
  const f2 = emu.fault({ uid: A.cloudUid, db: true, collection: 'hansen_pk_rooms', action: 'database.addDocument', do: 'code', code: 'DATABASE_REQUEST_FAILED', message: 'write concern timeout (emulated)', times: 2 });
  const m2 = await H.room(A, 'createRoom', { mode: 'C' });
  const mine = H.roomDocs(emu).filter((d) => d.kind === 'room' && d._openid === A.cloudUid && d.status === 'open');
  await t.ok(f2.hits === 2 && m2 && !m2.ok && m2.kind !== 'config' && /再点一次开房/.test(m2.reason || '') && !mine.length,
    `两次都没办成 → 如实说「房没开成，再点一次开房」，不说开好了、也不说云端设置不对（${m2 && (m2.ok ? '说开好了！' : m2.kind + '：' + String(m2.reason).slice(0, 60))}；库里开着的 ${mine.length} 间）`, () => explain());
  await closeAll();
});

await section('④ 陌生人往座位号上塞了一条随便什么东西（F-R2-4）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 20, consistencyLagMs: 300 } });
  names = {};
  const A = await phone('房主', '小蜂房主'), G = await phone('客人', '小蜂客人'), M = await phone('陌生人', '小蜂捣乱');
  const made = await H.room(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await seeRoom(M, made.roomId);
  const w = await addAs(M, { _id: made.roomId + '_s0', note: 'x' });
  await t.ok(w && w.id, `陌生人塞进去了一条 ${made.roomId}_s0（${JSON.stringify(w)}）`, () => explain());
  await H.roomWait(A, made.roomId, { ms: 90000 });
  await seeRoom(G, made.roomId);
  let j = null;
  for (let k = 0; k < 3 && !(j && j.ok); k++) { j = await H.room(G, 'joinRoom', made.roomId, {}); if (!(j && j.ok)) await H.sleep(2500); }
  const ev = await H.roomEvent(A, 30000);
  const R = docOf(made.roomId);
  await t.ok(j && j.ok && ev && ev.joined && ev.room.guestId === G.key && R && R.seat > 0,
    `房主换了座位号（seat=${R && R.seat}），真客人进来了（${j && (j.ok ? 'ok' : j.kind + ' ' + j.reason)}）—— 以前人人都被告知「被别人占了」、房主等到超时`, () => explain());
  await closeAll();
});

await section('⑤ 一个账号塞 100 间「建于未来」的假房（F-R2-5）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 20, consistencyLagMs: 200 } });
  names = {};
  const A = await phone('房主', '小蜂房主'), A2 = await phone('房主二', '小蜂房主二'), G = await phone('客人', '小蜂客人'), M = await phone('陌生人', '小蜂捣乱');
  const made = await H.room(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await H.roomWait(A, made.roomId, { ms: 120000 });
  await seeRoom(G, made.roomId);
  /* 一半「建于 9e15 年」，一半「建于 29 分钟以后」（窗口里面）—— 心跳都写在 25 分钟以后 */
  const n = await M.eval(async () => {
    const app = await window.HansenAuth._app(); const c = app.database().collection('hansen_pk_rooms');
    const now = Date.now(); let ok = 0;
    await Promise.all(Array.from({ length: 100 }, (_, i) => c.add({ _id: 'rfake' + i + now.toString(36), proto: 2, kind: 'room', status: 'open', isPrivate: false,
      mode: 'A', hostId: 'ufake' + i, hostName: '假房' + i, hostRating: 1000, guestId: '', seat: 0,
      createdAt: i % 2 ? 9e15 : now + 29 * 60000, heartbeatAt: now + 25 * 60000, hostBeat: now + 25 * 60000 }).then((r) => { if (r && !r.code) ok++; })));
    return ok;
  });
  await t.ok(n === 100, `陌生人一个账号塞了 ${n} 间假房`, () => explain());
  await H.sleep(800);
  const lr = await H.room(G, 'listRooms');
  await t.ok(lr && lr.ok && lr.rooms.some((x) => x._id === made.roomId) && !lr.rooms.some((x) => /^rfake/.test(x._id)),
    `客人照样看得到真房、假房一间都不显示（${lr && lr.ok ? lr.rooms.map((x) => x._id).join(',') : lr && lr.reason}）—— 以前真房被挤出名额，一间都列不出来`, () => explain());
  /* 天梯：后开的排位房要收到「去那间先开的房」 */
  const made2 = await H.room(A2, 'createRoom', { mode: 'A', hostRating: 1000 });
  await H.roomWait(A2, made2.roomId, { ms: 60000, ladder: { rating: 1000, band: 400 } });
  const ev2 = await H.roomEvent(A2, 30000);
  await t.ok(ev2 && ev2.switchTo === made.roomId, `后开的那个排位房主收到了「去先开的那间」（${ev2 && JSON.stringify({ switchTo: ev2.switchTo, timeout: ev2.timeout })}）`, () => explain());
  await closeAll();
});

await section('⑥ 陌生人往回合号上塞空文档（F-R2-6）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 20, consistencyLagMs: 300 } });
  names = {};
  const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人'), M = await phone('陌生人', '小蜂捣乱');
  const made = await H.room(A, 'createRoom', { mode: 'A', hostRating: 1000, wordCount: 3 });
  await seeRoom(M, made.roomId);
  for (let i = 0; i < 3; i++) await addAs(M, { _id: made.roomId + '_w' + i });
  await H.roomWait(A, made.roomId);
  await seeRoom(B, made.roomId);
  await H.room(B, 'joinRoom', made.roomId, {});
  await H.roomEvent(A, 30000);
  await H.room(A, 'markReady', made.roomId); await H.room(B, 'markReady', made.roomId);
  await H.sleep(600);
  const c0 = await H.room(A, 'claimRound', made.roomId, 0);
  const g0 = await H.room(B, 'claimRound', made.roomId, 0);
  await t.ok(c0 && c0.ok && c0.first === true && c0.score === 100 && !c0.pending, `第一个拼对的照样「先拼对」100 分（${JSON.stringify(c0 && { first: c0.first, score: c0.score, pending: c0.pending })}）—— 以前 0 分「分数马上补上」又永远补不上`, () => explain());
  await t.ok(g0 && g0.ok && g0.first === false, `后拼对的是「对手先拼对了」（${JSON.stringify(g0 && { first: g0.first, score: g0.score })}）`, () => explain());
  const sh = await H.until(async () => { const r = await H.room(B, 'roundState', made.roomId); return r && r.ok && r.winners[0] ? r : null; }, { timeout: 10000 });
  await t.ok(sh && sh.winners[0] === 'host', `客人那边也记的是房主赢了第 1 词（${sh && sh.winners}）`, () => explain());
  await closeAll();
});

await section('⑦ 陌生人把一词的三个回合号全占了（F-R2-7 / 安全 R2-1）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 20, consistencyLagMs: 300 } });
  names = {};
  const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人'), M = await phone('陌生人', '小蜂捣乱');
  const made = await H.room(A, 'createRoom', { mode: 'A', hostRating: 1000, wordCount: 3 });
  await seeRoom(M, made.roomId);
  for (const k of ['', 'b', 'c']) await addAs(M, { _id: made.roomId + '_w0' + k, proto: 2, kind: 'win', roomId: made.roomId, ep: 0, i: 0, winner: 'host', by: A.key, at: Date.now() });
  await H.roomWait(A, made.roomId);
  await seeRoom(B, made.roomId);
  await H.room(B, 'joinRoom', made.roomId, {});
  await H.roomEvent(A, 30000);
  await H.room(A, 'markReady', made.roomId); await H.room(B, 'markReady', made.roomId);
  await H.sleep(600);
  const g0 = await H.room(B, 'claimRound', made.roomId, 0);
  const a0 = await H.room(A, 'claimRound', made.roomId, 0);
  await t.ok(g0 && g0.ok && g0.score === 100 && !/网络/.test(g0.reason || ''), `客人拼对了：照样 100 分（${JSON.stringify(g0 && { ok: g0.ok, score: g0.score, squatted: g0.squatted, reason: g0.reason })}）—— 以前「这一词没记上」0 分`, () => explain());
  await t.ok(a0 && a0.ok && a0.score === 100, `房主拼对了也是 100 分（${JSON.stringify(a0 && { ok: a0.ok, score: a0.score })}）`, () => explain());
  const st = await H.until(async () => { const r = await H.room(A, 'roundState', made.roomId); return r && r.ok && r.oppPts >= 100 ? r : null; }, { timeout: 12000 });
  await t.ok(st && st.oppPts >= 100 && st.oppAns >= 0, `房主那边看得到客人这一词的 100 分（oppPts=${st && st.oppPts}，oppAns=${st && st.oppAns}）`, () => explain());
  const valid = H.roomDocs(emu).filter((d) => d.kind === 'win' && d.roomId === made.roomId && d._openid !== M.cloudUid);
  await t.ok(!valid.length, `陌生人的三条一条都不算（这局两个人没建回合文档：${valid.length}）`, () => explain());
  await closeAll();
});

await section('⑧ 重复 _id 的报错长得像「权限不对」：抢座输了的是「被占了」（T6）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 60, jitterMs: 40, consistencyLagMs: 1000, duplicateStyle: 'code', duplicateCode: 'DATABASE_PERMISSION_DENIED' } });
  names = {};
  const A = await phone('房主', '小蜂房主');
  const G = [await phone('抢1', '小蜂抢一'), await phone('抢2', '小蜂抢二'), await phone('抢3', '小蜂抢三')];
  const made = await H.room(A, 'createRoom', { mode: 'C' });
  await H.roomWait(A, made.roomId);
  for (const g of G) await seeRoom(g, made.roomId, 25000);
  await Promise.all(G.map((g) => H.roomLaunch(g, 'j', 'joinRoom', made.roomId, {})));
  const rs = [];
  for (const g of G) rs.push((await H.roomResult(g, 'j', 60000)).r);
  const oks = rs.filter((r) => r && r.ok), losers = rs.filter((r) => r && !r.ok);
  await t.ok(oks.length === 1 && losers.length === 2, `一个进去、两个没进（${oks.length}/${losers.length}）`, () => explain(JSON.stringify(rs.map((r) => r && { ok: r.ok, kind: r.kind }))));
  await t.ok(losers.every((r) => r.kind === 'taken' && !/云端设置/.test(r.reason || '')), `抢输的都是「被别人占了」，没有一个是「云端设置还差一步」（${losers.map((r) => r.kind + '：' + String(r.reason).slice(0, 30)).join(' / ')}）`, () => explain());
  await closeAll();
});

await section('⑨ 数据库不认令牌、SDK 还觉得没过期（R2-UI-7）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 30 } });
  names = {};
  const G = await phone('孩子', '小蜂孩子');
  const ok0 = await H.room(G, 'listRooms');
  await t.ok(ok0 && ok0.ok, '先正常列一次房', () => explain());
  /* (a) 云端把这张 access_token 作废了，refresh_token 还能用 → 换一张接着用 */
  emu.expireAccessTokens(G.cloudUid);
  const a = await H.room(G, 'listRooms');
  await t.ok(a && a.ok, `令牌被云端作废：自己换了新令牌、接着列房（${a && (a.ok ? 'ok' : a.kind + ' ' + a.reason)}）—— 以前直接「云端登录过期了」`, () => explain());
  const refreshed = emu.log.some((x) => x.uid === G.cloudUid && /\/auth\/v1\/token/.test(x.path) && x.status === 200);
  await t.ok(refreshed, '真的去换了一次令牌（/auth/v1/token 回了 200）', () => explain());
  /* (b) 另一个孩子：会话被云端整个撤了（refresh_token 也作废）→ 换不到 → 清掉本机「已登录」，「重新登录」出登录表单
     （登录已经超过 1 分钟 —— 刚登录 60 秒内账号模块照规矩不清本机记录） */
  const K = await phone('另一个孩子', '小蜂另一个');
  await H.room(K, 'listRooms');
  await K.eval(() => { const k = 'hansen_auth_v1004'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.signedAt = Date.now() - 120000; localStorage.setItem(k, JSON.stringify(o)); return true; });
  emu.revokeSessions(K.cloudUid);
  const b = await H.room(K, 'listRooms');
  const signed = await K.eval(() => window.HansenAuth.isSignedIn());
  await t.ok(b && !b.ok && b.kind === 'expired' && signed === false, `换不到新令牌：说「登录过期」，本机「已登录」也清掉了（${b && b.kind}；isSignedIn=${signed}）`, () => explain());
  await K.eval(() => { window.HansenAuthUI.open({ relogin: true }); return true; });
  const form = await K.hitTest('#auPhone', { timeout: 5000 });
  await t.ok(form.ok, `「重新登录」打开的是登录表单（手机号输入框点得到：${form.ok ? '是' : form.why}）`, () => explain());
  await closeAll();
});

t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
