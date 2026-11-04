#!/usr/bin/env node
/* test_room_races_cloud_v1164.mjs —— 抢座、抢答、开房在「慢网 / 回包丢了 / 读不回来」时的结论（审查第一轮 F1/F13/TI-2/UI-4/SEC-7）
 *
 * 真页面、真账号模块、真房间模块、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答（不换任何模块、不调时间）。
 *
 *   ① 主从延迟 3.5 秒时三个人抢一个座位（审查 F1/TI-2）：抢输的两个以前被告知
 *      「云端设置还差一步 … 截图发给老师」（重复 _id 的 DATABASE_REQUEST_FAILED 被当成了设置问题）。
 *      现在：只有一个进去，另外两个是「被别人占了」，绝不是 config。
 *   ② 抢输之后紧接着的几次读都失败（弱 4G）：以前一次读失败就结束判定、报「云端设置还差一步」；
 *      现在接着读，结论还是「被占了」（或者如实说网不好），绝不是 config。
 *   ③ 回包丢了（写进去了、手机没收到）：进房 / 开房 / 抢答都要认出「那条其实是我的」——
 *      以前进房说 config、房主却把这个人确认进来开打；开房说 config、房其实开着挂在列表里；
 *      抢答说「超时了 0 分」，对手那边却给他记了 100。
 *   ④ 假如云端对重复 _id 不报错（悄悄吞掉 / 直接覆盖，审查 F13）：同一个词也只能有一个人「先拼对」。
 *   ⑤ 自己刚关掉的房不算「同账号别的设备开着房」（审查 UI-4）。
 *   ⑥ 私密房（审查 SEC-7）：只知道房号、不知道房间码进不去；改过的客户端直接写座位，房主也不放行。
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('抢座 / 抢答 / 开房：慢网和丢包下的结论 · 真 SDK 端到端（审查 F1/F13/TI-2/UI-4/SEC-7）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
let seq = 40;

async function phone(name, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, { name });
  live.push(p);
  const num = '137000000' + (seq++);
  p.number = num;
  const r = await H.loginPhone(p, num);
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.nick = nick; p.key = 'u' + r.uid;
  await p.eval((nm) => { try { window.HansenSbProfile.setName(nm); } catch (e) { /* 起过名了 */ } return true; }, nick);
  return p;
}
/* 审查 T8：每一段关手机之前都看一眼页面报错 / 外网 */
async function closeAll() { await H.cleanPhones(t, live); for (const p of live) await p.close(); live.length = 0; }
/* 列表里看得到这间房（读有延迟）—— 像界面一样一遍遍刷 */
async function seeRoom(p, rid, ms = 20000) {
  return H.until(async () => { const lr = await H.room(p, 'listRooms'); return lr && lr.ok && lr.rooms.some((x) => x._id === rid) ? lr : null; }, { timeout: ms, interval: 700 });
}
/* 一局已经开打的两个人（数据层直接走：开房 → 等人 → 进房） */
async function pairUp(mode) {
  const Hst = await phone('房主', '小蜂房主'), Gst = await phone('客人', '小蜂客人');
  const made = await H.room(Hst, 'createRoom', { mode });
  await H.roomWait(Hst, made.roomId);
  await seeRoom(Gst, made.roomId);
  const j = await H.room(Gst, 'joinRoom', made.roomId, {});
  const ev = await H.roomEvent(Hst, 30000);
  await H.room(Hst, 'markReady', made.roomId); await H.room(Gst, 'markReady', made.roomId);
  return { Hst, Gst, rid: made.roomId, made, j, ev };
}

try {
  /* ══ ① 主从延迟 3.5 秒：三人抢一个座位 ══════════════════════════ */
  for (const style of ['request_failed', 'http500']) {
    t.section(`① 主从延迟 3.5 秒 · 三人抢一个座位（重复 _id → ${style}）`);
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 60, jitterMs: 40, consistencyLagMs: 3500, duplicateStyle: style } });
    names = {};
    const A = await phone('房主', '小蜂房主');
    const G = [await phone('抢1', '小蜂抢一'), await phone('抢2', '小蜂抢二'), await phone('抢3', '小蜂抢三')];
    const made = await H.room(A, 'createRoom', { mode: 'C' });
    await t.ok(made && made.ok, `开房成功（${made && (made.roomId || made.reason)}）`);
    await H.roomWait(A, made.roomId);
    for (const g of G) await seeRoom(g, made.roomId, 25000);
    await Promise.all(G.map((g) => H.roomLaunch(g, 'j', 'joinRoom', made.roomId, {})));
    const rs = [];
    for (const g of G) rs.push(await H.roomResult(g, 'j', 60000));
    const oks = rs.filter((r) => r.r && r.r.ok);
    const losers = rs.filter((r) => r.r && !r.r.ok).map((r) => r.r);
    await t.ok(oks.length === 1, `只有一个人进去了（进去 ${oks.length} 个）`, () => explain(JSON.stringify(rs.map((r) => r.r && { ok: r.r.ok, kind: r.r.kind }))));
    await t.ok(losers.length === 2 && losers.every((r) => r.kind !== 'config' && !/云端设置/.test(r.reason || '')),
      `抢输的两个都不是「云端设置还差一步」（${losers.map((r) => r.kind + '：' + String(r.reason).slice(0, 40)).join(' / ')}）`, () => explain());
    await t.ok(losers.every((r) => r.kind === 'taken' || r.kind === 'network' || r.kind === 'slow'),
      `抢输的被告知「被占了」（或如实说网不好）：${losers.map((r) => r.kind).join(',')}`);
    const ev = await H.roomEvent(A, 30000);
    await t.ok(ev && ev.joined, `房主等到了进来的那个人（${ev && Object.keys(ev).join(',')}）`, () => explain());
    await H.sleep(1500);
    const seats = H.roomDocs(emu).filter((d) => d.kind === 'seat' && d.roomId === made.roomId);
    await t.ok(seats.length === 1, `库里只剩一个座位（${seats.length}）—— 结果待定时顺手删了自己可能写进去的那条`, () => explain());
    const dups = emu.log.filter((e) => e.action === 'database.addDocument' && (e.code === 'DATABASE_REQUEST_FAILED' || e.status === 500)).length;
    await t.ok(dups >= 2, `重复 _id 的那条路真的走到了（数据库拒绝重复 _id ${dups} 次）`);
    await H.cleanPhones(t, live);
    await closeAll();
  }

  /* ══ ② 抢输之后紧接着的读都失败（弱 4G）══════════════════════════ */
  t.section('② 抢输以后，紧接着的 3 次读都失败（审查 TI-2：一次读失败就判「云端设置还差一步」）');
  {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 60, jitterMs: 40, consistencyLagMs: 500 } });
    names = {};
    const A = await phone('房主', '小蜂房主');
    const G = [await phone('抢1', '小蜂抢一'), await phone('抢2', '小蜂抢二'), await phone('抢3', '小蜂抢三')];
    const made = await H.room(A, 'createRoom', { mode: 'C' });
    await H.roomWait(A, made.roomId);
    for (const g of G) await seeRoom(g, made.roomId);
    const after = {};
    emu.fault({ db: true, collection: 'hansen_pk_rooms', action: 'database.queryDocument', do: 'abort',
                test: (ctx) => emu.log.some((e) => e.uid === ctx.uid && e.dup) && (after[ctx.uid] = (after[ctx.uid] || 0) + 1) <= 3 });
    await Promise.all(G.map((g) => H.roomLaunch(g, 'j', 'joinRoom', made.roomId, {})));
    const rs = [];
    for (const g of G) rs.push(await H.roomResult(g, 'j', 60000));
    const oks = rs.filter((r) => r.r && r.r.ok), losers = rs.filter((r) => r.r && !r.r.ok).map((r) => r.r);
    await t.ok(oks.length === 1 && losers.length === 2, `一个进去、两个没进（${oks.length}/${losers.length}）`, () => explain());
    await t.ok(losers.every((r) => r.kind !== 'config'), `读失败也不说成「云端设置还差一步」（${losers.map((r) => r.kind).join(',')}）`, () => explain());
    await t.ok(Object.keys(after).length >= 1, `「抢输之后的读失败」真的发生了（${JSON.stringify(after)}）`);
    await closeAll();
  }

  /* ══ ③ 回包丢了：写进去了，手机没收到 ═════════════════════════════ */
  t.section('③ 回包丢了（审查 F1：进房 / 开房 / 抢答都要认出「那条其实是我的」）');
  {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 50, jitterMs: 30, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    /* 开房：add 写进去了、回包断了，**接着两次重试也都断了**（审查 T4：以前只断第一次 —— 传输层自动重试一下
       就撞上「重复 _id」，走的是重复那条路，「写进去了但每一次都失败」这条路从来没测到） */
    const addsBy = (uid) => emu.log.filter((e) => e.uid === uid && e.action === 'database.addDocument' && e.collection === 'hansen_pk_rooms').length;
    const nA0 = addsBy(A.cloudUid);
    const fc = emu.fault({ uid: A.cloudUid, db: true, collection: 'hansen_pk_rooms', action: 'database.addDocument', do: 'commitThenAbort', times: 1 });
    const fc2 = emu.fault({ uid: A.cloudUid, db: true, collection: 'hansen_pk_rooms', action: 'database.addDocument', do: 'abort', times: 2, test: () => fc.hits === 1 });
    const made = await H.room(A, 'createRoom', { mode: 'A' });
    const rooms = H.roomDocs(emu).filter((d) => d.kind === 'room' && d._openid === A.cloudUid);
    await t.ok(fc.hits === 1 && fc2.hits === 2 && addsBy(A.cloudUid) - nA0 === 3, `开房：三次 add 都到了云端、手机一次都没收到回包（${addsBy(A.cloudUid) - nA0} 次）`, () => explain());
    await t.ok(made && made.ok && rooms.length === 1 && rooms[0]._id === made.roomId,
      `开房回包全丢了 → 读回来认出是自己的，照样「开好了」，库里正好一间就是它（${made && (made.ok ? made.roomId : made.kind + ' ' + made.reason)}，${rooms.length} 间）`, () => explain());
    await H.roomWait(A, made.roomId);
    await seeRoom(B, made.roomId);
    /* 进房：座位写进去了、回包断了，接着两次重试的回包也断了，再接着 3 次读也失败 → 以前说 config、房主却把他确认进来了 */
    const nB0 = addsBy(B.cloudUid);
    const fs = emu.fault({ uid: B.cloudUid, db: true, collection: 'hansen_pk_rooms', action: 'database.addDocument', do: 'commitThenAbort', times: 1 });
    const fs2 = emu.fault({ uid: B.cloudUid, db: true, collection: 'hansen_pk_rooms', action: 'database.addDocument', do: 'abort', times: 2, test: () => fs.hits === 1 });
    let n = 0;
    emu.fault({ uid: B.cloudUid, db: true, collection: 'hansen_pk_rooms', action: 'database.queryDocument', do: 'abort', test: () => fs2.hits === 2 && (n++) < 3 });
    const j = await H.room(B, 'joinRoom', made.roomId, {});
    await t.ok(fs.hits === 1 && fs2.hits === 2 && addsBy(B.cloudUid) - nB0 === 3, `进房：占座的三次 add 都到了云端、一次回包都没收到（${addsBy(B.cloudUid) - nB0} 次）`, () => explain());
    const ev = await H.roomEvent(A, 30000);
    await t.ok(fs.hits === 1 && j && j.ok && ev && ev.joined && ev.room && ev.room.guestId === B.key,
      `进房回包丢了、接着读也失败 → 照样进去了，房主确认的也是他（${j && (j.ok ? 'ok' : j.kind + ' ' + j.reason)}）`, () => explain());
    await H.room(A, 'markReady', made.roomId); await H.room(B, 'markReady', made.roomId);
    /* 抢答：第 1 词的回合文档写进去了、回包断了，两次重试也断了，接着 3 次读也失败 */
    const nB1 = addsBy(B.cloudUid);
    const fw = emu.fault({ uid: B.cloudUid, db: true, collection: 'hansen_pk_rooms', action: 'database.addDocument', do: 'commitThenAbort', times: 1 });
    const fw2 = emu.fault({ uid: B.cloudUid, db: true, collection: 'hansen_pk_rooms', action: 'database.addDocument', do: 'abort', times: 2, test: () => fw.hits === 1 });
    let m = 0;
    emu.fault({ uid: B.cloudUid, db: true, collection: 'hansen_pk_rooms', action: 'database.queryDocument', do: 'abort', test: () => fw2.hits === 2 && (m++) < 3 });
    const c = await H.room(B, 'claimRound', made.roomId, 0);
    await t.ok(fw.hits === 1 && fw2.hits === 2 && addsBy(B.cloudUid) - nB1 === 3, `抢答：三次 add 都到了云端、一次回包都没收到（${addsBy(B.cloudUid) - nB1} 次）`, () => explain());
    const hs = await H.until(async () => { const r = await H.room(A, 'roundState', made.roomId); return r && r.ok && r.winners[0] ? r : null; }, { timeout: 15000 });
    const W0 = H.roomDocs(emu).find((d) => d.kind === 'win' && d.roomId === made.roomId && d.i === 0);
    const okScore = c && c.ok && (c.first === true || c.pending === true);
    await t.ok(fw.hits === 1 && okScore && W0 && W0._openid === B.cloudUid && hs && hs.winners[0] === 'guest',
      `抢答回包丢了 → 客人这边是「拿下了」（或「结果待定、之后补分」），不是「超时了 0 分」；房主那边也是客人赢（客人：${JSON.stringify(c && { ok: c.ok, first: c.first, pending: c.pending, kind: c.kind })}，房主看到 ${hs && hs.winners}）`, () => explain());
    if (c && c.pending) {
      const s2 = await H.room(B, 'settleRound', made.roomId, 0, 8000);
      await t.ok(s2 && s2.settled && s2.won && s2.score === 100, `结果待定的那一词补上了 100 分（${JSON.stringify(s2)}）`);
    }
    await H.cleanPhones(t, live);
    await closeAll();
  }

  /* ══ ④ 两个人同一时刻拼对同一个词 ═════════════════════════════════
     🔴审查 T2：以前这里测「云端对重复 _id 直接覆盖」—— 那是 MongoDB 的插入不会做的事（重复 _id 一定报错），
     而且只看 4 个词、只断言「没有两个都先」，十次里有一次假失败、「谁都不是先」的那种分歧从来不报。
     现在按真云端的几种回法（报重复 / 报重复的另一种码 / 回 HTTP 500 / 悄悄吞掉）各打 10 个词：
     每个词**正好一个**人先拼对，两部手机记下的赢家一模一样。 */
  for (const style of ['request_failed', 'duplicate_write', 'http500', 'silent']) {
    t.section(`④ 两人同时拼对同一个词 × 10（重复 _id → ${style}，主从延迟 400ms，审查 F13/T2）`);
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 400, duplicateStyle: style } });
    names = {};
    const { Hst, Gst, rid } = await pairUp('A');
    let both = 0, none = 0;
    const said = { host: [], guest: [] };
    for (let i = 0; i < 10; i++) {
      await Promise.all([H.roomLaunch(Hst, 'c' + i, 'claimRound', rid, i), H.roomLaunch(Gst, 'c' + i, 'claimRound', rid, i)]);
      const a = await H.roomResult(Hst, 'c' + i, 30000), b = await H.roomResult(Gst, 'c' + i, 30000);
      const fa = !!(a.r && a.r.first), fb = !!(b.r && b.r.first);
      if (fa && fb) both++;
      if (!fa && !fb) none++;
      said.host.push(fa ? 'host' : (fb ? 'guest' : '?'));
    }
    const wh = await H.until(async () => { const r = await H.room(Hst, 'roundState', rid); return r && r.ok && r.winners.filter(Boolean).length >= 10 ? r : null; }, { timeout: 15000 });
    const wg = await H.until(async () => { const r = await H.room(Gst, 'roundState', rid); return r && r.ok && r.winners.filter(Boolean).length >= 10 ? r : null; }, { timeout: 15000 });
    await t.ok(both === 0 && none === 0, `10 个词每个都正好一个人「先拼对」（两个都先：${both}，都不是：${none}）`, () => explain());
    await t.ok(wh && wg && wh.winners.join(',') === wg.winners.join(',') && wh.winners.join(',') === said.host.join(','),
      `两部手机记下的赢家一模一样，也和当场说的一样（房主：${wh && wh.winners}；客人：${wg && wg.winners}；当场：${said.host}）`, () => explain());
    await closeAll();
  }

  /* ══ ⑤ 自己刚关掉的房 ═══════════════════════════════════════════ */
  t.section('⑤ 自己刚关掉的房不算「同账号别的设备开着房」（主从延迟 1.5 秒，审查 UI-4）');
  {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, consistencyLagMs: 1500 } });
    names = {};
    const A = await phone('甲', '小蜂甲');
    const made = await H.room(A, 'createRoom', { mode: 'C' });
    await H.sleep(1800);
    await H.room(A, 'leaveRoom', made.roomId);
    const lr = await H.room(A, 'listRooms');
    await t.ok(lr && lr.ok && lr.sameAccount === 0, `刚关的房还读得到（删除在路上），但不说「同一个账号在另一台设备上开着房」（sameAccount=${lr && lr.sameAccount}）`, () => explain());
    await closeAll();
  }

  /* ══ ⑥ 私密房 ══════════════════════════════════════════════════ */
  t.section('⑥ 私密房：没有房间码进不去（审查 SEC-7）');
  {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, consistencyLagMs: 200 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), X = await phone('陌生人', '小蜂陌生'), F = await phone('朋友', '小蜂朋友');
    const made = await H.room(A, 'createRoom', { mode: 'C', private: true });
    const code = made && made.room && made.room.code;
    const R = H.roomDocs(emu).find((d) => d._id === made.roomId);
    await t.ok(/^[0-9A-Z]{4}$/.test(code || '') && R && !('code' in R) && R.codeH && !JSON.stringify(R).includes('"' + code + '"'),
      `房间码只在房主手机上（库里只存一个摘要，读整个集合也看不到「${code}」）`, () => explain());
    await H.roomWait(A, made.roomId);
    await H.sleep(500);
    const noCode = await H.room(X, 'joinRoom', made.roomId, {});
    await t.ok(noCode && !noCode.ok && /私密房/.test(noCode.reason || ''), `只知道房号、不知道码 → 进不去（${noCode && noCode.reason}）`, () => explain());
    /* 改过的客户端：绕过 joinRoom，直接往库里写一个座位 */
    await X.eval(async ([rid, key]) => {
      const app = await window.HansenAuth._app(); const db = app.database();
      await db.collection('hansen_pk_rooms').add({ _id: rid + '_s0', proto: 2, kind: 'seat', roomId: rid, epoch: 0, guestId: key, guestName: '捣乱的', guestBeat: Date.now(), createdAt: Date.now(), left: false });
      return true;
    }, [made.roomId, X.key]);
    await H.sleep(6000);
    const R1 = H.roomDocs(emu).find((d) => d._id === made.roomId);
    await t.ok(R1 && !R1.guestId && R1.status === 'open' && R1.seat > 0, `直接写座位的人房主不放行，换了座位号接着等（status=${R1 && R1.status} guest=${R1 && R1.guestId || '空'} seat=${R1 && R1.seat}）`, () => explain());
    const f = await H.room(F, 'findByCode', code);
    const j = (f && f.ok) ? await H.room(F, 'joinRoom', f.roomId, { code }) : f;
    const ev = await H.roomEvent(A, 25000);
    await t.ok(j && j.ok && ev && ev.joined && ev.room.guestId === F.key, `输对房间码的朋友照常进来（${j && (j.ok ? 'ok' : j.reason)}）`, () => explain());
    await closeAll();
  }
} catch (e) {
  await t.ok(false, '测试脚本自己出错：' + String(e && e.stack || e).slice(0, 600), () => explain());
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
