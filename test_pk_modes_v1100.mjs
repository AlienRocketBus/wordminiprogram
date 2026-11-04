const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_pk_modes_v1100.mjs —— 三种对战模式
 *
 * 产品定义（用户原话）：
 *   「对战的时候肯定是两个人同时拼一个单词，一个单词一个单词地拼，
 *     不可能给他所有单词大家在那儿各拼各的。」
 *
 * v1099 做错了：发一整套题让两人各自埋头做完再比分数 ——
 * 那不叫对战，那是"两个人各考各的"。
 * v1100 改为**回合制**：同一个词双方同时拼，按快慢计分，再一起进下一词。
 *
 * 三种模式（房主开房时选）：
 *   A 抢答赛：先拼对 100 / 慢的 0 分 / 有人对就推进 / **计天梯**
 *   B 回合赛：先拼对 100 / 后拼对 80 / 等两人都答完 / 不计天梯
 *   C 同步赛：先拼对 100 / 后拼对 60 / 等两人都答完 / 不计天梯（默认）
 *
 * 合同：
 *   ① 抢答必须原子 —— 两人同时提交只有一个算"先"
 *   ② A 模式慢的必须 0 分；B/C 慢的必须有分
 *   ③ 只有 A 计天梯
 *   ④ 规则说明是单一真源，界面从 MODES 读，不许另抄一份
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('三种对战模式 v1100');

const src = fs.readFileSync((__HSN_ROOT + 'hansen_pk_room_v1065.js'), 'utf8');

/* 🔴v1164：以前的假实现一个对象答所有 id、什么都让写 ——
   真数据库里客人改不了房主的文档，于是"客人抢答"在真机上永远写不进去，测试却一直绿。
   现在：一个照真数据库能力做的存储（_id 唯一、只能改自己建的），两个玩家各一个模块实例。 */
function store() {
  const docs = new Map();
  const clone = o => JSON.parse(JSON.stringify(o));
  return {
    docs,
    as(uid) {
      return {
        read: async id => (docs.has(id) ? clone(docs.get(id)) : null),
        add: async d => { await null; if (docs.has(d._id)) throw Object.assign(new Error('E11000 duplicate key'), { code: 'DATABASE_DUPLICATE_WRITE', cloud: true });
          docs.set(d._id, { ...clone(d), _openid: uid }); return { id: d._id }; },
        patch: async (id, d) => { const x = docs.get(id); if (!x || x._openid !== uid) return { updated: 0 }; docs.set(id, { ...x, ...clone(d) }); return { updated: 1 }; },
        remove: async id => { const x = docs.get(id); if (!x || x._openid !== uid) return { deleted: 0 }; docs.delete(id); return { deleted: 1 }; },
        list: async q => [...docs.values()].filter(d => Object.keys(q || {}).every(k => d[k] === q[k])).map(clone),
        listOpen: async () => []
      };
    }
  };
}
function player(db, who) {
  const ctx = { window: {}, document: { addEventListener() {} }, console, Date, Math, JSON,
    Promise, Error, String, Number, Array, Object, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    isFinite, isNaN, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
  const S = ctx.window.HansenPkRoom;
  S._setTransportForTest(db.as(who)); S._setMeForTest({ id: who, name: who });
  return S;
}
/* 一局已经开打的房：房间归房主 H，座位归客人 G */
function mk(mode) {
  const db = store();
  db.docs.set('R1', { _id: 'R1', proto: 2, kind: 'room', _openid: 'H', hostId: 'H', guestId: 'G', status: 'playing',
                      seat: 0, mode, wordCount: 3, createdAt: Date.now(), heartbeatAt: Date.now() });
  db.docs.set('R1_s0', { _id: 'R1_s0', proto: 2, kind: 'seat', _openid: 'G', roomId: 'R1', epoch: 0, guestId: 'G', guestBeat: Date.now() });
  return { db, H: player(db, 'H'), G: player(db, 'G'), S: player(db, 'H') };
}

/* ① 抢答原子性 —— 命门（两台设备同时提交） */
{
  const { H, G, db } = mk('C');
  const [a, b] = await Promise.all([H.claimRound('R1', 0), G.claimRound('R1', 0)]);
  const firsts = [a, b].filter(x => x.first).length;
  ok(firsts === 1, `★ 两人同时提交，只有一个算"先"（实得 ${firsts} 个）—— 抢答原子性`);
  ok(a.winner === b.winner && !!a.winner, '★ 双方看到的赢家一致（不会各说各话）');
  ok([...db.docs.keys()].filter(k => /_w0$/.test(k)).length === 1, '★ 这一词只留下一条裁决（固定 _id，重复写被数据库拒绝）');
  ok(db.docs.get('R1').winners === undefined, '★ 客人没有去改房主的房间文档（各写各的）');
}

/* ①b 客人先拼对 —— 以前客人写不进房主的文档，在真机上永远"慢一步" */
{
  const { H, G } = mk('A');
  const g = await G.claimRound('R1', 0);
  const h = await H.claimRound('R1', 0);
  ok(g.ok && g.first === true && g.score === 100, '★ 客人先拼对 → 客人拿下这一词');
  ok(h.ok && h.first === false && h.winner === 'guest', '★ 房主随后提交 → 看到是客人赢的');
  const st = await H.roundState('R1');
  ok(st.ok && st.round === 1 && st.winners[0] === 'guest' && st.mySide === 'host', '★ 房主轮询到的回合和赢家与客人一致');
}

/* ①c 一边超时推进、一边刚好拼对 —— 只能有一个结论 */
{
  const { H, G } = mk('C');
  const [sk, cl] = await Promise.all([H.skipRound('R1', 0), G.claimRound('R1', 0)]);
  const hs = await H.roundState('R1'), gs = await G.roundState('R1');
  ok(hs.winners.length === 1 && JSON.stringify(hs.winners) === JSON.stringify(gs.winners),
     `★ 超时推进和抢答撞在一起，两边看到同一个结论（${JSON.stringify(hs.winners)}）`);
  ok((sk.skipped === true) !== (cl.first === true), '★ 要么算超时、要么算客人拿下，不会两个都成立');
  const over = await H.claimRound('R1', 3);
  ok(over.ok === false, '★ 超出本局词数的回合不受理（一局最多 N 词）');
}

/* ② 各模式的计分 */
for (const [mode, wantSlow] of [['A', 0], ['B', 80], ['C', 60]]) {
  const { H, G } = mk(mode);
  const fast = await H.claimRound('R1', 0);
  const slow = await G.claimRound('R1', 0);
  ok(fast.score === 100, `${mode}: 先拼对拿 100 分`);
  ok(slow.score === wantSlow,
     `★ ${mode}: 慢的拿 ${slow.score} 分` + (wantSlow === 0 ? '（纯竞技，天梯用它）' : '（拼对就有分，弱者不至于 0 分退坑）'));
}

/* ③ 只有 A 计天梯 */
{
  const { S } = mk('C');
  ok(S.MODES.A.ranked === true, '★ A 抢答赛计天梯');
  ok(S.MODES.B.ranked === false && S.MODES.C.ranked === false, '★ B/C 不计天梯（房间自娱自乐）');
}

/* ④ 推进策略 */
{
  const { S } = mk('C');
  ok(S.MODES.A.waitAll === false, '★ A: 有人拼对就推进，不等慢的');
  ok(S.MODES.B.waitAll === true && S.MODES.C.waitAll === true, '★ B/C: 等两人都答完才翻篇');
}

/* ④b 🔴v1164 B/C「两人都答完才翻篇」要有数据可依：回合文档只记「谁先拼对」，
   对手后拼对 / 超时，以前我这边根本看不到 —— 快的那位就先跑去下一词了。 */
{
  const nap = () => new Promise(r => setTimeout(r, 30));
  const { H, G, db } = mk('C');
  await H.claimRound('R1', 0); await nap();               /* 房主先拼对：100 */
  let hs = await H.roundState('R1');
  ok(hs.ok && hs.oppAns === -1, `对手还没答完第 1 词 → oppAns=-1，房主要等他（实得 ${hs.oppAns}）`);
  const gs0 = await G.roundState('R1');
  ok(gs0.oppAns === 0 && gs0.oppPts === 100, `客人看得到房主答完第 1 词、共 100 分（oppAns=${gs0.oppAns} oppPts=${gs0.oppPts}）`);
  await G.claimRound('R1', 0); await nap();               /* 客人后拼对：60 */
  hs = await H.roundState('R1');
  ok(hs.oppAns === 0 && hs.oppPts === 60, `★ 客人后拼对 → 房主看到他也答完了、对手 60 分（oppAns=${hs.oppAns} oppPts=${hs.oppPts}）`);
  ok(db.docs.get('R1').guestAns === undefined && db.docs.get('R1_s0').guestAns === 0 && db.docs.get('R1').hostAns === 0,
     '★ 各记在自己的文档上（客人记在座位上，没去改房主的房间）');
  await H.skipRound('R1', 1); await nap();                 /* 房主第 2 词超时 */
  const gs1 = await G.roundState('R1');
  ok(gs1.oppAns === 1 && gs1.oppPts === 100, `房主超时也算答完这一词（oppAns=${gs1.oppAns}），分数不变（${gs1.oppPts}）`);
}
{
  const { H, G, db } = mk('A');
  await H.claimRound('R1', 0); await G.claimRound('R1', 0);
  await new Promise(r => setTimeout(r, 30));
  ok(db.docs.get('R1').hostAns === undefined && db.docs.get('R1_s0').guestAns === undefined,
     'A 抢答赛不多写（有人拼对就翻篇，不用等）');
}

/* ④b 🔴v1164（审查 F13 · 压力下实测）：云端对重复 _id 悄悄吞掉（假装成功、不写），
   房主这边那一下又没读到座位（刚刷新过页面、座位那次读失败）——
   以前房主认不出客人那份回合文档，就当成「陌生人占的」换备用号再写一份：两个人都「先拼对」。
   现在：认不出就「结果待定」，读到座位以后照实结算，备用号不写。 */
{
  const db = store();
  const base = db.as;
  let seatFails = 3;   /* 传输层会自己重试 2 次：3 次全失败 = 这一次座位确实没读到 */
  db.as = (uid) => {
    const t = base(uid);
    return Object.assign({}, t, {
      add: async (d) => { await null; if (db.docs.has(d._id)) return { id: d._id };   /* 悄悄吞掉 */
        db.docs.set(d._id, { ...JSON.parse(JSON.stringify(d)), _openid: uid }); return { id: d._id }; },
      read: async (id) => {
        if (uid === 'H' && id === 'R1_s0' && seatFails-- > 0) throw Object.assign(new Error('network request error'), { kind: 'network' });
        return t.read(id);
      },
    });
  };
  db.docs.set('R1', { _id: 'R1', proto: 2, kind: 'room', _openid: 'H', hostId: 'H', guestId: 'G', status: 'playing',
                      seat: 0, mode: 'A', wordCount: 3, createdAt: Date.now(), heartbeatAt: Date.now() });
  db.docs.set('R1_s0', { _id: 'R1_s0', proto: 2, kind: 'seat', _openid: 'G', roomId: 'R1', epoch: 0, guestId: 'G', guestBeat: Date.now() });
  const G = player(db, 'G'), H = player(db, 'H');
  for (const P of [G, H]) P._setTimingForTest({ lagMs: 5, settleMs: 400 });
  const g = await G.claimRound('R1', 0);
  const h = await H.claimRound('R1', 0);
  ok(g.ok && g.first && h.ok && !h.first, `★ 云端吞掉重复写 + 房主没读到座位：只有客人是「先拼对」（客人 first=${g.first}，房主 first=${h.first}${h.pending ? '（结果待定）' : ''}）`);
  ok(![...db.docs.keys()].some((k) => /^R1_w0[bc]$/.test(k)), `★ 认不出是谁写的就不换备用号（库里：${[...db.docs.keys()].filter((k) => /_w/.test(k)).join(', ')}）`);
}

/* ⑤ 规则说明是单一真源 */
{
  const { S } = mk('C');
  for (const k of ['A', 'B', 'C']) {
    const m = S.MODES[k];
    ok(Array.isArray(m.rules) && m.rules.length >= 3, `${k} 有完整的规则说明（供界面直接读）`);
  }
  const ui = fs.readFileSync((__HSN_ROOT + 'hansen_pk_room_ui_v1065.js'), 'utf8');
  ok(/S\(\)\s*&&\s*S\(\)\.MODES|MODES\s*=\s*\(S\(\)/.test(ui),
     '★ 界面从 MODES 读规则，**不另抄一份**（本项目已因两处真源栽过八次）');
  ok(!/抢答赛[\s\S]{0,200}先拼对 100/.test(ui.replace(/\/\*[\s\S]*?\*\//g, '')),
     '★ 界面代码里没有硬抄的规则文案');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
