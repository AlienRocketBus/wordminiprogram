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

function mk(mode) {
  const doc = { _id: 'R1', hostId: 'H', guestId: 'G', mode, round: 0, winners: [], wordCount: 3, roundAt: 0 };
  const db = {
    read: async () => JSON.parse(JSON.stringify(doc)),
    claim: async (id, g, p) => {
      for (const k of Object.keys(g)) if (doc[k] !== g[k]) return { updated: 0 };
      Object.assign(doc, p); return { updated: 1 };
    },
    patch: async (id, d) => { Object.assign(doc, d); return { updated: 1 }; },
    add: async () => ({ id: 'R1' }), list: async () => [], remove: async () => ({})
  };
  const ctx = { window: {}, document: { addEventListener() {} }, console, Date, Math, JSON,
    Promise, Error, String, Number, Array, Object, setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
  const S = ctx.window.HansenPkRoom;
  S._setTransportForTest(db);
  return { S, doc };
}

/* ① 抢答原子性 —— 命门 */
{
  const { S } = mk('C');
  const grab = (who) => { S._setMeForTest({ id: who, name: who }); return S.claimRound('R1', 0); };
  const [a, b] = await Promise.all([grab('H'), grab('G')]);
  const firsts = [a, b].filter(x => x.first).length;
  ok(firsts === 1, `★ 两人同时提交，只有一个算"先"（实得 ${firsts} 个）—— 抢答原子性`);
  ok(a.winner === b.winner, '★ 双方看到的赢家一致（不会各说各话）');
}

/* ② 各模式的计分 */
for (const [mode, wantSlow] of [['A', 0], ['B', 80], ['C', 60]]) {
  const { S } = mk(mode);
  S._setMeForTest({ id: 'H', name: '快' });
  const fast = await S.claimRound('R1', 0);
  S._setMeForTest({ id: 'G', name: '慢' });
  const slow = await S.claimRound('R1', 0);
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
