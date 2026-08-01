/* test_pk_uses_spellbee_v1099.mjs —— 拼写大PK 必须用真正的拼写蜂玩法
 *
 * 产品定义：**拼写大PK = 拼写蜂的玩法，只是对手从机器人换成真人。**
 *
 * v1065 的对战屏是个自制简陋版：一个纯文本输入框 ——
 * 没有发音、没有字母块、没有提示、没有连击、没有动画。
 * 而拼写蜂那套玩法用户已经玩熟了，凭空再造一个既不好玩也不一致。
 *
 * v1099 复用路径（读 spelling_bee.html 源码确认，**不改动那个文件**）：
 *   · 它在 embed 模式下从 `parent.allW` 读词表
 *   · PK 把房间的确定性词表挂到 window.allW，再 iframe 打开 spelling_bee.html
 *   · 双方拿到同一颗种子生成的同一批词（wordsFromSeed），比的是同一套题
 *   · 计分复用它已有的 `hsn_sb_mastery` 消息，不需要动它
 *
 * 合同：
 *   ① 对战屏必须开 spelling_bee.html 的 iframe，不许自制输入框
 *   ② 必须先把词表挂到 window.allW（否则拼写蜂会用自带词库，双方题目不同）
 *   ③ 计分走 hsn_sb_mastery，按 word 去重
 *   ④ **spelling_bee.html 的玩法逻辑一个字都不许改**
 *   ⑤ 中途退出要能交卷，否则对手一直等
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('拼写大PK 用真正的拼写蜂 v1099');

const src = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_ui_v1065.js', 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ① 开拼写蜂 iframe，不自制输入框 */
{
  const i = code.indexOf('function startMatch');
  ok(i > 0, '存在 startMatch');
  const seg = code.slice(i, i + 2500);
  ok(/spelling_bee\.html/.test(seg), '★ 对战屏打开 spelling_bee.html（复用真正的玩法）');
  ok(/embed=1/.test(seg), '★ 用 embed 模式（拼写蜂据此从父页取词）');
  ok(!/<input[^>]*pr_in/.test(seg), '★ 不再有自制的纯文本输入框');
}

/* ② 词表必须先交接给 window.allW */
{
  const i = code.indexOf('function startMatch');
  const seg = code.slice(i, i + 2500);
  const allwAt = seg.indexOf('window.allW');
  const ifrAt = seg.indexOf('spelling_bee.html');
  ok(allwAt >= 0, '★ 把词表挂到 window.allW');
  ok(allwAt < ifrAt,
     '★ 词表交接在 iframe 创建**之前** —— 晚了拼写蜂会用自带词库，双方题目就不同了');
}

/* ③ 计分走 hsn_sb_mastery，按 word 去重 */
{
  ok(/hsn_sb_mastery/.test(code), '★ 复用拼写蜂已有的 hsn_sb_mastery 消息计分');
  ok(/got\[d\.word\]/.test(code) || /got\[.*word.*\]/.test(code),
     '★ 按 word 去重（同一个词答对多次只算一次）');
}

/* ④ spelling_bee.html 的玩法逻辑不许改 —— 只允许版本戳变动 */
{
  const bee = fs.readFileSync('/home/claude/work/repo/spelling_bee.html', 'utf8');
  ok(!/from=pk|hsn-pk-|PK_RESULT_KEY/.test(bee),
     '★ spelling_bee.html 里没有任何 PK 专用代码（铁律：不动这个文件）');
  ok(/parent\.allW/.test(bee),
     '★ 它原本就从 parent.allW 取词 —— 复用路径成立，无需改造');
}

/* ⑤ 中途退出要能交卷 */
{
  ok(/_beeGiveUp/.test(code), '★ 留了中途退出的交卷通道（否则对手会一直等）');
}

/* ⑥ 有测试注入口 —— 否则"对战屏能不能用"只能靠两台真机去试 */
{
  ok(/_startMatchForTest/.test(code), '★ 有测试注入口（不必真的匹配对手就能验对战屏）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
