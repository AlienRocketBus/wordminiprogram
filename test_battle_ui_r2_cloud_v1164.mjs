#!/usr/bin/env node
/* test_battle_ui_r2_cloud_v1164.mjs —— 对战屏上「退出」「先离开」、最后一词、谁先进下一词
 *（审查第二轮 R2-UI-4、R2-UI-5、R2-UI-9、R2-UI-10、FX-5、FX-6、FX-10、F-R2-1）
 *
 * 真页面、真界面、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答。两部手机都用字母键盘一个一个点。
 *
 *   ① 抢答赛：刚开打就点「退出」，对话框开着的时候对手拼对了、进了下一词 —— 对话框还在（R2-UI-9）；
 *      点「退出」→ 这一局给退出的孩子记一场输、掉天梯分（R2-UI-4 / FX-6：以前什么都不记，落后了点退出就能保分）；
 *      对手那边是「对手已离场 · 本局你胜」（R2-UI-5：以前多半是「对手刚才没进来，接着帮你找…」，赢了也不算）
 *   ② 回合赛：房主先交卷、点「先离开，结果出来会自动记上」→「先离开」—— 对话框说的是「不影响这一局」；
 *      客人最后一词拼对照样算分（F-R2-1 / FX-5：以前「这一局已经结束了」0 分，平局变输）；
 *      房主不在结算屏，结果出来以后照样记进他的战绩（R2-UI-4：以前点了就什么都没了）
 *   ③ 同步赛：最后一词拼对时网断在半路（这一词「结果待定」）—— 交卷前先定下来，交上去的分里有它（FX-10）
 *   ④ 抢答赛：我超时了、对手在我超时以后才拼对 —— 两边进下一词的时间差不到 1 秒（R2-UI-10：以前我早开拼 1 秒多）
 *   ⑤ 同步赛：一个词拼了 6 秒还没人答完 —— 之后两秒看一次对手，不再每秒一次（R2-5 配额：对战轮询占一个班每天云端调用的八成）
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('对战屏：退出 / 先离开 / 最后一词 / 翻篇时间 · 真界面 + 真 SDK（审查 R2-UI-4/5/9/10、FX-5/6/10）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const flat = (s) => String(s || '').replace(/\s+/g, ' ');
const has = (s, re) => re.test(String(s || ''));
let seq = 10;

async function phone(name, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, { name });
  live.push(p);
  const r = await H.loginPhone(p, '136000000' + (seq++));
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.nick = nick; p.key = 'u' + r.uid; p.uid = r.uid;
  return p;
}
async function closeAll() {
  await H.cleanPhones(t, live);
  for (const p of live) await p.close();
  live.length = 0;
}
async function toLobby(p) {
  await p.tap('#pkRooms');
  await H.answerNameIfAsked(p, p.nick);
  await p.waitScreen(/公开房间/, { timeout: 10000 });
}
const liveRooms = (p) => H.roomDocs(emu).filter((d) => d.kind === 'room' && d.hostId === p.key && (d.status === 'open' || d.status === 'away'));
/* 房主在公开房间开一间（选玩法），客人在列表里点「进去打」；两边都到了对战屏 → 这一局的词 */
async function freeMatch(hp, gp, mode) {
  await toLobby(hp);
  await hp.tap('#prNew');
  await hp.tap(`.pr_mode[data-mode="${mode}"]`);
  await hp.waitScreen(/等对手进来/, { timeout: 15000 });
  const rm = liveRooms(hp)[0];
  await toLobby(gp);
  const sel = `#prList button[data-rid="${rm._id}"]`;
  const row = await H.until(async () => {
    if ((await gp.hitTest(sel, { timeout: 300 })).ok) return true;
    try { await gp.tap('#prRef', { timeout: 1000 }); } catch (e) { /* 刷新按钮这一下点不到 */ }
    await H.sleep(1200);
    return null;
  }, { timeout: 25000 });
  if (row) await gp.tap(sel);
  const both = await H.until(async () => (await H.battleView(hp)) && (await H.battleView(gp)), { timeout: 30000 });
  const room = H.roomDocs(emu).find((d) => d._id === rm._id);
  const words = room ? await H.wordsOfRoom(hp, room) : [];
  await t.ok(!!both && words.length === 10, `两边都进了对战屏（${mode} · ${words.length} 个词）`, () => explain());
  return { rid: rm._id, room, words };
}
const quitUp = (p) => p.eval(() => { const d = document.getElementById('prQuitAsk'); return d && d.getClientRects().length ? d.innerText : ''; });
/* 每一段各管各的：前一段出错不连累后面几段 */
async function part(title, fn) {
  /* 只跑某几段（排查用）：R2_ONLY=①,③ node 这个文件 */
  const only = String(process.env.R2_ONLY || '').split(',').filter(Boolean);
  if (only.length && !only.some((x) => title.startsWith(x))) return;
  t.section(title);
  try { await fn(); }
  catch (e) { await t.ok(false, '这一段脚本出错：' + String(e && e.stack || e).slice(0, 500), () => explain()); }
  try { await closeAll(); } catch (e) { /* 已关 */ }
}

{
  /* ══ ① 抢答赛中途退出 ══════════════════════════════════════════ */
  await part('① 抢答赛：对话框开着时对手拼对进了下一词（R2-UI-9）；退出 = 记一场输（R2-UI-4/FX-6）；对手是「本局你胜」（R2-UI-5）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 20 } });
  names = {};
  const K = await phone('甲', '小蜂甲');
  const G = await phone('乙', '小蜂乙');
  /* 甲已经定级、1150 分（工蜂，段位地板 1000）—— 输一局就该掉分 */
  await K.eval(() => { localStorage.setItem('hansen_pk_record_v1', JSON.stringify({ rating: 1150, peakRating: 1150, placementGames: 3, wins: 2, losses: 1, draws: 0, history: [] })); return true; });
  const m1 = await freeMatch(K, G, 'A');
  const recK0 = await H.ladderRecord(K);
  /* 甲刚开打就点「退出」，正在读对话框 */
  await K.tap('#prQuit');
  const ask1 = await quitUp(K);
  await t.ok(has(ask1, /要退出这一局吗/) && has(ask1, /记一场输/), `「退出」的对话框说清楚：退出就记一场输（看到：${flat(ask1).slice(0, 60)}）`, () => explain());
  /* 这时候乙拼对了第 1 词，两边进第 2 词 */
  await H.typeWord(G, m1.words[0].en);
  const k2 = await H.until(async () => { const v = await H.battleView(K); return v && v.round >= 1 ? v : null; }, { timeout: 12000 });
  await H.sleep(600);
  const ask2 = await quitUp(K);
  await t.ok(!!k2 && has(ask2, /要退出这一局吗/), `对手拼对、甲这边已经到了第 ${k2 ? k2.round + 1 : '?'} 词：对话框还在（${ask2 ? '还在' : '不见了'}）—— 以前下一词一画屏它就没了，孩子点的「退出」悄悄丢了`, () => explain());
  await K.tap('#prQuitYes');
  await H.sleep(1500);
  const recK = await H.ladderRecord(K);
  await t.ok(recK && recK0 && recK.losses === recK0.losses + 1 && recK.total === recK0.total + 1 && recK.rating < recK0.rating,
    `甲退出：这一局记了一场输、天梯分降了（之前 ${recK0 && recK0.rating} 分 ${recK0 && recK0.losses} 负 → 现在 ${recK && recK.rating} 分 ${recK && recK.losses} 负）`, () => explain());
  const resG = await H.waitResult(G, 90000);
  const gScr = resG ? resG.text : await G.screen();
  await t.ok(resG && resG.win && !has(gScr, /没进来/), `乙这边：「本局你胜」，没说成「对手刚才没进来」（看到：${flat(gScr).slice(0, 100)}）`, () => explain());
  const recG = await H.until(async () => { const r = await H.ladderRecord(G); return r && r.wins >= 1 ? r : null; }, { timeout: 20000, interval: 500 }) || await H.ladderRecord(G);
  await t.ok(recG && recG.wins === 1, `乙的战绩记了一场胜（${recG && recG.wins} 胜）`, () => explain());
  });

  /* ══ ② 回合赛：交了卷先离开 ═══════════════════════════════════════ */
  await part('② 回合赛：房主交了卷「先离开」——客人最后一词照样算分（F-R2-1/FX-5），房主的战绩结果出来照样记上（R2-UI-4）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 20 } });
  names = {};
  const Mh = await phone('丙', '小蜂丙');
  const Ng = await phone('丁', '小蜂丁');
  const m2 = await freeMatch(Mh, Ng, 'B');
  /* 前 9 词：轮流先拼对（先对 100、后对 80）；最后一词房主先拼对，客人慢一点 */
  const plan2 = (i) => (i % 2 === 0 ? { first: 'guest', second: 'host', delayMs: 700 } : { first: 'host', second: 'guest', delayMs: 700 });
  /* 最后一词不交给 playMatch（它看到谁先到第 10 词就替谁拼了）—— 下面手动按剧本拼 */
  const pm = await H.playMatch({ host: Mh, guest: Ng }, m2.words, (i) => (i >= 9 ? {} : plan2(i)), { stopAt: 9, timeout: 150000 });
  await t.ok(!pm.wrongCn.length, `前 9 词两边都拼了（${pm.wrongCn.slice(0, 2).join('；') || '没出错'}）`, () => explain());
  const vH = await H.battleView(Mh), vG = await H.battleView(Ng);
  await H.typeWord(Mh, m2.words[9].en);
  const handed = await Mh.waitScreen(/交卷了/, { timeout: 15000 }).catch((e) => e.lastText || '');
  await t.ok(has(handed, /交卷了/) && has(handed, /先离开，结果出来会自动记上/), `房主交卷了：按钮写的是「先离开，结果出来会自动记上」（看到：${flat(handed).slice(0, 90)}）`, () => explain());
  await Mh.tap('#prQuit');
  const ask3 = await quitUp(Mh);
  await t.ok(has(ask3, /不影响这一局/) && !has(ask3, /就算对手赢/), `对话框说的是「你已经交卷了，现在离开不影响这一局」，不是「就算对手赢」（看到：${flat(ask3).slice(0, 70)}）`, () => explain());
  const recM0 = await H.ladderRecord(Mh);
  await Mh.tap('#prQuitYes');
  await H.sleep(1500);
  /* 客人这时才拼对最后一词 */
  await H.typeWord(Ng, m2.words[9].en);
  const expect = { host: 0, guest: 0 };
  for (let i = 0; i < 10; i++) { const p = i === 9 ? { first: 'host', second: 'guest' } : plan2(i); expect[p.first] += 100; expect[p.second] += 80; }
  const resN = await H.waitResult(Ng, 90000);
  const nScr = resN ? resN.text : await Ng.screen();
  await t.ok(resN && resN.mine === expect.guest && resN.theirs === expect.host && resN.draw,
    `客人最后一词照样算分：${resN && resN.mine} : ${resN && resN.theirs}（应是 ${expect.guest} : ${expect.host}，打平）—— 以前「这一局已经结束了」，平局变输（看到：${flat(nScr).slice(0, 90)}）`, () => explain(`第 9 词前：房主 ${vH && vH.my}，客人 ${vG && vG.my}`));
  await t.ok(!pm.wrongCn.some((x) => /已经结束/.test(x)) && !has(nScr, /这一局已经结束了/), '客人那边没出现「这一局已经结束了」', () => explain());
  const recM = await H.until(async () => { const r = await H.ladderRecord(Mh); return r && recM0 && r.total === recM0.total + 1 ? r : null; }, { timeout: 40000, interval: 1000 });
  await t.ok(!!recM && recM.losses === recM0.losses, `房主先离开了，结果出来以后照样记进他的战绩（之前 ${recM0 && recM0.total} 局 → ${recM ? recM.total : '没记上'} 局；平局不记输）`, () => explain());
  });

  /* ══ ③ 同步赛：最后一词「结果待定」 ═════════════════════════════════ */
  await part('③ 同步赛：最后一词拼对时网断在半路 —— 交卷前先把它定下来（FX-10）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 20 } });
  names = {};
  const Ph = await phone('戊', '小蜂戊');
  const Qg = await phone('己', '小蜂己');
  const m3 = await freeMatch(Ph, Qg, 'C');
  const plan3 = () => ({ first: 'guest', second: 'host', delayMs: 700 });
  await H.playMatch({ host: Ph, guest: Qg }, m3.words, (i) => (i >= 9 ? {} : plan3(i)), { stopAt: 9, timeout: 150000 });
  const before9 = await H.battleView(Qg);
  /* 客人最后一词：回合文档写进去了、回包丢了；接下来几秒客人什么都读不到 */
  const lost = emu.fault({ uid: Qg.uid, db: true, action: 'database.addDocument', collection: 'hansen_pk_rooms', do: 'commitThenAbort', times: 1 });
  /* 回包丢了以后（那条已经落库），客人接下来几秒什么都读不到 —— 读回来认不出是自己写的，只能「结果待定」 */
  const noRead = emu.fault({ uid: Qg.uid, db: true, action: 'database.queryDocument', do: 'abort', test: () => lost.hits > 0 });
  await H.typeWord(Qg, m3.words[9].en);
  await H.sleep(900);
  await H.typeWord(Ph, m3.words[9].en);
  const pend = await Qg.waitScreen(/正在确认最后一词的分|分数马上补上/, { timeout: 25000 }).catch((e) => e.lastText || '');
  noRead.remove();
  const wantGuest = (before9 ? before9.my : 0) + 100;
  const resQ = await H.waitResult(Qg, 60000);
  const resP = await H.waitResult(Ph, 60000);
  await t.ok(has(pend, /正在确认最后一词的分|分数马上补上/), `最后一词「结果待定」（看到：${flat(pend).slice(0, 70)}）`, () => explain());
  await t.ok(resQ && resQ.mine === wantGuest && resP && resP.theirs === wantGuest,
    `交上去的分里有最后一词的 100：客人结算 ${resQ && resQ.mine}、房主那边看到客人 ${resP && resP.theirs}（应是 ${wantGuest}）`, () => explain());
  });

  /* ══ ④ 抢答赛：我超时以后对手才拼对 ═══════════════════════════════ */
  await part('④ 抢答赛：我超时了、对手在我超时以后才拼对 —— 两边差不多同时进下一词（R2-UI-10）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
  names = {};
  const Xh = await phone('庚', '小蜂庚');
  const Yg = await phone('辛', '小蜂辛');
  const m4 = await freeMatch(Xh, Yg, 'A');
  const clockOf = async (p) => { const v = await p.eval(() => ((document.getElementById('prClock') || {}).textContent || '')); const m = /(\d+)\s*s/.exec(String(v)); return m ? Number(m[1]) : null; };
  await H.until(async () => { const c = await clockOf(Xh); return c != null && c <= 3 ? true : null; }, { timeout: 30000, interval: 100 });
  const holdAdd = emu.hold({ uid: Yg.uid, db: true, action: 'database.addDocument' });
  await H.typeWord(Yg, m4.words[0].en);
  const tOut = await Xh.waitScreen(/超时了/, { timeout: 8000, interval: 80 }).catch(() => '');
  await H.sleep(1000);
  holdAdd.release();
  const seen2 = {};
  const t0 = Date.now();
  while (Date.now() - t0 < 15000 && !(seen2.host && seen2.guest)) {
    const [vx, vy] = await Promise.all([H.battleView(Xh), H.battleView(Yg)]);
    if (!seen2.host && vx && vx.round >= 1) seen2.host = Date.now();
    if (!seen2.guest && vy && vy.round >= 1) seen2.guest = Date.now();
    await H.sleep(40);
  }
  const gap = seen2.host && seen2.guest ? seen2.host - seen2.guest : null;
  await t.ok(has(tOut, /超时了/), '房主这一词超时了（客人的回合文档还没落库）', () => explain());
  await t.ok(gap != null && Math.abs(gap) < 1000, `两边进第 2 词的时间差 ${gap} 毫秒（负数 = 超时的那位先进）—— 以前超时的那位早开拼 1 秒多`, () => explain());
  });

  /* ══ ⑤ 同步赛：一个词拼得慢时少查几次 ═══════════════════════════════ */
  await part('⑤ 同步赛：一个词 6 秒以后两秒看一次对手（R2-5 配额）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    names = {};
    const Ah = await phone('壬', '小蜂壬');
    const Bg = await phone('癸', '小蜂癸');
    await freeMatch(Ah, Bg, 'C');
    const t0 = Date.now();
    const q = (p, a, b) => emu.log.filter((x) => x.uid === p.uid && x.collection === 'hansen_pk_rooms' && x.action === 'database.queryDocument' && x.t >= a && x.t < b).length;
    await H.sleep(13500);
    const early = q(Bg, t0 + 500, t0 + 5500), late = q(Bg, t0 + 7000, t0 + 13000);
    const v = await H.battleView(Bg);
    await t.ok(v && v.round === 0, `两个人都还在第 1 词、都没答（${v ? '第 ' + (v.round + 1) + ' 词' : '不在对战屏'}）`, () => explain());
    await t.ok(early >= 3, `前 5 秒每秒看一次对手（查了 ${early} 次）`, () => explain());
    await t.ok(late <= 4, `6 秒以后两秒看一次（7~13 秒这 6 秒查了 ${late} 次；以前 6 次左右）`, () => explain());
  });

  /* ══ ⑥ 对手根本没进来：退出对话框不留在列表上 ═══════════════════════════ */
  await part('⑥ 对战屏点开「退出」时对手根本没进来 → 回到列表：对话框收掉、不多记一场输（审查 R3 minor-3）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    names = {};
    const K = await phone('子', '小蜂子');
    const G = await phone('丑', '小蜂丑');
    await toLobby(K);
    await K.tap('#prNew');
    await K.tap('.pr_mode[data-mode="A"]');
    await K.waitScreen(/等对手进来/, { timeout: 15000 });
    const rm = liveRooms(K)[0];
    const recK0 = await H.ladderRecord(K);
    /* 丑只在数据层占了座位、房主点了头 —— 他没进对战屏（没报到、没拼过词），接着就走了 */
    const j = await G.eval(async (rid) => { const r = await window.HansenPkRoom.joinRoom(rid); return { ok: !!(r && r.ok), why: String((r && (r.reason || r.kind)) || '') }; }, rm && rm._id);
    await t.ok(j && j.ok, `丑占到了座位、房主点了头（${JSON.stringify(j)}）`, () => explain());
    const inB = await H.until(async () => H.battleView(K), { timeout: 20000 });
    await t.ok(!!inB, '房主子进了对战屏', () => explain());
    await K.tap('#prQuit');
    const ask = await quitUp(K);
    await t.ok(has(ask, /要退出这一局吗/) && has(ask, /记一场输/), `子点了「退出」，正在读对话框（${flat(ask).slice(0, 40)}）`, () => explain());
    await G.eval(async (rid) => { await window.HansenPkRoom.leaveRoom(rid); return true; }, rm._id);
    const back = await K.waitScreen(/没进来/, { timeout: 60000, all: true }).catch((e) => e.lastText || '');
    await t.ok(has(back, /没进来/), `对手没进来 → 子回到了房间列表（看到：${(() => { const f = flat(back), i = f.indexOf('没进来'); return i < 0 ? f.slice(0, 40) : f.slice(Math.max(0, i - 8), i + 16); })()}）`, () => explain());
    await H.sleep(800);
    const ask2 = await quitUp(K);
    await t.ok(!ask2, `回到列表以后，「要退出这一局吗？…记一场输」不再盖在列表上（${ask2 ? '还在：' + flat(ask2).slice(0, 40) : '已收掉'}）`, () => explain());
    const recK = await H.ladderRecord(K);
    await t.ok(recK && recK0 && recK.losses === recK0.losses && recK.total === recK0.total,
      `没打成的这一局不记输赢（之前 ${recK0 && recK0.total} 局 ${recK0 && recK0.losses} 负 → 现在 ${recK && recK.total} 局 ${recK && recK.losses} 负）`, () => explain());
  });
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
