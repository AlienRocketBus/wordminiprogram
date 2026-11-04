const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_pk_ask_mode_v1102.mjs —— 两种出题形式（看中文 / 听发音）
 *
 * 用户点破：
 *   「拼写对战本来不就是发音吗？听发音之后再拼单词。
 *     可以分为两种形式：一种是看汉译，还有一种是听发音，让他们自己去选。」
 *
 * 说得对 —— 拼写比赛（spelling bee）的本质就是**听音拼词**，
 * v1101 只显示中文，等于把这个功能的核心丢了。
 *
 * 合同：
 *   ① 看中文：显示中文 + 首字母提示
 *   ② 听发音：**屏幕上不许出现这个词的任何线索** ——
 *      不显示中文、不给首字母，只有喇叭。否则"听音拼词"名存实亡。
 *   ③ 听发音进屏自动读一遍，点喇叭可重听
 *   ④ 发音参数与拼写蜂一致（en-US / rate .82），并走全站音量归一
 *      —— 否则同一个 App 里两处发音一大一小（v1038 修过这个毛病）
 *   ⑤ 每回合结束必须亮出答案 —— 拼错了要知道正确答案是什么，
 *      这个 App 首先是用来学英语的
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('两种出题形式 v1102');

const src = fs.readFileSync((__HSN_ROOT + 'hansen_pk_room_ui_v1065.js'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ① 两种形式都定义了 */
{
  ok(/ASK_MODES/.test(code), '定义了 ASK_MODES');
  ok(/cn:\s*\{/.test(code) && /tts:\s*\{/.test(code), '★ 两种形式：看中文 / 听发音');
}

/* ② 听发音不许泄露任何线索 —— 本测试最关键的一条 */
{
  /* 🔴v1156：**又一个"往后数 N 个字符"的窗口断言。**

     v1156 把题目文字放大加重（26px→34px 并加了样式），
     askIsTts 到喇叭按钮的距离从 1200 内涨到了 2013 ——
     **代码完全正确，断言却红了**。

     这个文件里的窗口是 1200，而 test_pk_battle_ui 里同类的
     已经被撑大过三次（900→2600→3200）。

     > 凡是"往后数 N 个字符"的断言，
     > 都是在赌那段代码不会长大。而它一定会长大。

     改为：从 askIsTts 一直取到这个渲染函数结束
     （下一个 `function ` 出现之前），多长都覆盖得到。 */
  const i = code.indexOf('askIsTts');
  ok(i > 0, '对战屏按出题形式分支');
  const _next = code.indexOf('\n  function ', i);
  const seg = code.slice(i, _next > i ? _next : i + 4000);
  const ttsBranch = seg.slice(seg.indexOf('askIsTts'), seg.indexOf(': ') > 0 ? seg.indexOf("'<div class=\"pr_cn\"") : seg.length);
  ok(/prSpk/.test(seg), '★ 听发音模式显示喇叭按钮');
  ok(!/w\.cn[\s\S]{0,120}prSpk/.test(seg),
     '★ 听发音分支里不渲染中文');
  ok(/askIsTts[\s\S]{0,400}\?[\s\S]{0,400}prSpk/.test(seg),
     '★ 喇叭只在听发音分支出现');
  ok(!/en\.charAt\(0\)[\s\S]{0,200}prSpk/.test(seg),
     '★ 听发音模式不给首字母提示（给了就不叫听音拼词）');
}

/* ③ 自动播报 + 可重听 */
{
  ok(/setTimeout\(function \(\) \{ speak\(en\); \}/.test(code), '★ 进屏自动读一遍');
  ok(/spk\.onclick[\s\S]{0,60}speak\(en\)/.test(code), '★ 点喇叭可重听');
}

/* ④ 发音参数与拼写蜂一致 + 走全站音量 */
{
  const i = code.indexOf('function speak');
  ok(i > 0, '有 speak 函数');
  const seg = code.slice(i, i + 900);
  ok(/en-US/.test(seg), '★ 语言 en-US（与拼写蜂一致）');
  ok(/rate\s*=\s*0?\.82/.test(seg), '★ 语速 .82（与拼写蜂一致）');
  ok(/HansenTTSVolume/.test(seg),
     '★ 走全站音量归一（否则 PK 的发音会比岛屿里大一截 —— v1038 修过）');
  ok(/speechSynthesis\.cancel/.test(seg), '★ 播新的先取消旧的，不叠音');
}

/* ⑤ 每回合结束亮答案 */
{
  ok(/answer\s*=\s*' 〔'/.test(code) || /〔/.test(src),
     '★ 回合结束显示正确答案（拼错了要知道答案，这首先是学英语的 App）');
}

/* ⑥ 房主可选，且存进房间（客人才知道用哪种） */
{
  ok(/data-ask/.test(code), '★ 开房时可选出题形式');
  ok(/askMode:\s*_askMode/.test(code), '★ 出题形式随房间创建一起存下');
  const room = fs.readFileSync((__HSN_ROOT + 'hansen_pk_room_v1065.js'), 'utf8');
  ok(/askMode:/.test(room), '★ 房间文档里有 askMode 字段（双方一致）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
