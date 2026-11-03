// 真 SDK（vendor_cloudbase_esm_v965.js 2.30.0）+ 真页面（spelling_pk.html）+ 真账号/房间模块，
// 只有腾讯云的网络由 emulator.mjs 本地应答。每个浏览器上下文 = 一个账号。
// 用法: node e2e_room.mjs [legacy|rules] [latencyMs] [lagMs]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const POC = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/emulator-poc';
const { createEmulator, ACL } = await import(POC + '/emulator.mjs');
const { startStatic, launch, newCtx, E } = await import(POC + '/harness.mjs');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] || 'legacy';
const LAT = Number(process.argv[3] || 80), LAG = Number(process.argv[4] || 400);
const emu = createEmulator({
  collections: { hansen_pk_rooms: ACL.READONLY, hansen_saves: ACL.READONLY, sb_profile: ACL.READONLY, counters: ACL.ADMINONLY,
                 hansen_friends: ACL.READONLY, hansen_pk_records: ACL.READONLY, hansen_ladder: ACL.READONLY },
  knobs: { permissionMode: mode, latencyMs: LAT, jitterMs: Math.round(LAT * 0.75), consistencyLagMs: LAG },
});
const USERS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'];
for (const u of USERS) emu.seedUser({ username: u + '_e2e', password: 'pw123456', name: u });

let pass = 0, failN = 0; const lines = [];
const ok = (c, m) => { const l = (c ? '  OK  ' : '  XX  ') + m; lines.push(l); console.log(l); c ? pass++ : failN++; };

const srv = await startStatic();
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;
const browser = await launch();
const P = {};
async function open(name) {
  const c = await newCtx(browser, emu, ORIGIN, { tag: name, url: '/spelling_pk.html', waitReady: false,
    ctxOpts: { serviceWorkers: 'block', viewport: { width: 390, height: 844 } } });
  await c.page.waitForFunction(() => window.HansenAuth && window.HansenPkRoom && window.HansenAuth.loginByPassword, null, { timeout: 30000 });
  await c.page.waitForTimeout(800);
  const r = await E(c.page, async (u) => {
    try { localStorage.setItem('hansen_sb_profile_v1002', JSON.stringify({ name: u + '同学', cid: 1 })); } catch (e) {}
    const l = await window.HansenAuth.loginByPassword(u + '_e2e', 'pw123456').then((x) => ({ ok: true }), (e) => ({ ok: false, e: String(e && e.message || e) }));
    const s = await window.HansenAuth.ensureSession();
    /* 测试里把轮询调快（产品默认不变） */
    window.HansenPkRoom._setTimingForTest({ waitPollMs: 500, ackPollMs: 400 });
    window.__ev = [];
    return { l, s };
  }, name);
  c.name = name; P[name] = c;
  return { c, r };
}
const ev = (pg, rid, opts) => E(pg, ([rid, opts]) => {
  window.__ev = [];
  window.__cancel = window.HansenPkRoom.waitForOpponent(rid, (e) => window.__ev.push(e), 60000,
    opts ? { ladder: { rating: opts.rating, band: () => 300 } } : undefined);
  return true;
}, [rid, opts || null]);
const waitEv = async (pg, ms = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const e = await E(pg, () => window.__ev.slice());
    if (e && e.length) return e[0];
    await new Promise((z) => setTimeout(z, 200));
  }
  return null;
};
const call = (pg, fn, ...args) => E(pg, ([fn, args]) => window.HansenPkRoom[fn](...args), [fn, args]);
const docs = () => emu.dump('hansen_pk_rooms') || [];
const out = { mode, LAT, LAG };

try {
  for (const u of ['alice', 'bob', 'carol', 'dave']) {
    const { r } = await open(u);
    ok(r && r.s && r.s.ok, `[${u}] 登录 + ensureSession ok（uid=${r && r.s && r.s.uid}）`);
  }
  const A = P.alice.page, B = P.bob.page, C = P.carol.page, D = P.dave.page;

  /* ── 场景 1：两个账号完整打一局 ── */
  const made = await call(A, 'createRoom', { mode: 'A', hostRating: 1000, wordCount: 3 });
  ok(made && made.ok && made.roomId, `建房 ok（${made && made.roomId}）${made && !made.ok ? made.reason : ''}`);
  const rid = made.roomId;
  let lr = null;
  for (let i = 0; i < 10; i++) { lr = await call(B, 'listRooms'); if (lr && lr.ok && lr.rooms.some((x) => x._id === rid)) break; await B.waitForTimeout(300); }
  ok(lr && lr.ok && lr.rooms.some((x) => x._id === rid), `B 列表看到 A 的房（${lr && lr.rooms && lr.rooms.length} 间）${lr && !lr.ok ? lr.reason : ''}`);
  const item = lr.rooms.find((x) => x._id === rid) || {};
  ok(item.hostName === 'alice同学' && item.mode === 'A' && item.hostRating === 1000, `列表项是真名字/玩法/分（${item.hostName}/${item.mode}/${item.hostRating}）`);
  await ev(A, rid);
  const join = await call(B, 'joinRoom', rid, { rating: 1100 });
  ok(join && join.ok && join.mySide === 'guest', `B 进房（房主确认）ok ${join && !join.ok ? join.reason : ''}`);
  const je = await waitEv(A);
  ok(je && je.joined && je.room.guestName === 'bob同学' && je.room.guestRating === 1100, `A 等到 B（${je && je.room && je.room.guestName}，${je && je.room && je.room.guestRating} 分）`);
  ok(JSON.stringify(made.words) === JSON.stringify(join.words), '两边词表一致');
  const [ra, rb] = await Promise.all([call(A, 'markReady', rid), call(B, 'markReady', rid)]);
  ok(ra.ok && rb.ok, `双方 markReady ok ${ra.reason || ''} ${rb.reason || ''}`);
  /* 回合 0：同时抢 */
  const [c0a, c0b] = await Promise.all([call(A, 'claimRound', rid, 0), call(B, 'claimRound', rid, 0)]);
  ok(c0a.ok && c0b.ok && [c0a, c0b].filter((x) => x.first).length === 1 && c0a.winner === c0b.winner,
     `回合0 同时抢：恰好一个先（A first=${c0a.first} B first=${c0b.first} winner=${c0a.winner}/${c0b.winner}）`);
  /* 回合 1：A 超时推进 vs B 抢答 */
  const [s1a, c1b] = await Promise.all([call(A, 'skipRound', rid, 1), call(B, 'claimRound', rid, 1)]);
  ok(s1a.ok && c1b.ok && (s1a.skipped === true) !== (c1b.first === true), `回合1 超时 vs 抢答：只有一个结论（skip=${s1a.skipped} claim=${c1b.first}）`);
  /* 回合 2：客人先 */
  const c2b = await call(B, 'claimRound', rid, 2), c2a = await call(A, 'claimRound', rid, 2);
  ok(c2b.first === true && c2a.first === false && c2a.winner === 'guest', '回合2 客人先拼对 → 客人拿下，房主看到是客人');
  let sa = null, sb = null;
  for (let i = 0; i < 10; i++) {
    [sa, sb] = await Promise.all([call(A, 'roundState', rid), call(B, 'roundState', rid)]);
    if (sa.ok && sb.ok && sa.round === 3 && sb.round === 3) break;
    await A.waitForTimeout(300);
  }
  ok(sa.ok && sb.ok && sa.round === 3 && JSON.stringify(sa.winners) === JSON.stringify(sb.winners),
     `两边 roundState 一致（A ${JSON.stringify(sa.winners)} / B ${JSON.stringify(sb.winners)}）`);
  ok(sa.mySide === 'host' && sb.mySide === 'guest' && sa.oppName === 'bob同学' && sb.oppName === 'alice同学'
     && sa.oppRating === 1100 && sb.oppRating === 1000, `对手名字/分两边都有（A 看 ${sa.oppName} ${sa.oppRating}；B 看 ${sb.oppName} ${sb.oppRating}）`);
  ok(sa.hostReady && sa.guestReady && sb.hostReady && sb.guestReady, '双方就绪两边都看得到');
  const rA1 = await call(A, 'reportResult', rid, 200);
  ok(rA1.ok && rA1.waiting === true, `A 先交卷 → 等待 ${rA1.reason || ''}`);
  let rB = null;
  for (let i = 0; i < 10; i++) { rB = await call(B, 'reportResult', rid, 100); if (rB.ok && !rB.waiting) break; await B.waitForTimeout(300); }
  ok(rB.ok && !rB.waiting && rB.result === 'lose' && rB.theirs === 200, `B 交卷 → 结果（${rB.mine}:${rB.theirs} ${rB.result}）`);
  let rA2 = null;
  for (let i = 0; i < 10; i++) { rA2 = await call(A, 'reportResult', rid, 200); if (rA2.ok && !rA2.waiting) break; await A.waitForTimeout(300); }
  ok(rA2.ok && rA2.result === 'win' && rA2.theirs === 100, `A 看到同一个结果（${rA2.mine}:${rA2.theirs} ${rA2.result}）`);
  await call(A, 'leaveRoom', rid); await call(B, 'leaveRoom', rid);
  const all1 = JSON.stringify(docs());
  ok(!/alice_e2e|bob_e2e/.test(all1), '集合里没有用户名/手机号');
  const R1 = docs().find((d) => d._id === rid);
  ok(R1 && R1.status === 'done', `房主离开后房间留着（status=${R1 && R1.status}，延后清理）`);
  out.scene1 = { rid, winners: sa.winners };

  /* ── 场景 2：三个客人同时抢一个座位 ── */
  const m2 = await call(A, 'createRoom', { mode: 'C', wordCount: 3 });
  await A.waitForTimeout(LAG + 200);
  await ev(A, m2.roomId);
  const js = await Promise.all([call(B, 'joinRoom', m2.roomId), call(C, 'joinRoom', m2.roomId), call(D, 'joinRoom', m2.roomId)]);
  const okN = js.filter((x) => x && x.ok).length;
  ok(okN === 1, `三人抢一个座位 → 恰好 1 个成功（实得 ${okN}；${js.map((x) => x.ok ? 'ok' : x.kind).join(',')}）`);
  ok(js.filter((x) => !x.ok).every((x) => x.kind === 'taken'), '其余两人 kind=taken');
  const e2 = await waitEv(A);
  const winnerUid = js.findIndex((x) => x.ok);
  ok(e2 && e2.joined && e2.room.guestName === ['bob同学', 'carol同学', 'dave同学'][winnerUid], `房主确认的就是抢到的那位（${e2 && e2.room && e2.room.guestName}）`);
  const seats2 = docs().filter((d) => d.kind === 'seat' && d.roomId === m2.roomId);
  ok(seats2.length === 1, `只留下一个座位文档（${seats2.length}）`);
  for (const pg of [A, B, C, D]) await call(pg, 'leaveRoom', '');

  /* ── 场景 3：客人在等确认时退出 → 下一个人能进；死座位 → 换轮次 ── */
  const m3 = await call(A, 'createRoom', { mode: 'C', wordCount: 3 });
  await A.waitForTimeout(LAG + 200);
  const pend = E(B, (r) => window.HansenPkRoom.joinRoom(r), m3.roomId);
  await B.waitForTimeout(1500);
  await call(B, 'leaveRoom', m3.roomId);
  const pr = await pend;
  ok(pr && pr.ok === false && pr.cancelled, `客人等确认时退出 → cancelled（${pr && pr.reason}）`);
  await A.waitForTimeout(LAG + 300);
  await ev(A, m3.roomId);
  const j3 = await call(C, 'joinRoom', m3.roomId);
  const e3 = await waitEv(A);
  ok(j3.ok && e3 && e3.joined && e3.room.guestName === 'carol同学', `下一个客人进来了（${e3 && e3.room && e3.room.guestName}）${j3.reason || ''}`);
  for (const pg of [A, C]) await call(pg, 'leaveRoom', '');

  // 死座位：dave 占座后断网 + 关页面（收不了座位）
  const m3b = await call(A, 'createRoom', { mode: 'C', wordCount: 3 });
  await A.waitForTimeout(LAG + 200);
  await E(A, () => window.HansenPkRoom._setTimingForTest({ firstSightMs: 1000, seatStaleMs: 3000 }));
  const pend2 = E(D, (r) => window.HansenPkRoom.joinRoom(r), m3b.roomId);
  await D.waitForTimeout(1200);
  await P.dave.ctx.route('**/*', (r) => r.abort());
  await P.dave.ctx.close().catch(() => {});
  pend2.catch(() => {});
  ok(docs().some((d) => d.kind === 'seat' && d.roomId === m3b.roomId), '死座位留在了库里（模拟手机被杀、没来得及收）');
  await A.waitForTimeout(2000);
  await ev(A, m3b.roomId);
  let Rb = null;
  for (let i = 0; i < 40; i++) { Rb = docs().find((d) => d._id === m3b.roomId); if (Rb && Rb.seat === 1) break; await A.waitForTimeout(300); }
  ok(Rb && Rb.seat === 1 && !Rb.guestId, `房主没确认死座位，换到轮次 1（seat=${Rb && Rb.seat} guestId=${Rb && Rb.guestId}）`);
  const j3b = await call(B, 'joinRoom', m3b.roomId);
  const e3b = await waitEv(A);
  ok(j3b.ok && e3b && e3b.joined && e3b.room.guestName === 'bob同学', `换号后新客人照常进（${j3b.reason || 'ok'}）`);
  await E(A, () => window.HansenPkRoom._setTimingForTest({ firstSightMs: 15000, seatStaleMs: 20000 }));

  /* ── 场景 4：房主打完先走 / 房主中途跑 ── */
  await call(A, 'markReady', m3b.roomId); await call(B, 'markReady', m3b.roomId);
  await call(A, 'reportResult', m3b.roomId, 300);
  await call(A, 'leaveRoom', m3b.roomId);
  await B.waitForTimeout(LAG + 200);
  const g4 = await call(B, 'opponentGone', m3b.roomId);
  ok(g4.ok && g4.gone === false && g4.oppFinished, `房主交卷后离开 ≠ 逃跑（gone=${g4.gone} oppFinished=${g4.oppFinished}）`);
  const r4 = await call(B, 'reportResult', m3b.roomId, 100);
  ok(r4.ok && !r4.waiting && r4.result === 'lose' && r4.theirs === 300, `房主走了，客人照样读到结果（${r4.mine}:${r4.theirs} ${r4.result}）${r4.reason || ''}`);
  await call(B, 'leaveRoom', '');
  const m4 = await call(A, 'createRoom', { mode: 'A', wordCount: 3 });
  await A.waitForTimeout(LAG + 200);
  await ev(A, m4.roomId);
  const j4 = await call(C, 'joinRoom', m4.roomId);
  await waitEv(A);
  await call(A, 'markReady', m4.roomId); await call(C, 'markReady', m4.roomId);
  await call(A, 'leaveRoom', m4.roomId);   // 房主中途跑
  let g4b = null;
  for (let i = 0; i < 8; i++) { g4b = await call(C, 'opponentGone', m4.roomId); if (g4b.gone) break; await C.waitForTimeout(400); }
  ok(j4.ok && g4b && g4b.gone === true, `房主中途跑 → 客人很快知道（gone=${g4b && g4b.gone}）`);
  const w4 = await call(C, 'claimAbandonWin', m4.roomId);
  ok(w4.ok && w4.byAbandon, `客人判对方离场 ok ${w4.reason || ''}`);
  await call(C, 'leaveRoom', '');

  /* ── 场景 5：天梯两人几乎同时开房 → 收敛到先开的那间 ── */
  const [l1, l2] = await Promise.all([call(A, 'createRoom', { mode: 'A', hostRating: 1000, wordCount: 3 }),
                                      call(B, 'createRoom', { mode: 'A', hostRating: 1020, wordCount: 3 })]);
  await A.waitForTimeout(LAG + 200);
  await Promise.all([ev(A, l1.roomId, { rating: 1000 }), ev(B, l2.roomId, { rating: 1020 })]);
  const [ea, eb] = await Promise.all([waitEv(A, 12000), waitEv(B, 12000)]);
  const older = [l1, l2].map((x) => docs().find((d) => d._id === x.roomId)).sort((x, y) => (x.createdAt - y.createdAt) || (x._id < y._id ? -1 : 1))[0];
  const switcher = (ea && ea.switchTo) ? 'A' : ((eb && eb.switchTo) ? 'B' : '');
  ok(switcher && ((switcher === 'A' && ea.switchTo === older._id) || (switcher === 'B' && eb.switchTo === older._id)) && !((ea && ea.switchTo) && (eb && eb.switchTo)),
     `同时开房：只有后开的那位被叫去进先开的房（switcher=${switcher}）`);
  const sPg = switcher === 'A' ? A : B, hPg = switcher === 'A' ? B : A;
  const j5 = await call(sPg, 'joinRoom', older._id);
  const e5 = (switcher === 'A' ? eb : ea) || await waitEv(hPg, 12000);
  ok(j5.ok && e5 && e5.joined, `两人进了同一间（${j5.reason || 'ok'}）`);
  await A.waitForTimeout(LAG + 300);
  const open5 = docs().filter((d) => d.kind === 'room' && d.status === 'open');
  ok(open5.length === 0, `没有留下幽灵房（open=${open5.length}）`);
  await call(A, 'leaveRoom', ''); await call(B, 'leaveRoom', '');

  /* ── 场景 7：断网（数据库请求被掐）→ kind=network；凭证没了 → 登录类，不说"连不上网络" ── */
  await P.alice.ctx.route(/tcb-api\.tencentcloudapi\.com\/web/, (r) => r.abort());
  const n7 = await call(A, 'listRooms');
  ok(n7.ok === false && n7.kind === 'network' && /network request error/.test(n7.reason), `断网 → network：${n7.reason}`);
  await P.alice.ctx.unroute(/tcb-api\.tencentcloudapi\.com\/web/);
  const ok7 = await call(A, 'listRooms');
  ok(ok7.ok === true, `网回来了 → 列表恢复 ${ok7.reason || ''}`);

  /* ── 场景 6：权限 / 集合不对 → kind=config ── */
  const aclFlipAt = Date.now();
  emu.setAcl('hansen_pk_rooms', ACL.ADMINONLY);
  const l6 = await call(A, 'listRooms');
  ok(l6.ok === false && l6.kind === 'config' && /hansen_pk_rooms/.test(l6.reason) && /PERMISSION_DENIED/.test(l6.reason), `ADMINONLY → config：${l6.reason}`);
  const c6 = await call(A, 'createRoom', { mode: 'A' });
  ok(c6.ok === false && c6.kind === 'config', `ADMINONLY 开房 → config（${c6.kind}）`);
  emu.cols.delete('hansen_pk_rooms');
  const l7 = await call(A, 'listRooms');
  ok(l7.ok === false && l7.kind === 'config' && /还没有建/.test(l7.reason), `集合不存在 → config：${l7.reason}`);

  /* 越权写一次都没有：按 JWT 里的 sub（调用者）和文档创建者比 */
  const subOf = (tok) => { try { return JSON.parse(Buffer.from(String(tok).split('.')[1], 'base64url').toString()).sub; } catch (e) { return ''; } };
  /* 按日志顺序走：add 时记下当前主人（同一个 _id 可以被删后由别人重新建），写/删时和调用者比 */
  const creator = {}, denied = [];
  for (const x of emu.log) {
    if (!x.body || x.body.collectionName !== 'hansen_pk_rooms') continue;
    const who = subOf(x.body.access_token);
    if (x.body.action === 'database.addDocument' && x.res && /"_id"/.test(x.res.body)) {
      let d = x.body.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) {} }
      if (d && d._id) creator[d._id] = who;
      continue;
    }
    if (!/update|delete/.test(x.body.action || '')) continue;
    let q = x.body.query; if (typeof q === 'string') { try { q = JSON.parse(q); } catch (e) {} }
    const id = q && q._id;
    const cross = id && creator[id] && creator[id] !== who;
    const perm = x.res && /PERMISSION_DENIED/.test(x.res.body) && x.t < aclFlipAt;
    if (cross || perm) denied.push(`${x.body.action} q=${JSON.stringify(x.body.query).slice(0, 60)} -> ${x.res && x.res.body.slice(0, 60)}`);
    if (x.body.action === 'database.deleteDocument' && x.res && /"deleted":1/.test(x.res.body) && id) delete creator[id];
  }
  out.denied = denied;
  ok(denied.length === 0, `★ 全程没有一次去写/删别人的文档（${denied.length}）`);
  const multi = emu.log.filter((x) => x.body && x.body.collectionName === 'hansen_pk_rooms' && x.body.action === 'database.updateDocument' && x.body.multi);
  ok(multi.length === 0, `★ 没有 where().update()（multi 更新 ${multi.length} 次）`);
  /* 云端不认这个令牌了（真机上令牌作废时 DB 返回 {code:ACCESS_TOKEN_EXPIRED}）→ expired，不是 network */
  emu.expireAllAccessTokens();
  const x7 = await E(B, async () => { const r = await window.HansenPkRoom.listRooms(); return { kind: r.kind, reason: r.reason, ok: r.ok }; });
  ok(x7.ok === false && x7.kind === 'expired', `令牌被云端拒 → kind=${x7.kind}：${x7.reason}`);
  out.credLostKind = x7.kind;
  out.ops = emu.log.filter((x) => x.body && x.body.collectionName === 'hansen_pk_rooms').length;
} catch (e) {
  ok(false, 'threw: ' + (e && e.stack || e));
} finally {
  await browser.close(); srv.close();
  out.pass = pass; out.fail = failN; out.lines = lines;
  fs.writeFileSync(path.join(HERE, `e2e_result_${mode}_${LAT}_${LAG}.json`), JSON.stringify(out, null, 2));
  console.log(`\n[${mode} lat=${LAT} lag=${LAG}] 结果: ${pass} 通过 / ${failN} 失败`);
  process.exit(failN ? 1 : 0);
}
