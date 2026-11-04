#!/usr/bin/env node
/* test_rooms_cloud_v1164.mjs —— 房间对战：公开房、私密房码、回合赛/同步赛打到结算、三人抢一个座位
 *
 * 为什么要有它：「建房不行」在真机上报了很多次，而房间测试一直绿 ——
 *   假传输层允许客人改房主的房间文档、允许两个人 add 同一个 _id，真数据库都不允许。
 *   这里页面/账号/房间/SDK 全是真的，只有腾讯云由 cloudbase_emulator.mjs 按真规矩应答；
 *   两三部手机（浏览器上下文）各登各的账号，用手指点按钮。
 *
 *   ① 公开房 · 同步赛（READONLY · legacy）：开房 → 别人在列表里看到名字和玩法 → 进来 → 打满到结算
 *      （先对 100、后对 60）；本局不计天梯；每人只写自己的文档；没有手机号。
 *   ② 私密房码 · 回合赛（READONLY · rules）：私密房不进公开列表；输错码有人话提示；
 *      输对码进房 → 打满到结算（先对 100、后对 80）。
 *   ③ 三人同时抢一个座位（rules；重复 _id 的报错先用默认文本、再换成 HTTP 500）：
 *      只有一个人进得去；另外两个被告知「被别人占了」、不会被拉进对战；库里只有一个座位文档。
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('房间对战 · 真 SDK 端到端（v1164）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const has = (txt, re) => re.test(String(txt || ''));
let seq = 20;

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
async function openRoom(p, mode, priv) {
  await p.tap(priv ? '#prPriv' : '#prNew');
  await p.tap(`.pr_mode[data-mode="${mode}"]`);
  return p.waitScreen(/等对手进来/, { timeout: 15000 }).catch((e) => e.lastText || '');
}
/* 这个人刚开的那间（最新的；库里可能还躺着他以前的房） */
function hostRoom(p) {
  return H.roomDocs(emu).filter((d) => d.kind === 'room' && d._openid === p.cloudUid && d.status !== 'done')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
}
/* 列表里那间房的「进去打」—— 列表可能晚一两秒才出现（读有延迟），刷新着等 */
async function findRoomButton(p, rid) {
  return H.until(async () => {
    const h = await p.hitTest(`button[data-rid="${rid}"]`, { timeout: 400 });
    if (h.ok) return h;
    await p.tap('#prRef').catch(() => {});
    return null;
  }, { timeout: 15000, interval: 900 });
}
async function playToEnd(host, guest, rid, modeKey, firstShare) {
  const room = H.roomDocs(emu).find((d) => d._id === rid);
  const words = await H.wordsOfRoom(host, room);
  const ok = words.map((w, i) => (H.typeable(w) ? i : -1)).filter((i) => i >= 0);
  const hostFirst = Math.floor(ok.length * firstShare) + 1;
  /* 后拼对的那位比先拼对的慢 2.5 秒 —— 孩子正常的手速，远在每词 15 秒之内 */
  const plan = (i) => { const k = ok.indexOf(i); if (k < 0) return {}; const f = k < hostFirst ? 'host' : 'guest'; return { first: f, second: f === 'host' ? 'guest' : 'host', delayMs: 2500 }; };
  const M = await host.eval((k) => window.HansenPkRoom.modeOf(k), modeKey);
  const exp = H.expectedScores(words, plan, M);
  const run = await H.playMatch({ host, guest }, words, plan);
  await t.ok(!run.wrongCn.length, `${M.name}：每一词屏幕上的中文都对、键盘点得到（${run.wrongCn.slice(0, 3).join('；') || '无问题'}）`);
  /* 🔴v1164：「两人都答完才进下一个词」—— 以前各翻各的，快的那位会领先两三个词，下一词的「抢先」就成了谁领先谁拿 */
  if (M.waitAll) await t.ok(run.maxGap <= 1, `${M.name}：两人一起翻篇，屏幕上的词号最多差 1（实测最多差 ${run.maxGap}）`, () => explain());
  const rH = await H.waitResult(host, 60000), rG = await H.waitResult(guest, 60000);
  const want = exp.host > exp.guest ? ['win', 'lose'] : (exp.host < exp.guest ? ['lose', 'win'] : ['draw', 'draw']);
  await t.ok(rH && rH[want[0]] && rH.mine === exp.host && rH.theirs === exp.guest,
    `${M.name} 房主结算：你 ${exp.host} 分 · 对手 ${exp.guest} 分（看到：${rH ? rH.text.split('\n').slice(0, 2).join(' / ') : '没到结算屏'}）`, () => explain());
  await t.ok(rG && rG[want[1]] && rG.mine === exp.guest && rG.theirs === exp.host,
    `${M.name} 客人结算：你 ${exp.guest} 分 · 对手 ${exp.host} 分（看到：${rG ? rG.text.split('\n').slice(0, 2).join(' / ') : '没到结算屏'}）`, () => explain());
  await t.ok(rH && has(rH.text, /不计天梯/) && rG && has(rG.text, /不计天梯/), `${M.name} 不计天梯分，两边结算屏都说清楚了`);
  return { exp, words, rH, rG };
}
async function ownershipChecks(label, host, guest, rid) {
  await H.sleep(1200);
  const docs = H.roomDocs(emu).filter((d) => String(d._id).startsWith(rid));
  const R = docs.find((d) => d.kind === 'room'), S = docs.find((d) => d.kind === 'seat');
  const W = docs.filter((d) => d.kind === 'win');
  await t.ok(R && R._openid === host.cloudUid && S && S._openid === guest.cloudUid, `${label}：房间是房主建的、座位是客人建的`, () => explain());
  const bad = W.filter((w) => (w.winner === 'host' && w._openid !== host.cloudUid) || (w.winner === 'guest' && w._openid !== guest.cloudUid));
  await t.ok(!bad.length, `${label}：每个回合文档都是拿下那一词的人自己建的（${W.length} 个，不对 ${bad.length}）`, () => explain());
  await t.ok(H.foreignWrites(emu).length === 0, `${label}：没有人去改别人的文档（尝试 ${H.foreignWrites(emu).length} 次）`, () => explain());
  const leaked = H.leakedIdentity(emu, [host.number, guest.number]);
  await t.ok(!leaked.length, `${label}：房间集合里没有手机号（漏了 ${leaked.join(',') || '无'}）`);
}

try {
  /* ══ ① 公开房 · 同步赛 ══════════════════════════════════════════ */
  t.section('① 公开房 · 同步赛 C（READONLY · legacy）');
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 50, jitterMs: 60, consistencyLagMs: 400 } });
  names = {};
  const A = await phone('一', '小蜂一'), B = await phone('二', '小蜂二');
  const recA0 = await H.ladderRecord(A);
  /* 上次没收干净的旧文档（服务端本来就有）：甲自己的旧房、旧座位，还有别人的旧房。
     🔴v1164（审查 F8）：不是这台设备这次建的，要 30 分钟没动才清（另一台手机钟慢时它可能正活着）—— 种 40 分钟前的 */
  const old = Date.now() - 40 * 60000;
  emu.seedDoc('hansen_pk_rooms', { _id: 'roldmine1', proto: 2, kind: 'room', status: 'done', isPrivate: false, mode: 'C', hostId: 'u' + A.cloudUid, hostName: '小蜂一', createdAt: old, heartbeatAt: old, endedAt: old, seat: 0 }, A.cloudUid, 2400000);
  emu.seedDoc('hansen_pk_rooms', { _id: 'roldother1_s0', proto: 2, kind: 'seat', roomId: 'roldother1', epoch: 0, guestId: 'u' + A.cloudUid, guestName: '小蜂一', createdAt: old, guestBeat: old }, A.cloudUid, 2400000);
  emu.seedDoc('hansen_pk_rooms', { _id: 'roldother1', proto: 2, kind: 'room', status: 'done', isPrivate: false, mode: 'C', hostId: 'u1999', hostName: '别人', createdAt: old, heartbeatAt: old, endedAt: old, seat: 0 }, '1999000000000000001', 2400000);
  /* 同账号「另一台设备」上 5 分钟没心跳的房：那台手机钟慢的话它其实还活着 —— 不许删 */
  const fiveMin = Date.now() - 5 * 60000;
  emu.seedDoc('hansen_pk_rooms', { _id: 'rtwinA', proto: 2, kind: 'room', status: 'open', isPrivate: false, mode: 'C', hostId: 'u' + A.cloudUid, hostName: '小蜂一', createdAt: fiveMin, heartbeatAt: fiveMin, seat: 0 }, A.cloudUid, 300000);
  const tSweep = Date.now();
  await toLobby(A);
  let txt = await openRoom(A, 'C', false);
  /* 🔴联机压力测试 R8：别的设备留下的旧文档，第一次清理只记下来，隔 25 秒（真机的 sweepRecheckMs）再看一眼、一点没变才删 ——
     那台手机钟慢 30 分钟以上时，「本机钟看着 40 分钟没动」的文档其实可能正在用（以前当场就删）。
     所以这里从「10 秒内删掉」改成：开头几秒还在（只记了候选），45 秒内删掉（有界），别人的、5 分钟的照样不碰。 */
  await H.sleep(Math.max(0, 5000 - (Date.now() - tSweep)));
  const early = H.roomDocs(emu).map((d) => d._id);
  await t.ok(early.includes('roldmine1') && early.includes('roldother1_s0'),
    `第一次清理只记候选、先不删（开房后 5 秒时还在：${early.filter((x) => /^rold/.test(x)).join(', ')}）—— 别的设备的旧文档要隔一会儿再看一眼（R8）`, () => explain());
  const swept = await H.until(() => { const ids = H.roomDocs(emu).map((d) => d._id); return !ids.includes('roldmine1') && !ids.includes('roldother1_s0') ? ids : null; }, { timeout: 45000, interval: 1000 });
  await t.ok(swept && swept.includes('roldother1') && swept.includes('rtwinA') && H.foreignWrites(emu).length === 0,
    `${Math.round((Date.now() - tSweep) / 1000)} 秒内清掉了自己上次留下的旧房和旧座位（隔一会儿再看一眼、一点没变的），别人的旧房一下没碰，同账号另一台设备 5 分钟没心跳的房也没删（剩下：${H.roomDocs(emu).map((d) => d._id).join(', ')}）`, () => explain());
  await t.ok(has(txt, /等对手进来/) && has(txt, /同步赛/), `开一间同步赛 → 「等对手进来」，并说明开的是什么房（看到：${txt.replace(/\s+/g, ' ').slice(0, 90)}）`, () => explain());
  const RA = hostRoom(A);
  await t.ok(RA && RA.mode === 'C' && RA.isPrivate === false && RA.proto === 2 && RA.hostName === '小蜂一', '数据库：公开、同步赛、新协议、房主名字对', () => explain());
  await toLobby(B);
  const btn = RA ? await findRoomButton(B, RA._id) : null;
  const list = await B.screen();
  await t.ok(btn && has(list, /小蜂一/) && has(list, /同步赛/), `别人在公开列表里看到这间房：房主名字 + 玩法（看到：${list.replace(/\s+/g, ' ').slice(0, 120)}）`, () => explain());
  if (btn) {
    await B.tap(`button[data-rid="${RA._id}"]`);
    const both = await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: 30000 });
    await t.ok(both, '点「进去打」→ 两部手机都进了对战屏', () => explain());
    if (both) {
      const vA = await H.battleView(A), vB = await H.battleView(B);
      await t.ok(vA.oppName === '小蜂二' && vB.oppName === '小蜂一', `对战屏显示对手真名（房主看到「${vA.oppName}」，客人看到「${vB.oppName}」）`, () => explain());
      await playToEnd(A, B, RA._id, 'C', 0.5);
      await ownershipChecks('同步赛', A, B, RA._id);
      const recA1 = await H.ladderRecord(A);
      await t.ok(recA1 && recA0 && recA1.rating === recA0.rating && recA1.total === recA0.total + 1, `同步赛只记战绩不动天梯分（${recA0 && recA0.rating} → ${recA1 && recA1.rating}，场次 +1）`);
    }
  }
  await H.cleanPhones(t, [A, B]);
  await A.close(); await B.close(); live.length = 0;

  /* ══ ② 私密房码 · 回合赛 ════════════════════════════════════════ */
  t.section('② 私密房码 · 回合赛 B（READONLY · rules）');
  emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 60, jitterMs: 60, consistencyLagMs: 500 } });
  names = {};
  const C = await phone('三', '小蜂三'), D = await phone('四', '小蜂四');
  await toLobby(C);
  txt = await openRoom(C, 'B', true);
  const code = ((await C.eval(() => (document.getElementById('prCodeBig') || {}).innerText || '')) || '').trim();
  const RC = hostRoom(C);
  /* 🔴v1164（审查 SEC-7）：码不上云（集合谁都能读），库里只放一个摘要 —— 输码查房、核对凭证都用它 */
  const codeH = await C.eval((c) => window.HansenPkRoom._codeHash(c), code);
  await t.ok(/^[0-9A-Z]{4}$/.test(code) && RC && RC.isPrivate === true && RC.codeH === codeH && !('code' in RC) && RC.mode === 'B',
    `私密回合赛开好了，屏幕上大字显示房间码「${code}」；库里只有它的摘要、没有码本身（库里 ${RC && RC.codeH}）`, () => explain());
  await toLobby(D);
  await H.sleep(2500);
  await D.tap('#prRef').catch(() => {});
  await H.sleep(1500);
  const dl = await D.screen();
  await t.ok(!has(dl, /小蜂三/) && !(await D.hitTest(`button[data-rid="${RC && RC._id}"]`, { timeout: 300 })).ok, '私密房不出现在公开列表里', () => explain());
  await D.tap('details summary');
  await D.tap('#prCode'); await D.type('ZZZZ'); await D.tap('#prJoinCode');
  const wrong = await D.waitScreen(/没找到这间房|码输错|过期/, { timeout: 12000 }).catch((e) => e.lastText || '');
  await t.ok(has(wrong, /没找到这间房|码输错|过期/), `输错码 → 人话提示「没找到这间房」（看到：${wrong.replace(/\s+/g, ' ').slice(0, 100)}）`, () => explain());
  await D.tap('#prCode');
  await D.page.keyboard.press('Control+A'); await D.page.keyboard.press('Backspace');
  await D.type(code.toLowerCase());
  await D.tap('#prJoinCode');
  const both2 = await H.until(async () => (await H.battleView(C)) && (await H.battleView(D)), { timeout: 30000 });
  await t.ok(both2, '输对房间码（小写也行）→ 两部手机都进了对战屏', () => explain());
  if (both2) {
    await playToEnd(C, D, RC._id, 'B', 0.4);
    await ownershipChecks('回合赛', C, D, RC._id);
  }
  await H.cleanPhones(t, [C, D]);
  await C.close(); await D.close(); live.length = 0;

  /* ══ ③ 三人同时抢一个座位 ════════════════════════════════════════ */
  for (const style of ['request_failed', 'http500']) {
    t.section(`③ 三人同时抢一个座位（rules · 重复 _id → ${style === 'http500' ? 'HTTP 500（SDK 只看到 network request error）' : 'DATABASE_REQUEST_FAILED / E11000'}）`);
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 70, jitterMs: 80, consistencyLagMs: 500, duplicateStyle: style } });
    names = {};
    const E = await phone('房主', '小蜂房主');
    const G = [await phone('抢1', '小蜂抢一'), await phone('抢2', '小蜂抢二'), await phone('抢3', '小蜂抢三')];
    await toLobby(E);
    await openRoom(E, 'C', false);
    const RE = hostRoom(E);
    for (const g of G) { await toLobby(g); await findRoomButton(g, RE && RE._id); }
    await Promise.all(G.map((g) => g.tap(`button[data-rid="${RE && RE._id}"]`).catch((e) => e)));
    await H.sleep(1000);
    const settled = await H.until(async () => {
      const inB = []; for (const g of G) if (await H.battleView(g)) inB.push(g);
      const told = G.filter((g) => has((g.dialogs.map((d) => d.message).join(' ')), /占了|抢走|满了/));
      const toldScr = []; for (const g of G) if (has(await g.screen(), /占了|抢走|满了/)) toldScr.push(g);
      const losers = G.filter((g) => !inB.includes(g) && (told.includes(g) || toldScr.includes(g)));
      return (inB.length === 1 && losers.length === 2 && await H.battleView(E)) ? { inB, losers } : null;
    }, { timeout: 30000, interval: 600 });
    await t.ok(settled, '三个人同时点「进去打」→ 只有一个进了对战，另外两个都被告知「这间房刚被别人占了」', () => explain());
    await H.sleep(4000);
    const stillOne = [], dead = []; for (const g of G) { if (!(await H.alive(g))) dead.push(g.name); if (await H.battleView(g)) stillOne.push(g.name); }
    await t.ok(stillOne.length === 1 && !dead.length, `过了几秒也没有第二个人被拉进对战（在对战屏的：${stillOne.join(',') || '无'}；页面都活着${dead.length ? '，挂了：' + dead.join(',') : ''}）`, () => explain());
    const seats = H.roomDocs(emu).filter((d) => d.kind === 'seat' && d.roomId === (RE && RE._id));
    const R2 = H.roomDocs(emu).find((d) => d._id === (RE && RE._id));
    const winner = settled && settled.inB[0];
    await t.ok(seats.length === 1 && winner && seats[0]._openid === winner.cloudUid && R2 && R2.guestId === 'u' + winner.cloudUid,
      `库里只有一个座位文档，就是进去的那个人的；房主确认的也是他（座位 ${seats.length} 个）`, () => explain());
    const dups = emu.log.filter((e) => e.action === 'database.addDocument' && (e.code === 'DATABASE_REQUEST_FAILED' || e.status === 500)).length;
    /* 审查 TI-9：这一段就是为「重复 _id 被拒 → 读回来判定」写的 —— 要真走到那条路 */
    await t.ok(dups > 0, `重复 _id 被数据库拒绝过（${dups} 次）—— 抢座真的撞上了，读回判定那条路走到了`);
    await t.ok(H.foreignWrites(emu).length === 0, `没有人去改别人的文档（尝试 ${H.foreignWrites(emu).length} 次）`, () => explain());
    if (settled) for (const l of settled.losers) {
      const s = await l.screen();
      await t.ok(!has(s, /连不上网络|云端设置/), `[${l.name}] 抢输了说的是「被占了」，不是「连不上网络」（看到：${s.replace(/\s+/g, ' ').slice(0, 80)}）`, () => explain());
    }
    await H.cleanPhones(t, live);
    for (const p of live) await p.close();
    live.length = 0;
  }
} catch (e) {
  await t.ok(false, '测试脚本自己出错：' + String(e && e.stack || e).slice(0, 600), () => explain());
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
