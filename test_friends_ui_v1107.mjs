/* test_friends_ui_v1107.mjs —— 好友界面
 *
 * 合同：
 *   ① 在线的头像亮 + 绿点；离线的**整体变灰**（不是只去掉绿点）——
 *      一眼扫过去就知道谁能约
 *   ② 在线的排在最前面（你想找的就是能马上打的那个）
 *   ③ 好友详情屏**没有任何输入框** —— 这是"不能打字聊天"
 *      在界面上的直接体现，不是靠禁用某个功能藏起来的
 *   ④ 快捷语点了真的发出去，且发的是 id 不是文本
 *   ⑤ 措辞用「刚才还在」而不是「在线中」——
 *      网页没有真正的长连接，不想让这个功能骗人
 *   ⑥ PK 页有好友入口（做了功能没入口等于没做）
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('好友界面 v1107');

const ui = fs.readFileSync('/home/claude/work/repo/hansen_friends_ui_v1107.js', 'utf8');
const code = ui.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ① 在线亮 / 离线整体变灰 */
{
  ok(/\.fr_item\.off\{opacity:\.45\}/.test(code) || /fr_item\.off[^}]*opacity/.test(code),
     '★ 离线整体降透明度（不是只去掉绿点）—— 一眼扫出谁能约');
  ok(/fr_item\.on2 \.fr_av\{[^}]*box-shadow/.test(code), '★ 在线头像有高亮描边');
  ok(/fr_dot\{[^}]*#22c55e/.test(code), '★ 绿点是绿色');
  ok(/f\.online \? 'on2' : 'off'/.test(code), '★ 按在线状态给不同样式');
  ok(/f\.online \? '<span class="fr_dot">/.test(code), '★ 只有在线的才有绿点');
}

/* ② 在线排前面 */
{
  const svc = fs.readFileSync('/home/claude/work/repo/hansen_friends_v1106.js', 'utf8');
  ok(/friends\.sort/.test(svc) && /b\.online \? 1 : 0/.test(svc),
     '★ 在线的排最前（你想找的就是能马上打的那个）');
}

/* ③ 详情屏没有输入框 —— 本测试最关键的一条 */
{
  const i = code.indexOf('function detail');
  ok(i > 0, '有好友详情屏');
  const seg = code.slice(i, i + 3000);
  ok(!/<input/.test(seg),
     '★ 好友详情屏里**没有任何 input** —— 不能打字聊天不是藏起来的，是根本没有');
  ok(!/textarea|contenteditable/.test(seg), '★ 也没有 textarea / contenteditable');
  ok(/不能打字/.test(ui), '★ 界面上明说"只能发这些，不能打字"');
}

/* ④ 快捷语 */
{
  const i = code.indexOf('function detail');
  const seg = code.slice(i, i + 3000);
  ok(/QUICK\.map/.test(seg), '★ 快捷语从服务层的 QUICK 读，不在界面里另抄一份');
  ok(/sendQuick\(f\.cid, qid\)/.test(seg), '★ 发的是 qid（id），不是文本');
  ok(/没发出去/.test(seg), '★ 发送失败有明确提示，不是静默失败');
}

/* ⑤ 措辞不骗人 */
{
  const svc = fs.readFileSync('/home/claude/work/repo/hansen_friends_v1106.js', 'utf8');
  ok(/刚才还在/.test(svc), '★ 用「刚才还在」');
  ok(!/在线中/.test(ui.replace(/\/\*[\s\S]*?\*\//g, '')),
     '★ 不用「在线中」这种斩钉截铁的说法（网页没有真正的长连接）');
  ok(/网页不能像 App 那样一直挂着/.test(ui),
     '★ 界面上向用户解释了这个限制，而不是让他自己纳闷');
}

/* ⑥ 入口 */
{
  const pk = fs.readFileSync('/home/claude/work/repo/spelling_pk.html', 'utf8');
  ok(/pkFriends/.test(pk), '★ PK 页有好友入口（做了功能没入口等于没做）');
  ok(/HansenFriendsUI/.test(pk), '★ 入口接到了好友界面');
}

/* ⑦ 隐身开关 */
{
  ok(/frHide/.test(code) && /setStatus\('hidden'\)/.test(code), '★ 有隐身开关');
  ok(/隐身时好友看到的你和「不在线」一模一样/.test(ui),
     '★ 说清楚隐身的效果（用户要知道自己选的是什么）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
