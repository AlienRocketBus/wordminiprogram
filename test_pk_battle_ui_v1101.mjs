/* test_pk_battle_ui_v1101.mjs —— 对战屏必须是回合制（一次一个词）
 *
 * 用户原话：
 *   「对战的时候肯定是两个人同时拼一个单词，一个单词一个单词地拼，
 *     不可能给他所有单词大家在那儿各拼各的。」
 *
 * v1099 把整套词交给拼写蜂让两人各自做完再比分 —— 那是"各考各的"。
 * v1100 做了底层（三种模式 + 抢答原子性），但对战屏还是旧的。
 * v1101 把对战屏重写成一次一个词。
 *
 * 一回合必须有：
 *   ① 只显示当前这一个词（中文 + 首字母提示）
 *   ② 双方实时比分
 *   ③ 倒计时（防挂机）
 *   ④ 对手实时状态 —— **这是"对战感"的来源**，没有它就只是各自答题
 *   ⑤ 拼对后显示得分与用时，然后自动进下一词
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('对战屏回合制 v1101');

const src = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_ui_v1065.js', 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ① 一次一个词 */
{
  ok(/function askRound\(/.test(code), '★ 有 askRound —— 按回合出词，不是一次给全部');
  ok(!/window\.allW\s*=/.test(code),
     '★ 不再把整套词交给拼写蜂（那是 v1099 的"各考各的"）');
  ok(!/spelling_bee\.html/.test(code), '★ 对战屏不再嵌 spelling_bee iframe');
  const i = code.indexOf('function askRound');
  const seg = code.slice(i, i + 3000);
  ok(/words\[idx\]/.test(seg), '★ 每回合只取 words[idx] 这一个词');
}

/* ② 双方实时比分 */
{
  ok(/prMy/.test(code) && /prOpp/.test(code), '★ 顶部显示双方比分');
  ok(/st\.myScore/.test(code) && /st\.oppScore/.test(code), '★ 分数分别记录');
}

/* ③ 倒计时 */
{
  ok(/prClock/.test(code), '★ 有倒计时显示');
  ok(/deadline/.test(code), '★ 有硬性截止时间（防挂机拖死对手）');
  ok(/left <= 0[\s\S]{0,80}submitRound/.test(code), '★ 超时自动交卷');
}

/* ④ 对手实时状态 —— 对战感的来源 */
{
  ok(/prOppSt/.test(code), '★ 显示对手状态');
  ok(/function pollOpponent/.test(code), '★ 轮询对手是否抢先');
  ok(/抢先拼对/.test(src), '★ 对手抢到时有明确提示');
  /* 🔴v1155：**窗口从 900 放宽到 2600。**
     v1155 在 pollOpponent 里加了断网提醒和"过期数据不倒退"的保护
     （几十行），把 `waitAll` 挤出了原来的 900 字符窗口 ——
     **代码完全正确，断言却红了**。
     这和 v1146/v1148 撞过的是同一个毛病：窗口式断言要留足余量。
     （v1149 的守卫只查"有没有剥注释"，管不到窗口大小。） */
  const i = code.indexOf('function pollOpponent');
  const seg = code.slice(i, i + 3200);
  ok(/waitAll/.test(seg),
     '★ A 模式（不等慢的）下对手抢到就立刻翻篇，B/C 则等两人都答完');
}

/* ⑤ 得分反馈与自动推进 */
{
  ok(/function submitRound/.test(code), '存在 submitRound');
  const i = code.indexOf('function submitRound');
  const seg = code.slice(i, i + 1800);
  ok(/claimRound/.test(seg), '★ 判分交给已验证过原子性的 claimRound');
  ok(/askRound\(idx \+ 1\)/.test(seg), '★ 小结后自动进下一词');
  ok(/toFixed\(1\)/.test(seg), '★ 显示本词用时（让人看见"我快了多少"，正反馈）');
}

/* ⑥ 拼对即提交 —— 抢答讲的就是这一下 */
{
  ok(/oninput/.test(code), '★ 输入即判定，不用按回车（抢答的关键）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
