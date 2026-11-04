const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_pk_record_v1103.mjs —— 对战战绩与天梯分
 *
 * v1100~v1102 把玩法做好了，但**打完什么都不留下**：
 *   赢了没有痕迹，输了也没有损失 —— 那为什么要打？
 *   天梯一直是「敬请期待」。
 *
 * 而 ELO 算法 v1002 就写好了（expectedScore/kFactor/nextRating/tierOf），
 * **缺的一直是"存状态"这一层**。
 *
 * 合同：
 *   ① 胜负平都要记，连胜要累计
 *   ② **只有 A 抢答赛动天梯分**（v1100 定的：排位就该纯竞技）
 *   ③ 定级赛打满才显示段位，之前明确说"未定级"，不给假段位
 *   ④ 历史局数有上限，不会无限膨胀
 *   ⑤ 战绩键以 hansen_ 开头 → 会被备份收录跟着账号走
 *      （对比 v1094：诊断类内部键必须排除，而战绩是真实玩家数据，就该同步）
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('对战战绩与天梯 v1103');

function mk() {
  const store = {};
  const ls = { getItem: k => (k in store ? store[k] : null),
               setItem: (k, v) => { store[k] = String(v); },
               removeItem: k => { delete store[k]; } };
  const ctx = { window: {}, document: { addEventListener() {}, dispatchEvent() { return true; } },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = (o || {}).detail; } },
    localStorage: ls, console, Date, Math, JSON, Object, Array, String, Number, Error };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync((__HSN_ROOT + 'hansen_sb_ladder_v1002.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync((__HSN_ROOT + 'hansen_pk_record_v1103.js'), 'utf8'), ctx);
  return { R: ctx.window.HansenPkRecord, store };
}

/* ① 胜负平与连胜 */
{
  const { R } = mk();
  R.record({ result: 'win', mode: 'C' });
  R.record({ result: 'win', mode: 'C' });
  R.record({ result: 'lose', mode: 'C' });
  R.record({ result: 'draw', mode: 'C' });
  const s = R.summary();
  ok(s.wins === 2 && s.losses === 1 && s.draws === 1, `★ 胜负平都记（${s.wins}/${s.losses}/${s.draws}）`);
  ok(s.bestStreak === 2, `★ 最高连胜记为 2（实得 ${s.bestStreak}）`);
  ok(s.streak === 0, '★ 输了之后连胜清零');
  ok(s.winRate === 50, `胜率计算正确（${s.winRate}%）`);
}

/* ② 只有 A 动天梯分 —— 最关键的一条 */
{
  const { R } = mk();
  const r0 = R.summary().rating;
  R.record({ result: 'win', mode: 'C' });
  R.record({ result: 'win', mode: 'B' });
  ok(R.summary().rating === r0, '★ B/C 模式不动天梯分');
  R.record({ result: 'win', mode: 'A', oppRating: 1000 });
  ok(R.summary().rating > r0, '★ A 抢答赛赢了会涨分');
  const r1 = R.summary().rating;
  R.record({ result: 'lose', mode: 'A', oppRating: 1000 });
  ok(R.summary().rating < r1, '★ A 抢答赛输了会掉分');
}

/* ③ 定级赛 */
{
  const { R } = mk();
  ok(R.summary().tier.name === '未定级', '★ 没打定级赛时明确说"未定级"，不给假段位');
  ok(/再打 \d+ 局/.test(R.summary().tier.sub), '★ 提示还差几局');
  for (let i = 0; i < 5; i++) R.record({ result: 'win', mode: 'A', oppRating: 1000 });
  const s = R.summary();
  ok(s.placed === true, '★ 打满定级赛后 placed=true');
  ok(s.tier.name !== '未定级', `★ 亮出真实段位（${s.tier.name}）`);
  ok(/\d+ 分/.test(s.tier.sub), '★ 段位后显示具体分数');
}

/* ④ 历史不无限膨胀 */
{
  const { R } = mk();
  for (let i = 0; i < 40; i++) R.record({ result: 'win', mode: 'C' });
  ok(R.summary().history.length <= 20, `★ 历史局数封顶（实得 ${R.summary().history.length}）`);
  ok(R.summary().history[0].at >= R.summary().history[1].at, '★ 最新的在最前面');
}

/* ⑤ 战绩必须跟着账号走 */
{
  const { R, store } = mk();
  R.record({ result: 'win', mode: 'A' });
  const keys = Object.keys(store);
  ok(keys.some(k => /^hansen_/.test(k)),
     '★ 战绩键以 hansen_ 开头 → 会被备份收录、跟着账号走（换设备还在）');
  const bk = fs.readFileSync((__HSN_ROOT + 'hansen_backup_v944.js'), 'utf8');
  const diag = bk.match(/DIAG_KEY_RE\s*=\s*\/([^/]+)\//);
  ok(!diag || !new RegExp(diag[1]).test(keys.find(k => /^hansen_pk_record/.test(k)) || ''),
     '★ 战绩**不在**诊断键排除名单里（它是真实玩家数据，该同步）');
}

/* ⑥ 结算屏接上了 */
{
  const ui = fs.readFileSync((__HSN_ROOT + 'hansen_pk_room_ui_v1065.js'), 'utf8');
  ok(/HansenPkRecord/.test(ui), '★ 结算屏调用战绩记录');
  ok(/天梯分/.test(ui), '★ 结算屏显示天梯分变化');
  ok(/只有 ⚡ 抢答赛计分|不计天梯/.test(ui), '★ B/C 模式明确告知不计天梯');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
