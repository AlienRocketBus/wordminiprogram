#!/usr/bin/env node
/* test_room_endings_cloud_v1164.mjs —— 一局怎么结束：判离场、房主走掉、两边一起断网、被撤回的客人、读到旧快照
 *（审查第一轮 F2/F3/F4/F11/F12）
 *
 * 真页面、真账号模块、真房间模块、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答（产品真实时长：离场判定 60 秒）。
 *
 *   ① 判了离场之后回来的那一方（审查 F2）：以前回来接着打、一词一个「+100」，最后才说「判给了对手」。
 *      现在：opponentGone 先报「已经判了」，抢答不再受理，交卷也是同一个结论（两个方向都验）。
 *   ② 房主在「写了确认、还没等到客人回话」时关房（审查 F3）：以前直接删房，客人一整局「网络不稳」、
 *      最后「结果没拿到」。现在房间标「done / 房主走了」，客人几秒内就知道。
 *      房间被清掉（判完离场过了宽限期）后才回来的客人：说清楚「这一局已经结束了」，抢答不受理，不算赢。
 *   ③ 两边一起断网 70 秒（审查 F4）：以前恢复后两边都判对方离场、各记一场胜。现在谁都不判。
 *   ④ 被房主撤回的客人（审查 F11）：不判「对手已离场，本局你胜」；他留下的回合文档也碰不到房主和新客人的那一局。
 *   ⑤ 已经看到「判离场」之后又读到旧快照（审查 F12）：结论不能倒回去变成 500:1「赢了」。
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('一局怎么结束 · 真 SDK 端到端（审查 F2/F3/F4/F11/F12）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
let seq = 60;

async function phone(name, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, { name });
  live.push(p);
  const num = '136000000' + (seq++);
  const r = await H.loginPhone(p, num);
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.nick = nick; p.key = 'u' + r.uid;
  await p.eval((nm) => { try { window.HansenSbProfile.setName(nm); } catch (e) { /* 起过名了 */ } return true; }, nick);
  return p;
}
async function closeAll() { for (const p of live) await p.close(); live.length = 0; }
async function seeRoom(p, rid, ms = 20000) {
  return H.until(async () => { const lr = await H.room(p, 'listRooms'); return lr && lr.ok && lr.rooms.some((x) => x._id === rid) ? lr : null; }, { timeout: ms, interval: 700 });
}
async function pairUp(Hst, Gst, mode = 'A') {
  const made = await H.room(Hst, 'createRoom', { mode });
  await H.roomWait(Hst, made.roomId);
  await seeRoom(Gst, made.roomId);
  const j = await H.room(Gst, 'joinRoom', made.roomId, {});
  const ev = await H.roomEvent(Hst, 30000);
  await H.room(Hst, 'markReady', made.roomId); await H.room(Gst, 'markReady', made.roomId);
  await t.ok(j && j.ok && ev && ev.joined, `开打了（客人 ${j && (j.ok ? 'ok' : j.reason)}，房主 ${ev && Object.keys(ev).join(',')}）`, () => explain());
  return made.roomId;
}
/* 像对战屏那样在页面里一直轮询（每秒 roundState、每 4 秒 opponentGone），结果记下来 */
async function startPolling(p, rid) {
  return p.eval((rid) => {
    window.__og = []; window.__rs = 0;
    window.__pollRS = setInterval(() => { window.HansenPkRoom.roundState(rid).then((r) => { window.__rs++; }); }, 1000);
    window.__pollOG = setInterval(() => {
      window.HansenPkRoom.opponentGone(rid).then((g) => { window.__og.push(Object.assign({ at: Date.now() }, g)); });
    }, 4000);
    return true;
  }, rid);
}
async function stopPolling(p) { return p.eval(() => { clearInterval(window.__pollRS); clearInterval(window.__pollOG); return (window.__og || []).slice(); }); }

try {
  /* ══ ① 判了离场，回来的那一方 ═══════════════════════════════════ */
  for (const who of ['host', 'guest']) {
    t.section(`① ${who === 'host' ? '房主' : '客人'}判了对手离场，对手回来以后（审查 F2）`);
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 50, jitterMs: 40, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    const rid = await pairUp(A, B, 'A');
    const judge = who === 'host' ? A : B, back = who === 'host' ? B : A;
    const w = await H.room(judge, 'claimAbandonWin', rid);
    await t.ok(w && w.ok && w.result === 'win', `判离场的一方：本局胜（${JSON.stringify(w)}）`, () => explain());
    await H.sleep(800);
    const g = await H.until(async () => { const x = await H.room(back, 'opponentGone', rid); return x && x.ended ? x : null; }, { timeout: 10000, interval: 1000 });
    await t.ok(g && g.ended && g.endedBy === 'abandon' && g.abandonWin === who && !g.oppFinished,
      `回来的一方一查就知道「这局已经判了」（${JSON.stringify(g)}）—— 以前报的是「对手打完了」，接着打`, () => explain());
    const c = await H.room(back, 'claimRound', rid, 0);
    await t.ok(c && c.ok === false && c.ended, `判完以后抢答不再受理（${c && (c.ok ? 'ok first=' + c.first : c.reason)}）`, () => explain());
    const rr = await H.room(back, 'reportResult', rid, 600);
    await t.ok(rr && rr.ok && rr.result === 'lose' && rr.byAbandon, `交卷也是同一个结论：判给了对手（${JSON.stringify(rr)}）`, () => explain());
    await closeAll();
  }

  /* ══ ② 房主在等客人回话时关房 / 房间被清掉 ════════════════════════ */
  t.section('② 房主在「写了确认、还没等到回话」时关掉房间（审查 F3）');
  {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 50, jitterMs: 40, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    const made = await H.room(A, 'createRoom', { mode: 'C' });
    await H.roomWait(A, made.roomId);
    await seeRoom(B, made.roomId);
    /* 客人的「回话」（座位上的 acked）卡在路上 —— 房主这边一直等不到 */
    const hold = emu.hold({ uid: B.cloudUid, db: true, action: 'database.updateDocument' });
    const j = await H.room(B, 'joinRoom', made.roomId, {});
    await t.ok(j && j.ok, `客人看到了确认，进了对战（${j && (j.ok ? 'ok' : j.reason)}）`, () => explain());
    const R0 = H.roomDocs(emu).find((d) => d._id === made.roomId);
    await t.ok(R0 && R0.guestId === B.key && R0.status === 'playing', '房主写了确认（还在等客人回话）', () => explain());
    await H.room(A, 'leaveRoom', made.roomId);
    await H.sleep(800);
    const R1 = H.roomDocs(emu).find((d) => d._id === made.roomId);
    await t.ok(R1 && R1.status === 'done' && R1.endedBy === 'leave', `房主关房：房间没删，标成「done / 房主走了」（${R1 ? R1.status + '/' + R1.endedBy : '被删了'}）`, () => explain());
    hold.release();
    const g = await H.until(async () => { const x = await H.room(B, 'opponentGone', made.roomId); return x && x.ok && x.gone ? x : null; }, { timeout: 12000, interval: 1000 });
    await t.ok(g && g.left, `客人几秒内就知道房主走了（${JSON.stringify(g)}）—— 以前一整局「网络不稳」`, () => explain());
    await closeAll();
  }
  t.section('② 判完离场、房间已经被清掉了才回来的客人（审查 F3）');
  {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 50, jitterMs: 40, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    const rid = await pairUp(A, B, 'A');
    await H.room(B, 'roundState', rid);
    /* 房间在服务端被删掉（就是过了宽限期的那次清理）—— 直接在模拟云端里删 */
    emu.cols.get('hansen_pk_rooms').docs.get(rid).push({ at: Date.now(), doc: null });
    /* 像对战屏那样轮询（每秒 roundState、每 4 秒 opponentGone）—— 连续 3 次读不到房间才算没了，不是一次读空就下结论 */
    const tGone = Date.now();
    await startPolling(B, rid);
    const g = await H.until(async () => {
      const og = await B.eval(() => (window.__og || []).slice());
      return og.find((x) => x && x.roomGone) || null;
    }, { timeout: 20000, interval: 1000 }).catch(() => null);
    const ogAll = await stopPolling(B);
    await t.ok(g && g.ok && g.gone && g.roomGone && g.left, `房间没了 → 客人这边几秒内就说「房主那边已经收了」（${Math.round(((g && g.at) || Date.now()) - tGone) / 1000} 秒；${JSON.stringify(g || ogAll.slice(-2))}）—— 以前一直「网络不稳」`, () => explain());
    const c = await H.room(B, 'claimRound', rid, 1);
    await t.ok(c && c.ok === false, `房间没了，抢答不再受理（${c && (c.ok ? 'ok' : c.reason)}）`, () => explain());
    await closeAll();
  }

  /* ══ ③ 两边一起断网 70 秒 ══════════════════════════════════════ */
  t.section('③ 教室 Wi-Fi 断了 70 秒，两部手机一起断（审查 F4）');
  {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 30, consistencyLagMs: 200 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    const rid = await pairUp(A, B, 'A');
    await startPolling(A, rid); await startPolling(B, rid);
    /* 对战屏早就在轮询了：断网之前两边都已经看到过对方的心跳（每 4 秒一次 opponentGone，这里等两轮） */
    await H.sleep(9000);
    const pre = await Promise.all([H.room(A, 'opponentGone', rid), H.room(B, 'opponentGone', rid)]);
    await t.ok(pre.every((g) => g && g.ok && !g.gone), `断网前两边都在（${JSON.stringify(pre.map((g) => g && g.idleSecs))}）`, () => explain());
    emu.setOffline(true);
    await H.sleep(70000);
    emu.setOffline(false);
    /* 网一回来，两边马上各问一次（对战屏的轮询就是这样：第一下往往抢在对方心跳续上之前） */
    const [ga, gb] = await Promise.all([H.room(A, 'opponentGone', rid), H.room(B, 'opponentGone', rid)]);
    await t.ok(ga && ga.ok && !ga.gone && gb && gb.ok && !gb.gone,
      `网一回来的第一下：两边都没说「对手离场」（房主 ${JSON.stringify(ga)}，客人 ${JSON.stringify(gb)}）—— 以前两边都 idle 70 多秒、各判一场胜`, () => explain());
    await H.sleep(16000);
    const oa = await stopPolling(A), ob = await stopPolling(B);
    const goneA = oa.filter((x) => x.ok && x.gone), goneB = ob.filter((x) => x.ok && x.gone);
    await t.ok(!goneA.length && !goneB.length,
      `恢复以后谁都没判对方离场（房主判了 ${goneA.length} 次、客人 ${goneB.length} 次；最后一次：房主 ${JSON.stringify(oa[oa.length - 1])} 客人 ${JSON.stringify(ob[ob.length - 1])}）`, () => explain());
    const ok = oa.filter((x) => x.ok).length, nok = oa.filter((x) => !x.ok).length;
    await t.ok(nok > 5 && ok > 2, `断网期间确实读不到（读失败 ${nok} 次），恢复后又读得到了（${ok} 次）`);
    const R = H.roomDocs(emu).find((d) => d._id === rid), S = H.roomDocs(emu).find((d) => d.kind === 'seat' && d.roomId === rid);
    await t.ok(R && !R.abandonWin && S && !S.abandonWin, '库里两边都没写「判对方离场」', () => explain());
    await closeAll();
  }

  /* ══ ④ 被房主撤回的客人 ═══════════════════════════════════════ */
  t.section('④ 客人上传一直失败、被房主撤回后，房主换了别人开打（审查 F11）');
  {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 50, jitterMs: 30, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), G1 = await phone('客人一', '小蜂一'), G2 = await phone('客人二', '小蜂二');
    const made = await H.room(A, 'createRoom', { mode: 'A' });
    await H.roomWait(A, made.roomId);
    await seeRoom(G1, made.roomId);
    /* 客人一：能读、写不出去（上传一直失败）—— 抢到座位之后的每一次写都断 */
    const j1 = await H.roomLaunch(G1, 'j', 'joinRoom', made.roomId, {});
    await H.until(() => H.roomDocs(emu).some((d) => d.kind === 'seat' && d._openid === G1.cloudUid), { timeout: 15000 });
    const up = emu.fault({ uid: G1.cloudUid, db: true, test: (ctx) => ctx.action === 'database.updateDocument' || ctx.action === 'database.addDocument', do: 'abort' });
    const r1 = await H.roomResult(G1, 'j', 40000);
    await t.ok(r1.r && r1.r.ok, `客人一看到了确认（${r1.r && (r1.r.ok ? 'ok' : r1.r.reason)}）`, () => explain());
    await H.room(G1, 'markReady', made.roomId);
    /* 房主等不到回话 → 撤回、重新开门；客人二进来 */
    const reopened = await H.until(() => { const R = H.roomDocs(emu).find((d) => d._id === made.roomId); return R && R.status === 'open' && !R.guestId && R.seat > 0 ? R : null; }, { timeout: 40000, interval: 800 });
    await t.ok(reopened, `房主等不到客人一回话 → 撤回确认、换了座位号重新开门（seat=${reopened && reopened.seat}）`, () => explain());
    const ev0 = await H.roomEvent(A, 1000);
    if (ev0) await H.roomWait(A, made.roomId);
    await seeRoom(G2, made.roomId);
    const j2 = await H.room(G2, 'joinRoom', made.roomId, {});
    const ev = await H.roomEvent(A, 30000);
    await t.ok(j2 && j2.ok && ev && ev.joined && ev.room.guestId === G2.key, '客人二进来了，房主确认的是客人二', () => explain());
    await H.room(A, 'markReady', made.roomId); await H.room(G2, 'markReady', made.roomId);
    up.remove();
    /* 客人一的网好了：他还以为在打，抢了第 1 词 —— 写的是旧轮次的回合号，碰不到新的这一局 */
    const c1 = await H.room(G1, 'claimRound', made.roomId, 0);
    const c2 = await H.room(G2, 'claimRound', made.roomId, 0);
    await t.ok(c2 && c2.ok && c2.first === true && c2.score === 100,
      `客人二拼对第 1 词照样是「先拼对」100 分（客人一留下的那条不算：${JSON.stringify(c1 && { ok: c1.ok, first: c1.first })}）`, () => explain());
    let g = null;
    for (let i = 0; i < 8 && !(g && g.kicked); i++) { g = await H.room(G1, 'opponentGone', made.roomId); await H.sleep(1200); }
    await t.ok(g && g.ok && g.kicked && !g.gone, `客人一：「这不是你的这一局」（kicked），不是「对手已离场，你胜」（${JSON.stringify(g)}）`, () => explain());
    const hs = await H.room(A, 'roundState', made.roomId);
    await t.ok(hs && hs.ok && hs.winners[0] === 'guest' && hs.oppId === G2.key, `房主那边第 1 词也是客人二赢的（${hs && hs.winners}）`, () => explain());
    await closeAll();
  }

  /* ══ ⑤ 看到「判离场」之后又读到旧快照 ════════════════════════════ */
  t.section('⑤ 已经看到「判给了房主」，下一次读到的却是旧快照（审查 F12）');
  {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 20, consistencyLagMs: 200 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    const rid = await pairUp(A, B, 'A');
    await H.sleep(3000);
    await H.room(A, 'claimAbandonWin', rid);
    const seen = await H.until(async () => { const x = await H.room(B, 'roundState', rid); return x && x.ok && x.abandonWin === 'host' ? x : null; }, { timeout: 10000 });
    await t.ok(seen, `客人读到了「判给房主」（${seen && seen.abandonWin}）`, () => explain());
    /* 之后的读都落到一个落后 2 秒以上的副本上（判离场之前的样子） */
    emu.knobs.consistencyLagMs = 30000;
    const rr = await H.room(B, 'reportResult', rid, 500);
    await t.ok(rr && rr.ok && rr.result === 'lose' && rr.byAbandon, `交卷：还是「判给了对手」，没有倒回去变成 500:1 赢（${JSON.stringify(rr)}）`, () => explain());
    emu.knobs.consistencyLagMs = 200;
    await H.cleanPhones(t, live);
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
