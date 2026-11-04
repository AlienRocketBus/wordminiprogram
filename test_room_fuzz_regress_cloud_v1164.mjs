#!/usr/bin/env node
/* test_room_fuzz_regress_cloud_v1164.mjs —— 联机压力测试（test_pk_room_fuzz_v1164.mjs）找出来的界面问题，在**真页面**上各复现一次
 *
 * 压力测试的界面那一层是照着代码手抄的模型（数据层是真代码）—— 模型对不对，最后要真页面说了算。
 * 这里一行 App 代码都不换：spelling_pk.html、账号、房间模块、对战界面、vendor SDK 全是真的；
 * 腾讯云由 cloudbase_emulator.mjs 按真规矩应答，只靠它的故障注入（某部手机断网 / 写不进去 / 读被扣住）造出那个时刻。
 * 每一段在修之前的代码上都会红（R2 在 3b6bbd7 上红；其余在 56b8146 上红），修好以后绿。
 *
 *   ① R2  点「进去打」→ 马上「取消」→ 再点同一间：以前取消掉的那一次也进成了，收尾时把正在打的这一局的座位标成「离开」，
 *         几秒后房主「对手已离场，你赢了」、客人「你离开太久」（两部手机都在线）。
 *   ② R3  对手掉线、我这边判他离场的那一条又写不进去（网也断了）：以前照样显示「你赢了」—— 对手回来后也判我离场，两边都赢。
 *         现在写上了才算赢，写不上说「这一局的结果没拿到」。
 *   ③ R4  最后一词拼对时正好断网（结果待定），交卷时网还没好：以前 8 秒一到就按少了这一词的分交（或者干脆交不上）。
 *         现在网通了先把这一词补上再交（最多等 60 秒）。
 *   ④ R10 房主点了头就卡住了（一直没进对战屏），客人一个人打完 —— 房主后来关了页面：以前客人「你赢了（对手已离场）」，
 *         白送一局胜。现在：对手根本没进来，这局不算。
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('联机压力测试找到的界面问题 · 真页面回归（R2 / R3 / R4 / R10）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {}, seq = 70;
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const has = (txt, re) => re.test(String(txt || ''));

async function phone(name, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, { name });
  live.push(p);
  const r = await H.loginPhone(p, '137000000' + (seq++));
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.nick = nick;
  return p;
}
async function closeAll() { await H.cleanPhones(t, live); for (const p of live) await p.close(); live.length = 0; }
async function toLobby(p) {
  await p.tap('#pkRooms');
  await H.answerNameIfAsked(p, p.nick);
  await p.waitScreen(/开一间/, { timeout: 8000 });
}
async function openRoom(p, mode) {
  await p.tap('#prNew');
  await p.tap(`.pr_mode[data-mode="${mode}"]`);
  await p.waitScreen(/等对手进来/, { timeout: 15000 });
  return H.until(() => H.roomDocs(emu).filter((d) => d.kind === 'room' && d._openid === p.cloudUid && d.status === 'open')[0] || null, { timeout: 8000 });
}
async function tapRoom(p, rid) {
  const h = await H.until(async () => {
    const x = await p.hitTest(`button[data-rid="${rid}"]`, { timeout: 400 });
    if (x.ok) return x;
    await p.tap('#prRef').catch(() => {});
    return null;
  }, { timeout: 15000, interval: 900 });
  if (!h) throw new Error(`[${p.name}] 列表里一直没看到这间房`);
  await p.tap(`button[data-rid="${rid}"]`);
}
const roomDoc = (rid) => H.roomDocs(emu).find((d) => d._id === rid);
const seatsOf = (rid, p) => H.roomDocs(emu).filter((d) => d.kind === 'seat' && d.roomId === rid && d._openid === p.cloudUid);
async function inBattle(p, ms) { return H.until(async () => (await H.battleView(p)) ? true : null, { timeout: ms, interval: 400 }); }
/* 一个孩子把出现的每个拼得出来的词都拼上（直到离开对战屏）；before(round) 在拼某一词之前调 */
async function playSolo(p, words, { before, ms = 200000 } = {}) {
  const typed = new Set(); const t0 = Date.now(); let seen = false;
  while (Date.now() - t0 < ms) {
    const v = await H.battleView(p);
    if (!v) { if (seen) break; await H.sleep(300); continue; }
    seen = true;
    const w = words[v.round];
    if (v.round >= 0 && !v.disabled && H.typeable(w) && !typed.has(v.round)) {
      typed.add(v.round);
      if (before) await before(v.round);
      await H.typeWord(p, w.en).catch(() => {});
    }
    await H.sleep(150);
  }
  return typed;
}
/* REGRESS_ONLY=R3,R10 只跑其中几段（排查用；默认全跑） */
const ONLY = String(process.env.REGRESS_ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
const TXT_ABANDON = /对手已离场|离开太久|判给了对手|没收到你的回应|这一局没开成/;

try {
  /* ══ ① R2 · 进房 → 取消 → 马上再点同一间 ═══════════════════════════ */
  if (want('R2')) {
    t.section('① R2 · 点进房、马上取消、再点同一间：两部手机都在线，谁都不该被判「离场」');
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    await toLobby(A); const R0 = await openRoom(A, 'A'); const rid = R0._id;
    await toLobby(B);
    /* 客人读这间房的请求先扣住一会儿：第一次进房正停在「等房主确认」的那一读上时，孩子点了取消、又点了一次 */
    let holdOn = false;
    const hold = emu.hold({ uid: B.cloudUid, db: true, action: 'database.queryDocument',
      test: (c) => holdOn && !!(c.body && c.body.query && c.body.query._id === rid) });
    /* 房主这几秒也先别读（不然他抢在取消之前就给第一次进房点了头 —— 那是另一条路，这里要测的是「取消 + 再点」） */
    let holdHost = false;
    const holdA = emu.hold({ uid: A.cloudUid, db: true, action: 'database.queryDocument', test: () => holdHost });
    holdHost = true;
    await tapRoom(B, rid);
    const s1 = await H.until(() => seatsOf(rid, B)[0] || null, { timeout: 15000 });
    holdOn = true;
    await H.sleep(600);
    await B.tap('#prJoinCancel');
    await tapRoom(B, rid);
    await H.sleep(2000);
    holdOn = false; holdHost = false; hold.release(); holdA.release();
    await t.ok(!!s1, '客人第一次点进去，占到了座位（然后马上点了取消、又点了一次同一间）', () => explain());
    const both = await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)) ? true : null, { timeout: 30000, interval: 500 });
    /* 进了对战屏以后看 25 秒：谁都不该收到「离场 / 判给了对手 / 没收到你的回应」 */
    let bad = '', leftSeat = null;
    for (let i = 0; i < 25 && !bad; i++) {
      const a = await A.screen(), b = await B.screen();
      if (TXT_ABANDON.test(a)) bad = '房主：' + a.replace(/\s+/g, ' ').slice(0, 80);
      else if (TXT_ABANDON.test(b)) bad = '客人：' + b.replace(/\s+/g, ' ').slice(0, 80);
      const R = roomDoc(rid);
      const S = R && R.guestId && seatsOf(rid, B).find((x) => Number(x.epoch) === Number(R.seat));
      if (S && S.left) leftSeat = S;
      await H.sleep(1000);
    }
    await t.ok(both && !bad && !leftSeat,
      `两部手机进了对战、25 秒里没人被判离场，客人正在用的座位没被标成「离开」（${both ? '都进了对战' : '没都进对战'}${bad ? '；' + bad : ''}${leftSeat ? '；座位被标了 left' : ''}）`, () => explain());
    await closeAll();
  }

  /* ══ ② R3 · 判对手离场那一条写不进去 ═════════════════════════════ */
  if (want('R3')) {
    t.section('② R3 · 对手掉线、我这边判他离场那一条写不进去：不能显示「你赢了」');
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    await toLobby(A); const rid = (await openRoom(A, 'A'))._id;
    await toLobby(B); await tapRoom(B, rid);
    const both = await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)) ? true : null, { timeout: 30000, interval: 500 });
    await t.ok(both, '两边都进了对战屏', () => explain());
    await H.sleep(3000);   /* 房主看到了客人报到（客人确实进来了） */
    emu.fault({ uid: A.cloudUid, db: true, action: 'database.updateDocument', do: 'abort' });   /* 房主写什么都写不进去 */
    await B.kill();                                                                             /* 客人掉线 */
    const end = await H.until(async () => { const s = await A.screen(); return /你赢了|本局你胜|结果没拿到|对手刚才没进来/.test(s) ? s : null; }, { timeout: 200000, interval: 1000 });
    const R = roomDoc(rid);
    const claimed = !!(R && (R.abandonWin === 'host' || R.abandonWin === 'both'));
    await t.ok(!!end && !(has(end, /你赢了|本局你胜/) && !claimed),
      `判离场没写上，就不显示「你赢了」（看到：${end ? end.replace(/\s+/g, ' ').slice(0, 70) : '200 秒没结论'}；库里判离场 ${claimed ? '写上了' : '没写上'}）`, () => explain());
    await closeAll();
  }

  /* ══ ③ R4 · 最后一词结果待定、交卷时还断着网 ═══════════════════════ */
  if (want('R4')) {
    t.section('③ R4 · 最后一词拼对时断网 20 秒：网通了先把这一词的分补上再交卷');
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    await toLobby(A); const rid = (await openRoom(A, 'A'))._id;
    await toLobby(B); await tapRoom(B, rid);
    await t.ok(await inBattle(A, 30000) && await inBattle(B, 30000), '两边都进了对战屏', () => explain());
    const words = await H.wordsOfRoom(A, roomDoc(rid));
    const ok = words.map((w, i) => (H.typeable(w) ? i : -1)).filter((i) => i >= 0);
    const last = ok[ok.length - 1];
    const M = await A.eval(() => window.HansenPkRoom.modeOf('A'));
    let off = null;
    /* 房主把每个拼得出来的词都先拼对（客人一个不拼）；拼最后一词的那一刻断网 20 秒 */
    const typed = await playSolo(A, words, { before: async (r) => {
      if (r !== last) return;
      off = emu.fault({ uid: A.cloudUid, db: true, do: 'abort' });
      setTimeout(() => off.remove(), 20000);
    } });
    const want = typed.size * M.firstScore;
    const rA = await H.waitResult(A, 120000);
    await t.ok(typed.has(last) && rA && rA.mine === want,
      `房主结算：${want} 分（含断网时拼对的最后一词）（看到：${rA ? rA.text.split('\n').slice(0, 2).join(' / ') : (await A.screen()).replace(/\s+/g, ' ').slice(0, 80)}）`, () => explain());
    await closeAll();
  }

  /* ══ ④ R10 · 房主点了头却一直没进对战 ═════════════════════════════ */
  if (want('R10')) {
    t.section('④ R10 · 房主点了头就卡住了、后来关了页面：一个人打完的客人不能白得一局胜');
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    await toLobby(A); const rid = (await openRoom(A, 'A'))._id;
    /* 房主写下「客人是谁」之后，他的读请求全卡住（心跳照常）：他再也看不到客人「回话」，一直停在等人屏 */
    const hold = emu.hold({ uid: A.cloudUid, db: true, action: 'database.queryDocument', test: () => { const R = roomDoc(rid); return !!(R && R.guestId); } });
    await toLobby(B); await tapRoom(B, rid);
    await t.ok(await inBattle(B, 40000), '客人进了对战屏（房主那边其实没进来）', () => explain());
    const words = await H.wordsOfRoom(B, roomDoc(rid));
    await playSolo(B, words);
    await B.waitScreen(/交卷了|正在等对手交卷/, { timeout: 60000 }).catch(() => {});
    const R1 = roomDoc(rid);
    await t.ok(R1 && !R1.hostReady && !(Number(R1.hostAns) >= 0), '房主一直没进对战屏（没报到、没答过词）', () => explain());
    await A.close();   /* 房主关了页面：房间标成「房主走了」 */
    const end = await H.until(async () => { const s = await B.screen(); return /你赢了|本局你胜|这局输了|打平|对手刚才没进来|结果没拿到/.test(s) ? s : null; }, { timeout: 60000, interval: 800 });
    hold.release();
    await t.ok(!!end && !has(end, /你赢了|本局你胜/),
      `客人不会因为「对手离场」白得一局胜（看到：${end ? end.replace(/\s+/g, ' ').slice(0, 70) : '60 秒没结论'}）`, () => explain());
    live.splice(live.indexOf(A), 1);
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
