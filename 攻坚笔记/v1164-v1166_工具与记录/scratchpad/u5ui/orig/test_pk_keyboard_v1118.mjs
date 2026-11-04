/* test_pk_keyboard_v1118.mjs —— 对战用内置键盘，不弹系统输入法
 *
 * 用户点破：「这个输入法不是使用我们自己内在的输入法吗？
 *             不要使用这个外部的输入法。」
 *
 * 说得对。这是**拼写游戏**，用系统键盘有三个问题：
 *   · **中文输入法要先切英文**，慢一拍，抢答就输了
 *   · 键盘占掉半屏，**对手状态和倒计时都看不见**
 *   · 各家输入法的联想/自动纠错会替玩家"拼好"单词 —— **那还练什么**
 *
 * 拼写蜂本来就用自己的 QWERTY 键盘（`.keyboard`/`.key` 那套），
 * PK 照做 —— 玩法一致，手感也一致。
 *
 * 合同：
 *   ① 输入框 `readonly` + `inputmode=none` —— 系统键盘不弹
 *      （单靠 readonly 在部分安卓输入法上仍会弹，两个都要）
 *   ② 内置 QWERTY：26 字母 + 删除
 *   ③ 点键盘能拼词，拼对即提交
 *   ④ 键盘颜色跟主题走（亮暗都可读）
 *   ⑤ 电脑上实体键盘仍可用（不影响手机）
 *   ⑥ 切回合/关闭时要解绑，不能漏事件
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('对战内置键盘 v1118');

const src = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_ui_v1065.js', 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ① 不弹系统键盘 */
{
  ok(/readonly inputmode="none"/.test(code) || (/readonly/.test(code) && /inputmode="none"/.test(code)),
     '★ 输入框 readonly + inputmode=none —— 系统键盘不弹');
  ok(/inputmode="none"/.test(code),
     '★ 有 inputmode=none（单靠 readonly 在部分安卓输入法上仍会弹）');
}

/* ② 内置 QWERTY */
{
  ok(/function pkKeyboard/.test(code), '有键盘构建函数');
  const i = code.indexOf('function pkKeyboard');
  const seg = code.slice(i, i + 900);
  ok(/'q','w','e','r','t','y','u','i','o','p'/.test(seg), '★ 第一行 QWERTY');
  ok(/'a','s','d','f','g','h','j','k','l'/.test(seg), '★ 第二行 ASDF');
  ok(/'z','x','c','v','b','n','m'/.test(seg), '★ 第三行 ZXCV');
  ok(/pr_del/.test(seg), '★ 有删除键');
}

/* ③ 点键盘拼词 */
{
  const i = code.indexOf('function bindKeyboard');
  ok(i > 0, '有键盘绑定');
  const seg = code.slice(i, i + 1600);
  ok(/input\.value \+= k/.test(seg), '★ 点字母追加到输入框');
  ok(/slice\(0, -1\)/.test(seg), '★ 删除键去掉最后一个字母');
  ok(/submitRound\(idx, true\)/.test(seg), '★ 拼对即提交（不用按回车）');
  ok(/length < 24/.test(seg), '★ 长度封顶，不会被无限敲');
}

/* ④ 颜色跟主题走 */
{
  ok(/--pk-kb-bg/.test(code) && /--pk-key-bg/.test(code), '★ 键盘用主题变量');
  const light = code.slice(code.indexOf('hsn-pal-light'), code.indexOf('hsn-pal-light') + 900);
  const m = light.match(/--pk-key-fg:\s*(#[0-9a-fA-F]{6})/);
  ok(!!m, '亮色下有键帽文字色定义');
  if (m) {
    const hex = m[1];
    const lum = parseInt(hex.slice(1,3),16)*.299 + parseInt(hex.slice(3,5),16)*.587
              + parseInt(hex.slice(5,7),16)*.114;
    ok(lum < 100, `★ 亮色下键帽是深色字 ${hex}（白底白字就看不见了）`);
  }
}

/* ⑤ 实体键盘 */
{
  ok(/_kbKeyHandler/.test(code), '★ 保留实体键盘支持（电脑上能直接敲）');
  ok(/\/\^\[a-zA-Z\]\$\//.test(code), '★ 只认字母键，不吃其它按键');
}

/* ⑥ 解绑 */
{
  ok(/function stopKb/.test(code), '★ 有解绑函数');
  ok(/removeEventListener\('keydown', _kbKeyHandler\)/.test(code),
     '★ 切回合/关闭时解绑 —— 不能漏事件（漏了会越积越多）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
