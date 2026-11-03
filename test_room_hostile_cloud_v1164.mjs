#!/usr/bin/env node
/* test_room_hostile_cloud_v1164.mjs —— 有人捣乱、手机钟不准、云端读得慢的时候，房间和天梯还能不能用
 *（审查第一轮 F5/UI-2、F6、F8/TI-3、F9、F10、TI-1）
 *
 * 真页面、真账号模块、真房间模块、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答。
 * 「捣乱的人」也是一台真登录的手机，用真 SDK 往公开集合里写东西（「读取全部数据，修改本人数据」谁都能新建）。
 *
 *   ① 陌生人建 40 间「心跳在一年以后」的假房（审查 F10）：以前查询名额被假房占满、真房一间都列不出来。
 *      一个账号一口气建 40 间「看着很新」的：只占一格。
 *   ② 云端没建 createdAt 索引（orderBy 被拒）+ 45 间一天前的死房（审查 TI-1）：
 *      以前退成不排序的查询、拿到的全是最老的死房 —— 列表空、天梯两个人互相看不见。
 *   ③ 陌生人预先建好这一局每一词的「回合文档」（审查 F9）：以前每一词还没开打就「已经被拿下」。
 *   ④ 房主手机钟慢 45 秒 / 快 5 分钟（审查 F8/TI-3）：以前钟慢的房主谁都看不见，天梯两个人互相等到超时。
 *   ⑤ 云端读有 5 秒延迟（审查 F6）：以前房主自己刚建的房 4 秒就报「房间已经不在了」，客人等确认超时。
 *   ⑥ 一方超时以后另一方才拼对（审查 F5/UI-2）：以前超时那方写的「空回合」把对方的「先拼对」抢走 ——
 *      抢答赛 0 分「超时了」、回合赛只给 80。现在拼对的照样是「先拼对」100 分。
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('有人捣乱 / 钟不准 / 读得慢 · 真 SDK 端到端（审查 F5/F6/F8/F9/F10/TI-1/TI-3）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const flat = (s) => String(s || '').replace(/\s+/g, ' ');
let seq = 20;

async function phone(name, nick, opts = {}) {
  const p = await H.openPhone(browser, emu, srv.origin, Object.assign({ name }, opts));
  live.push(p);
  const r = await H.loginPhone(p, '135000000' + (seq++));
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.nick = nick; p.key = 'u' + r.uid;
  await p.eval((nm) => { try { window.HansenSbProfile.setName(nm); } catch (e) { /* 起过名了 */ } return true; }, nick);
  return p;
}
async function closeAll() {
  for (const p of live) {
    await t.ok(!p.errors.length && !p.leaks.length, `[${p.name}] 没有页面报错、没有连外网（${p.errors.slice(0, 2).join(' | ') || '无'}${p.leaks.length ? '；外网 ' + p.leaks[0] : ''}）`);
    await p.close();
  }
  live.length = 0;
}
/* 捣乱的人：用真 SDK 往房间集合里直接加文档（不经过 App 的房间模块） */
async function strangerAdd(p, docs) {
  return p.eval(async (docs) => {
    const app = await window.HansenAuth._app();
    const col = app.database().collection('hansen_pk_rooms');
    let ok = 0; const errs = [];
    for (const d of docs) {
      try { const r = await col.add(d); if (r && r.code) errs.push(r.code); else ok++; } catch (e) { errs.push(String(e && e.message || e).slice(0, 80)); }
    }
    return { ok, errs: errs.slice(0, 3) };
  }, docs);
}
async function listed(p, rid, ms = 25000) {
  return H.until(async () => { const lr = await H.room(p, 'listRooms'); return lr && lr.ok && lr.rooms.some((x) => x._id === rid) ? lr : null; }, { timeout: ms, interval: 1500 });
}
async function pairUp(Hst, Gst, mode = 'A') {
  const made = await H.room(Hst, 'createRoom', { mode });
  await H.roomWait(Hst, made.roomId);
  await listed(Gst, made.roomId);
  const j = await H.room(Gst, 'joinRoom', made.roomId, {});
  const ev = await H.roomEvent(Hst, 40000);
  await H.room(Hst, 'markReady', made.roomId); await H.room(Gst, 'markReady', made.roomId);
  await t.ok(j && j.ok && ev && ev.joined, `开打了（${mode} 模式；客人 ${j && (j.ok ? 'ok' : j.reason)}，房主 ${ev && Object.keys(ev).join(',')}）`, () => explain());
  return made.roomId;
}
async function toLadderHome(p) {
  await p.tap('#pkLadder');
  await H.answerNameIfAsked(p, p.nick);
  await p.waitScreen(/开始排位/, { timeout: 8000 });
}
async function ladderBoth(A, B, ms = 75000) {
  await toLadderHome(A); await toLadderHome(B);
  await A.tap('#ldGo');
  await H.sleep(1500);
  await B.tap('#ldGo');
  const t0 = Date.now();
  const both = await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: ms, interval: 600 });
  return { met: !!both, secs: Math.round((Date.now() - t0) / 1000), aScr: flat(await A.screen()).slice(0, 90), bScr: flat(await B.screen()).slice(0, 90) };
}

try {
  /* ══ ① 假房刷屏 ════════════════════════════════════════════════ */
  t.section('① 陌生人建 40 间「心跳在一年以后」的假房（审查 F10）');
  {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 30, consistencyLagMs: 200 } });
    names = {};
    const X = await phone('捣乱', '捣乱的人'), A = await phone('房主', '小蜂房主'), B = await phone('找房', '小蜂找房');
    const far = Date.now() + 365 * 86400e3;
    const fakes = [];
    for (let i = 0; i < 40; i++) fakes.push({ _id: 'fake' + i + 'x' + Date.now().toString(36), proto: 2, kind: 'room', status: 'open', isPrivate: false,
      hostId: X.key, hostName: '假房' + i, mode: 'A', wordCount: 10, seat: 0, guestId: '', createdAt: far + i, heartbeatAt: far + i });
    const add = await strangerAdd(X, fakes);
    await t.ok(add.ok === 40, `捣乱的人真的建进去了 40 间假房（${add.ok}；${add.errs.join(',') || '无错误'}）`, () => explain());
    const made = await H.room(A, 'createRoom', { mode: 'C' });
    await H.roomWait(A, made.roomId);
    const lr = await listed(B, made.roomId);
    await t.ok(!!lr, `真房照样列得出来（${lr ? lr.rooms.length + ' 间' : '没列出来'}）—— 以前 40 个名额全被假房占了`, () => explain());
    await t.ok(lr && !lr.rooms.some((x) => /^fake/.test(x._id)), `「一年以后」的假房一间也不列（${lr ? lr.rooms.map((x) => x.hostName).join('、') : '-'}）`, () => explain());
    /* 同一个账号一口气建 40 间「看着很新」的：只占一格 */
    const now = Date.now(), fresh = [];
    for (let i = 0; i < 40; i++) fresh.push({ _id: 'fresh' + i + 'x' + now.toString(36), proto: 2, kind: 'room', status: 'open', isPrivate: false,
      hostId: X.key, hostName: '刷屏' + i, mode: 'A', wordCount: 10, seat: 0, guestId: '', createdAt: now + 30000 + i, heartbeatAt: now + i });
    await strangerAdd(X, fresh);
    await H.sleep(600);
    const lr2 = await H.room(B, 'listRooms');
    const spam = lr2 && lr2.ok ? lr2.rooms.filter((x) => /^fresh/.test(x._id)).length : -1;
    await t.ok(lr2 && lr2.ok && lr2.rooms.some((x) => x._id === made.roomId) && spam <= 1,
      `一个账号建 40 间新房：最多占一格（列出 ${spam} 间刷屏房），真房还在`, () => explain());
    await closeAll();
  }

  /* ══ ② 没建索引 + 一堆死房 ═════════════════════════════════════ */
  t.section('② 云端没建 createdAt 索引 + 45 间一天前的死房（审查 TI-1）');
  {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300, orderByNeedsIndex: true } });
    names = {};
    const X = await phone('留死房', '老玩家');
    const old = Date.now() - 86400e3, dead = [];
    for (let i = 0; i < 45; i++) dead.push({ _id: 'dead' + i + 'x' + old.toString(36), proto: 2, kind: 'room', status: 'open', isPrivate: false,
      hostId: X.key, hostName: '死房' + i, mode: 'A', wordCount: 10, seat: 0, guestId: '', createdAt: old + i, heartbeatAt: old + i });
    const add = await strangerAdd(X, dead);
    await t.ok(add.ok === 45, `种了 45 间一天前的死房（${add.ok}）`);
    await X.close(); live.splice(live.indexOf(X), 1);
    const A = await phone('甲', '小蜂甲'), B = await phone('乙', '小蜂乙');
    const made = await H.room(A, 'createRoom', { mode: 'C' });
    await H.roomWait(A, made.roomId);
    const lr = await listed(B, made.roomId);
    const refused = emu.log.filter((x) => x.code === 'DATABASE_REQUEST_FAILED' && x.action === 'database.queryDocument').length;
    await t.ok(!!lr, `排序被拒（${refused} 次），退成不排序的查询也列得出刚开的房 —— 以前拿到的全是最老的死房`, () => explain());
    await H.room(A, 'leaveRoom', made.roomId);
    await H.sleep(800);
    const lad = await ladderBoth(A, B);
    await t.ok(lad.met, `天梯：两个人 ${lad.secs} 秒内配上、进了对战（甲：${lad.aScr}｜乙：${lad.bScr}）`, () => explain());
    await closeAll();
  }

  /* ══ ③ 陌生人预先建好回合文档 ══════════════════════════════════ */
  t.section('③ 陌生人预先建好这一局每一词的「回合文档」（审查 F9）');
  {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 30, consistencyLagMs: 200 } });
    names = {};
    const X = await phone('捣乱', '捣乱的人'), A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    const rid = await pairUp(A, B, 'A');
    const R = H.roomDocs(emu).find((d) => d._id === rid) || {};
    const ws = [];
    for (let i = 0; i < 10; i++)
      ws.push({ _id: rid + '_w' + i, proto: 2, kind: 'win', nonce: 'x' + i, roomId: rid, ep: 0, i, winner: 'host', by: R.hostId, at: Date.now() });
    const add = await strangerAdd(X, ws);
    await t.ok(add.ok === 10, `捣乱的人抢先建好了回合文档（${add.ok} 份，写的是「房主拿下」）`, () => explain());
    await H.sleep(500);
    const st = await H.room(B, 'roundState', rid);
    const pre = st && st.ok ? (st.winners || []).filter((w) => w).length : -1;
    await t.ok(st && st.ok && pre === 0, `客人这边：一词都还没「被拿下」（已定 ${pre} 词；winners=${JSON.stringify(st && st.winners)}）—— 以前开打前 10 词全判给了房主`, () => explain());
    const g0 = await H.room(B, 'claimRound', rid, 0);
    await t.ok(g0 && g0.ok && g0.first && g0.score === 100, `客人先拼对第 1 词：拿下、100 分（${JSON.stringify(g0 && { ok: g0.ok, first: g0.first, score: g0.score, reason: g0.reason })}）`, () => explain());
    const h0 = await H.room(A, 'claimRound', rid, 0);
    await t.ok(h0 && h0.ok && !h0.first && h0.winner === 'guest', `房主后拼对第 1 词：认客人先拿下（${JSON.stringify(h0 && { first: h0.first, winner: h0.winner })}）`, () => explain());
    const h1 = await H.room(A, 'claimRound', rid, 1);
    await t.ok(h1 && h1.ok && h1.first && h1.score === 100, `房主先拼对第 2 词：拿下（不是靠陌生人那份「已拿下」；${JSON.stringify(h1 && { first: h1.first, score: h1.score })}）`, () => explain());
    const st2 = await H.room(B, 'roundState', rid);
    await t.ok(st2 && st2.ok && JSON.stringify((st2.winners || []).slice(0, 2)) === JSON.stringify(['guest', 'host']), `两边看到的都是真打出来的结果（${JSON.stringify(st2 && st2.winners)}）`, () => explain());
    await closeAll();
  }

  /* ══ ④ 手机钟不准 ══════════════════════════════════════════════ */
  for (const off of [-45000, 300000]) {
    t.section(`④ 房主手机钟${off < 0 ? '慢 45 秒' : '快 5 分钟'}（审查 F8/TI-3）`);
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('钟不准', '钟不准的', { clockOffsetMs: off }), B = await phone('钟准', '钟准的');
    const skew = (await A.eval(() => Date.now())) - (await B.eval(() => Date.now()));
    await t.ok(Math.abs(skew - off) < 3000, `两部手机的钟真的差了 ${Math.round(skew / 1000)} 秒`);
    const made = await H.room(A, 'createRoom', { mode: 'C' });
    await H.roomWait(A, made.roomId);
    const lr = await listed(B, made.roomId, 30000);
    await t.ok(!!lr, `钟准的那台列得出这间房 —— 以前钟慢的房主谁都看不见`, () => explain());
    await B.tap('#pkRooms');
    await H.answerNameIfAsked(B, B.nick);
    const lob = await B.waitScreen(/钟不准的/, { timeout: 20000 }).catch((e) => e.lastText || '');
    await t.ok(/钟不准的/.test(lob), `「公开房间」页面上也看得到（${flat(lob).slice(0, 80)}）`, () => explain());
    const j = await H.room(B, 'joinRoom', made.roomId, {});
    const ev = await H.roomEvent(A, 40000);
    await t.ok(j && j.ok && ev && ev.joined, `进得去、房主确认得了（客人 ${j && (j.ok ? 'ok' : j.reason)}）`, () => explain());
    await H.room(B, 'leaveRoom', made.roomId); await H.room(A, 'leaveRoom', made.roomId);
    await A.page.reload({ waitUntil: 'domcontentloaded' }); await B.page.reload({ waitUntil: 'domcontentloaded' });
    for (const p of [A, B]) await p.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoomUI && window.HansenLadderUI && window.HANSEN_VOCAB_ALL), null, { timeout: 45000 });
    await H.sleep(800);
    const lad = await ladderBoth(A, B, 90000);
    await t.ok(lad.met, `天梯：钟不准的和钟准的 ${lad.secs} 秒内配上（钟不准：${lad.aScr}｜钟准：${lad.bScr}）—— 以前互相看不见、各等到超时`, () => explain());
    await closeAll();
  }

  /* ══ ⑤ 云端读有 5 秒延迟 ═══════════════════════════════════════ */
  t.section('⑤ 云端读有 5 秒延迟（审查 F6）');
  {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, consistencyLagMs: 5000 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    const made = await H.room(A, 'createRoom', { mode: 'C' });
    await t.ok(made && made.ok, `开房成功（${made && (made.ok ? made.roomId : made.reason)}）`, () => explain());
    await H.roomWait(A, made.roomId);
    await H.sleep(12000);
    const evs = await A.eval(() => (window.__hsnEv || []).slice());
    await t.ok(!evs.some((e) => e.gone), `房主等了 12 秒：没有误报「房间已经不在了」（事件：${JSON.stringify(evs.map((e) => Object.keys(e).join('/')))}）—— 以前 4 秒就报`, () => explain());
    const lr = await listed(B, made.roomId, 20000);
    const j = await H.room(B, 'joinRoom', made.roomId, {});
    const ev = await H.roomEvent(A, 45000);
    await t.ok(!!lr && j && j.ok && ev && ev.joined, `客人进得去、房主确认得了（客人 ${j && (j.ok ? 'ok' : j.reason)}，房主 ${ev && Object.keys(ev).join(',')}）—— 以前客人等确认超时`, () => explain());
    await closeAll();
  }

  /* ══ ⑥ 一方超时以后另一方才拼对 ════════════════════════════════ */
  for (const mode of ['A', 'B']) {
    t.section(`⑥ ${mode === 'A' ? '抢答赛' : '回合赛'}：房主这一词超时了，客人钟上还剩时间、拼对了（审查 F5/UI-2）`);
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 30, consistencyLagMs: 200 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    const rid = await pairUp(A, B, mode);
    const sk = await H.room(A, 'skipRound', rid, 0);
    await t.ok(sk && sk.ok, `房主第 1 词超时（${JSON.stringify(sk)}）`, () => explain());
    await H.sleep(700);
    const g = await H.room(B, 'claimRound', rid, 0);
    await t.ok(g && g.ok && g.first && g.score === 100, `客人随后拼对：算「先拼对」100 分（${JSON.stringify(g && { first: g.first, score: g.score, winner: g.winner })}）—— 以前${mode === 'A' ? '0 分「超时了」' : '只给 80'}`, () => explain());
    const wins = H.roomDocs(emu).filter((d) => d.kind === 'win' && d.roomId === rid);
    await t.ok(wins.length === 1 && wins[0].winner === 'guest', `超时不写回合文档：这一词只有客人拼对的那一份（${wins.map((d) => d._id + '=' + d.winner).join(', ') || '无'}）`, () => explain());
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
