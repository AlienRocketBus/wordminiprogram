#!/usr/bin/env node
/* test_rooms_lifecycle_cloud_v1164.mjs —— 房间的「中途」：客人等确认时走了、有人掉线、房主先打完
 *
 * 为什么要有它：对战里最容易坏的不是正常打完，而是「有人中途不见了」——
 *   以前客人退出会去删房主的房、房主先走会把房删掉让客人读不到结果、
 *   客人等确认时走了会留下孤儿座位让房主跟空气开打。这些在假传输层里都「正常」。
 *   这里页面/账号/房间/SDK 全是真的，只有腾讯云由 cloudbase_emulator.mjs 应答；
 *   「手机卡住」用模拟云端扣住那个人的请求，「手机没电」= 先断网再关页面（什么告别都发不出去）。
 *
 *   ① 客人点了「进去打」、房主还没确认，客人就点了返回（READONLY · legacy）：
 *      客人的座位要收回；房主不会跟走掉的人开打；客人不会过一会儿又被拉进对战；
 *      下一个人照样能进来开打。
 *   ② 掉线两个方向同时测（READONLY · rules）：客人没电 → 房主约 1 分钟后「对手已离场，本局你胜」；
 *      房主没电 → 客人同样判胜。判胜只写自己的文档，等的时候屏幕说对手掉线了。
 *   ③ 房主先打完就关了页面，客人的手机慢了几秒（legacy）：客人照样看到正确的结算（不是「对手已离场」），
 *      房间没被删掉。
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('房间对战 · 中途离开 / 掉线 / 房主先打完（v1164）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const has = (txt, re) => re.test(String(txt || ''));
let seq = 40;

async function phone(name, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, { name });
  live.push(p);
  const num = '138000000' + (seq++);
  p.number = num;
  const r = await H.loginPhone(p, num);
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.nick = nick;
  return p;
}
async function toLobby(p) {
  await p.tap('#pkRooms');
  await H.answerNameIfAsked(p, p.nick);
  await p.waitScreen(/开一间/, { timeout: 8000 });
}
async function openRoom(p, mode) {
  await p.tap('#prNew');
  await p.tap(`.pr_mode[data-mode="${mode}"]`);
  await p.waitScreen(/等对手进来/, { timeout: 15000 }).catch(() => '');
  return H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === p.cloudUid && d.status === 'open');
}
async function joinRoom(g, rid) {
  await toLobby(g);
  const btn = await H.until(async () => {
    const h = await g.hitTest(`button[data-rid="${rid}"]`, { timeout: 400 });
    if (h.ok) return h;
    await g.tap('#prRef').catch(() => {});
    return null;
  }, { timeout: 15000, interval: 900 });
  if (!btn) return false;
  await g.tap(`button[data-rid="${rid}"]`);
  return true;
}
const battling = (a, b, timeout = 30000) => H.until(async () => (await H.battleView(a)) && (await H.battleView(b)), { timeout });

try {
  /* ══ ① 客人等确认时点了返回 ═══════════════════════════════════════ */
  t.section('① 客人等房主确认时点了返回（READONLY · legacy）');
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 50, jitterMs: 50, consistencyLagMs: 300 } });
  names = {};
  const Hh = await phone('房主', '小蜂房主'), G1 = await phone('先来', '小蜂先来'), G2 = await phone('后来', '小蜂后来');
  await toLobby(Hh);
  const R1 = await openRoom(Hh, 'C');
  await t.ok(R1, '房主开好一间同步赛', () => explain());
  /* 房主的手机卡住了几秒：它的请求先扣着 —— 于是客人一直在「等房主确认」 */
  const hold = emu.hold({ uid: Hh.cloudUid, db: true });
  const went = R1 && await joinRoom(G1, R1._id);
  const seat = await H.until(() => H.roomDocs(emu).find((d) => d.kind === 'seat' && d.roomId === R1._id && d._openid === G1.cloudUid), { timeout: 10000 });
  await t.ok(went && seat, '客人点了「进去打」，座位已经抢到（房主还没来得及确认）', () => explain());
  await G1.tap('#prBack').catch(async () => { await G1.eval(() => window.HansenPkRoomUI && HansenPkRoomUI.close()); });
  const gone = await H.until(() => !H.roomDocs(emu).some((d) => d.kind === 'seat' && d._openid === G1.cloudUid && d.roomId === R1._id && !d.left), { timeout: 8000 });
  await t.ok(gone, '客人点了返回 → 自己的座位收回了（不留孤儿座位让房主跟空气开打）', () => explain());
  hold.release();
  await H.sleep(7000);
  const R1b = H.roomDocs(emu).find((d) => d._id === R1._id);
  const hostScr = await Hh.screen();
  await t.ok(R1b && !R1b.guestId && R1b.status === 'open' && has(hostScr, /等对手进来/), `房主没有跟走掉的客人开打，还在「等对手进来」（库里 guestId=${R1b && R1b.guestId || '空'} status=${R1b && R1b.status}）`, () => explain());
  /* 「没在对战屏」要先确认页面活着 —— 页面崩了 battleView 也是 null（审查 TI-9） */
  await t.ok(await H.alive(G1) && !(await H.battleView(G1)), '走掉的客人过了一会儿也没有被拉回对战屏（页面还活着）', () => explain());
  await joinRoom(G2, R1._id);
  const ok2 = await battling(Hh, G2);
  const R1c = H.roomDocs(emu).find((d) => d._id === R1._id);
  await t.ok(ok2 && R1c && R1c.guestId === 'u' + G2.cloudUid, '下一个人进来，房主确认的是他，两人开打', () => explain());
  await t.ok(await H.alive(G1) && !(await H.battleView(G1)), '先来又走的那个人始终没有出现在这局里（页面还活着）', () => explain());
  await t.ok(H.foreignWrites(emu).length === 0, `没有人去改别人的文档（尝试 ${H.foreignWrites(emu).length} 次）`, () => explain());
  await H.cleanPhones(t, [Hh, G1, G2]);
  for (const p of [Hh, G1, G2]) await p.close();
  live.length = 0;

  /* ══ ② 掉线：两个方向同时测 ═════════════════════════════════════ */
  t.section('② 掉线判负，两个方向（READONLY · rules）');
  emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 60, jitterMs: 60, consistencyLagMs: 400 } });
  names = {};
  const X1 = await phone('X房主', '小蜂X主'), X2 = await phone('X客人', '小蜂X客');
  const Y1 = await phone('Y房主', '小蜂Y主'), Y2 = await phone('Y客人', '小蜂Y客');
  await toLobby(X1); const RX = await openRoom(X1, 'C');
  await toLobby(Y1); const RY = await openRoom(Y1, 'C');
  await joinRoom(X2, RX && RX._id);
  await joinRoom(Y2, RY && RY._id);
  const bx = await battling(X1, X2), by = await battling(Y1, Y2);
  await t.ok(bx && by, '两间房都开打了', () => explain());
  await X2.kill();   // 客人没电
  await Y1.kill();   // 房主没电
  const t0 = Date.now();
  let warnX = false, warnY = false, winX = null, winY = null;
  while (Date.now() - t0 < 100000 && !(winX && winY)) {
    const sx = await X1.screen(), sy = await Y2.screen();
    if (has(sx, /掉线/)) warnX = true;
    if (has(sy, /掉线/)) warnY = true;
    if (!winX && has(sx, /对手已离场/)) winX = Math.round((Date.now() - t0) / 1000);
    if (!winY && has(sy, /对手已离场/)) winY = Math.round((Date.now() - t0) / 1000);
    await H.sleep(1000);
  }
  await t.ok(winX && winX >= 45, `客人没电 → 房主约 1 分钟后看到「对手已离场，本局你胜」（${winX ? winX + ' 秒' : '100 秒内没等到'}）`, () => explain());
  await t.ok(winY && winY >= 45, `房主没电 → 客人约 1 分钟后同样判胜（${winY ? winY + ' 秒' : '100 秒内没等到'}）`, () => explain());
  await t.ok(warnX && warnY, `等的时候屏幕上说「对手掉线了…」，不是干等（房主那边 ${warnX ? '说了' : '没说'}，客人那边 ${warnY ? '说了' : '没说'}）`);
  await H.sleep(1500);
  const rx = H.roomDocs(emu).find((d) => d._id === (RX && RX._id));
  const sy2 = H.roomDocs(emu).find((d) => d.kind === 'seat' && d.roomId === (RY && RY._id) && d._openid === Y2.cloudUid);
  await t.ok(rx && rx.abandonWin === 'host' && rx.endedBy === 'abandon' && rx._openid === X1.cloudUid, '房主判胜写在自己的房间文档上（abandonWin=host）', () => explain());
  await t.ok(sy2 && sy2.abandonWin === 'guest', '客人判胜写在自己的座位文档上（abandonWin=guest），没去动房主的房', () => explain());
  await t.ok(H.foreignWrites(emu).length === 0, `安全规则模式下没有越权写（被拒 ${H.foreignWrites(emu).length} 次）`, () => explain());
  await H.cleanPhones(t, [X1, X2, Y1, Y2]);
  for (const p of [X1, X2, Y1, Y2]) await p.close();
  live.length = 0;

  /* ══ ③ 房主先打完就关了页面 ═════════════════════════════════════ */
  t.section('③ 房主先打完、关了页面，客人慢几秒才交卷（READONLY · legacy）');
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 50, jitterMs: 50, consistencyLagMs: 400 } });
  names = {};
  const M1 = await phone('先完', '小蜂先完'), M2 = await phone('后完', '小蜂后完');
  await toLobby(M1); const RM = await openRoom(M1, 'A');
  await joinRoom(M2, RM && RM._id);
  const bm = await battling(M1, M2);
  await t.ok(bm, '抢答赛开打', () => explain());
  if (bm) {
    const room = H.roomDocs(emu).find((d) => d._id === RM._id);
    const words = await H.wordsOfRoom(M1, room);
    const ok = words.map((w, i) => (H.typeable(w) ? i : -1)).filter((i) => i >= 0);
    const last = ok[ok.length - 1];
    /* 前面的词两人轮流拿；最后一个能拼的词：客人的手机卡住，房主拼对就交卷 */
    const plan = (i) => { const k = ok.indexOf(i); if (k < 0 || i === last) return {}; return { first: k % 2 ? 'guest' : 'host' }; };
    await H.playMatch({ host: M1, guest: M2 }, words, (i, w) => {
      if (i === last) return {};
      return plan(i, w);
    }, { timeout: 120000, stopAt: last });
    const atLast = await H.until(async () => { const a = await H.battleView(M1), b = await H.battleView(M2); return a && b && a.round === last && b.round === last; }, { timeout: 40000 });
    await t.ok(atLast, `两人都到了最后一个能拼的词（第 ${last + 1} 词）`, () => explain());
    const slow = emu.hold({ uid: M2.cloudUid, db: true });
    await H.typeWord(M1, words[last].en);
    const fin = await M1.waitScreen(/交卷|你赢了|这局输了|打平/, { timeout: 15000 }).catch((e) => e.lastText || '');
    await t.ok(has(fin, /交卷|你赢了|这局输了|打平/), `房主拼对最后一词就交卷了（看到：${fin.replace(/\s+/g, ' ').slice(0, 60)}）`, () => explain());
    await H.sleep(1500);
    await M1.close();          // 房主打完就走
    slow.release();
    const exp = H.expectedScores(words, (i, w) => (i === last ? { first: 'host' } : plan(i, w)), { firstScore: 100, secondScore: 0, waitAll: false });
    const rG = await H.waitResult(M2, 60000);
    await t.ok(rG && !rG.abandon && rG.mine === exp.guest && rG.theirs === exp.host,
      `客人照样看到正确结算：你 ${exp.guest} 分 · 对手 ${exp.host} 分，不是「对手已离场」（看到：${rG ? rG.text.split('\n').slice(0, 2).join(' / ') : '没到结算屏'}）`, () => explain());
    const RMx = H.roomDocs(emu).find((d) => d._id === RM._id);
    const SM = H.roomDocs(emu).find((d) => d.kind === 'seat' && d.roomId === RM._id);
    await t.ok(RMx && RMx.hostScore === exp.host && SM && SM.guestScore === exp.guest, `房主走了房间也还在（延后清理），两边分数都在库里（${RMx && RMx.hostScore}:${SM && SM.guestScore}）`, () => explain());
  }
  await t.ok(H.foreignWrites(emu).length === 0, `没有人去改别人的文档（尝试 ${H.foreignWrites(emu).length} 次）`, () => explain());
} catch (e) {
  await t.ok(false, '测试脚本自己出错：' + String(e && e.stack || e).slice(0, 600), () => explain());
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
