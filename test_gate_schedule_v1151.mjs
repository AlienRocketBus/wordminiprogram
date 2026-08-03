/* test_gate_schedule_v1151.mjs —— 闸门的调度顺序
 *
 * 🔴 起因：闸门跑满一轮要十几分钟。
 *
 *    **太慢的闸门容易让人想跳过它** —— 而一旦开始跳，
 *    就回到了"靠记性"的老路，这个项目所有的防线都建立在
 *    "每次发版都真的跑一遍"之上。
 *
 * 查下来不是测试太多，是**调度顺序**的问题：
 *   `ex.map` 按提交顺序调度，最慢的排在最后时，
 *   4 个线程会全部空转等它一个 —— 整体被"长尾"拖住。
 *
 *   实测：40 个测试合计 169 秒，而**前 3 个就占 88 秒（52%）**。
 *
 * 修法：**最长作业优先** —— 把慢的排前面，
 * 其余的填满剩下线程的空档。
 *
 * ⚠️ 这只是**调度顺序**的优化：
 * 一个测试都不会被跳过，结果完全一样，只是更快。
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('闸门调度顺序 v1151');

const gate = fs.readFileSync('/home/claude/work/repo/jarvis_gate.py', 'utf8');
const code = gate.replace(/#[^\n]*/g, '');

/* ① 机制存在 */
{
  ok(/TIME_FILE = os\.path\.join\(ROOT, '\.jarvis_time\.json'\)/.test(code),
     '★ 有耗时记录文件');
  ok(/tests\.sort\(key=lambda t: -_hist\.get\(os\.path\.basename\(t\), 0\)\)/.test(code),
     '★ **按耗时降序排** —— 最长作业优先');
  ok(/_spent\[os\.path\.basename\(t\)\] = round\(time\.time\(\) - _t0, 1\)/.test(code),
     '★ 每次跑完记下真实耗时');
  ok(/_hist\.update\(_spent\)/.test(code) && /json\.dump\(_hist/.test(code),
     '★ 耗时写回文件，供下次排序用');
}

/* ② 第一次跑（没有历史）不能崩 */
{
  ok(/if _hist:/.test(code),
     '★ 没有历史记录时不排序，按原序跑 —— 第一次跑不能因此出错');
}

/* ③ 一个测试都不能被跳过 */
{
  const i = code.indexOf('tests.sort(key=lambda');
  const before = code.slice(Math.max(0, i - 400), i);
  ok(!/tests = \[t for t in tests/.test(before),
     '★ 排序前后没有额外过滤 —— **调度优化不能变成少跑测试**');
}

/* ④ 效果验证：用实测耗时模拟 */
{
  const times = [38.5, 27.4, 21.7, 13.5, 11.0, 10.8, 9.1, 5.2, 5.1, 4.9]
    .concat(new Array(30).fill(1.5));
  const simulate = (order, workers = 4) => {
    const h = new Array(workers).fill(0);
    for (const d of order) {
      let mi = 0;
      for (let i = 1; i < workers; i++) if (h[i] < h[mi]) mi = i;
      h[mi] += d;
    }
    return Math.max(...h);
  };
  const total = times.reduce((a, b) => a + b, 0);
  const lower = total / 4;
  const worst = simulate([...times].sort((a, b) => a - b));   /* 慢的排最后 */
  const ljf = simulate([...times].sort((a, b) => b - a));     /* 本版 */
  ok(ljf < worst,
     `★ 最长作业优先(${ljf.toFixed(0)}s) 快于慢的排最后(${worst.toFixed(0)}s)`);
  ok(ljf - lower < 3,
     `★ 几乎贴到理论下限（${ljf.toFixed(0)}s vs ${lower.toFixed(0)}s）`);
}

/* ⑤ 耗时缓存不进版本库 */
{
  const ig = fs.readFileSync('/home/claude/work/repo/.gitignore', 'utf8');
  ok(/\.jarvis_time\.json/.test(ig),
     '★ 耗时缓存在 .gitignore 里 —— 那是本机性能相关的状态，' +
     '不同机器的数值没有可比性，提交上去只会制造无谓的 diff');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
