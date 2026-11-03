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

const src = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_v1065.js', 'utf8');

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

/* ⑤ 规则说明是单一真源 */
{
  const { S } = mk('C');
  for (const k of ['A', 'B', 'C']) {
    const m = S.MODES[k];
    ok(Array.isArray(m.rules) && m.rules.length >= 3, `${k} 有完整的规则说明（供界面直接读）`);
  }
  const ui = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_ui_v1065.js', 'utf8');
  ok(/S\(\)\s*&&\s*S\(\)\.MODES|MODES\s*=\s*\(S\(\)/.test(ui),
     '★ 界面从 MODES 读规则，**不另抄一份**（本项目已因两处真源栽过八次）');
  ok(!/抢答赛[\s\S]{0,200}先拼对 100/.test(ui.replace(/\/\*[\s\S]*?\*\//g, '')),
     '★ 界面代码里没有硬抄的规则文案');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
