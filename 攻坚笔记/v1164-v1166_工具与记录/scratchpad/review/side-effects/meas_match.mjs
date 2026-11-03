/* 一局对战每部手机读写多少次：天梯（A 抢答）/ 公开房 B / C；每个阶段单独数 */
import { H, tally, fmt, timeline } from './meas_lib.mjs';
const MODE = process.env.MODE || 'A';            // A = 天梯排位；B/C = 公开房
const HOSTWAIT = Number(process.env.HOSTWAIT || 45) * 1000;   // 房主一个人干等多久再让客人来
const PACE = Number(process.env.PACE || 5000);  // 先拼的那位看到词后多久开始拼（孩子的手速）
const LAT = Number(process.env.LAT || 60);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: process.env.PERM || 'legacy', latencyMs: LAT, jitterMs: Number(process.env.JIT || 60), consistencyLagMs: 400 } });
if (Number(process.env.FAULT || 0) > 0) { let n = 0; emu.fault({ db: true, do: 'abort', test: () => (++n % Math.round(1 / Number(process.env.FAULT))) === 0 }); }
const PK_READY = () => !!(window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI && window.HansenLadderUI && window.HansenSbProfile && window.HANSEN_VOCAB_ALL);
let seq = 70;
async function phone(name, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, { name, ready: PK_READY });
  const r = await H.loginPhone(p, '137000000' + (seq++));
  await p.eval(async (n) => {
    window.HansenSbProfile.setName(n);
    for (let i = 0; i < 60 && !(window.HansenSbProfile.readProfile() || {}).cid; i++) await new Promise((z) => setTimeout(z, 250));
  }, nick);
  p.nick = nick;
  if (!(r && r.ok)) console.log('login fail', JSON.stringify(r));
  await p.page.reload({ waitUntil: 'domcontentloaded' });
  await p.page.waitForFunction(PK_READY, null, { timeout: 45000 });
  await H.sleep(4000);
  return p;
}
/* playMatch 的变体：先拼的那位等 PACE 毫秒再拼（真孩子的速度），后拼的再晚 2.5 秒 */
async function play(players, words, plan, timeout = 400000) {
  const typed = { host: new Set(), guest: new Set() }, seenAt = { host: {}, guest: {} }, doneAt = {};
  const t0 = Date.now(); let last = { host: null, guest: null };
  while (Date.now() - t0 < timeout) {
    const v = {};
    for (const s of ['host', 'guest']) v[s] = await H.battleView(players[s]);
    if (!v.host && !v.guest && (last.host || last.guest)) break;
    for (const s of ['host', 'guest']) {
      const x = v[s]; if (x) last[s] = x;
      if (!x || x.round < 0 || x.disabled) continue;
      const w = words[x.round];
      if (!w || !H.typeable(w) || typed[s].has(x.round)) continue;
      if (!seenAt[s][x.round]) seenAt[s][x.round] = Date.now();
      const p = plan(x.round) || {};
      const go = (p.first === s && Date.now() - seenAt[s][x.round] >= PACE) ||
                 (p.second === s && doneAt[x.round] && Date.now() - doneAt[x.round] >= 2500);
      if (!go) continue;
      typed[s].add(x.round);
      try { await H.typeWord(players[s], w.en); } catch (e) { console.log('type fail', s, x.round, e.message.slice(0, 80)); }
      if (p.first === s) doneAt[x.round] = Date.now();
    }
    await H.sleep(150);
  }
  return Date.now() - t0;
}
function report(label, p, t0, t1) {
  const secs = Math.max(1, (t1 - t0) / 1000);
  const t = tally(emu, { uid: p.cloudUid, t0, t1 });
  console.log(`\n--- ${label} · ${p.name}（${secs.toFixed(0)} 秒）`);
  console.log(fmt(t, secs));
  return t;
}
const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
const T = {};
if (MODE === 'A') {
  await A.tap('#pkLadder'); await H.answerNameIfAsked(A, A.nick); await A.waitScreen(/开始排位/, { timeout: 8000 });
  T.aGo = Date.now(); await A.tap('#ldGo');
  await A.waitScreen(/等对手进来/, { timeout: 60000 }); T.aHost = Date.now();
  await H.sleep(HOSTWAIT); T.bGo0 = Date.now();
  await B.tap('#pkLadder'); await H.answerNameIfAsked(B, B.nick); await B.waitScreen(/开始排位/, { timeout: 8000 });
  T.bGo = Date.now(); await B.tap('#ldGo');
} else {
  await A.tap('#pkRooms'); await H.answerNameIfAsked(A, A.nick); await A.waitScreen(/开一间/, { timeout: 8000 });
  T.aGo = Date.now(); await A.tap('#prNew'); await A.tap(`.pr_mode[data-mode="${MODE}"]`);
  await A.waitScreen(/等对手进来/, { timeout: 15000 }); T.aHost = Date.now();
  await H.sleep(HOSTWAIT); T.bGo0 = Date.now();
  await B.tap('#pkRooms'); await H.answerNameIfAsked(B, B.nick); await B.waitScreen(/开一间/, { timeout: 8000 });
  T.bGo = Date.now();
  const rid = (H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid && d.status === 'open') || {})._id;
  await H.until(async () => { const h = await B.hitTest(`button[data-rid="${rid}"]`, { timeout: 400 }); if (h.ok) return h; await B.tap('#prRef').catch(() => {}); return null; }, { timeout: 20000, interval: 900 });
  await B.tap(`button[data-rid="${rid}"]`);
}
await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: 60000, interval: 300 });
T.battle = Date.now();
const room = H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid && d.status !== 'done');
const words = await H.wordsOfRoom(A, room);
const ok = words.map((w, i) => (H.typeable(w) ? i : -1)).filter((i) => i >= 0);
const plan = (i) => { const k = ok.indexOf(i); if (k < 0) return {}; const f = k % 2 ? 'guest' : 'host'; return { first: f, second: f === 'host' ? 'guest' : 'host' }; };
const ms = await play({ host: A, guest: B }, words, plan);
T.end = Date.now();
const rH = await H.waitResult(A, 60000), rG = await H.waitResult(B, 60000);
T.result = Date.now();
await H.sleep(30000); T.after = Date.now();
console.log(`\n==== 模式 ${MODE} · 延迟 ${LAT}ms · 权限 ${process.env.PERM || 'legacy'} · 节奏 ${PACE}ms/词 · 词数 ${words.length}（能拼 ${ok.length}）`);
console.log(`结算：房主 ${rH && rH.mine}:${rH && rH.theirs}  客人 ${rG && rG.mine}:${rG && rG.theirs}；对战屏 ${Math.round(ms / 1000)} 秒`);
const out = {};
out.aMatch = report(MODE === 'A' ? '房主 · 排位匹配（点开始→自己开房）' : '房主 · 开房', A, T.aGo, T.aHost);
out.aWait = report('房主 · 一个人等对手', A, T.aHost, T.bGo0);
out.aJoin = report('房主 · 客人进房到开打', A, T.bGo0, T.battle);
out.bJoin = report(MODE === 'A' ? '客人 · 排位匹配+进房+等确认' : '客人 · 列表+进房+等确认', B, T.bGo0, T.battle);
out.aBattle = report('房主 · 对战中', A, T.battle, T.end);
out.bBattle = report('客人 · 对战中', B, T.battle, T.end);
out.aRes = report('房主 · 结算+之后30秒', A, T.end, T.after);
out.bRes = report('客人 · 结算+之后30秒', B, T.end, T.after);
const totA = tally(emu, { uid: A.cloudUid, t0: T.aGo, t1: T.after }), totB = tally(emu, { uid: B.cloudUid, t0: T.bGo0, t1: T.after });
console.log(`\n合计（一局）：房主 读${totA.reads} 写${totA.writes}；客人 读${totB.reads} 写${totB.writes}；两人 读${totA.reads + totB.reads} 写${totA.writes + totB.writes}`);
const bSecs = (T.end - T.battle) / 1000;
console.log(`对战中每部手机每秒：房主 读${(out.aBattle.reads / bSecs).toFixed(2)} 写${(out.aBattle.writes / bSecs).toFixed(2)}；客人 读${(out.bBattle.reads / bSecs).toFixed(2)} 写${(out.bBattle.writes / bSecs).toFixed(2)}`);
const tl = timeline(emu, A.cloudUid, T.battle, T.end, 10000);
console.log('房主对战中每 10 秒读：', tl.r.join(' '), ' 写：', tl.w.join(' '));
console.log('报错：', A.errors.concat(B.errors).slice(0, 4).join(' | ') || '无', '外网：', A.leaks.length + B.leaks.length);
await A.close(); await B.close(); srv.close(); await browser.close();
