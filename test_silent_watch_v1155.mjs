const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_silent_watch_v1155.mjs —— 让"被吞掉的错误"能被看见
 *
 * 🔴 为什么要有这个模块：
 *
 * 用户问「你确定天梯没问题了吗，我怎么感觉 bug 还很多」——
 * 我不确定。于是换了个角度查：**代码里有多少地方会把错误悄悄吃掉。**
 *
 * 一数：对战三个模块里有 **56 处空 catch**（`catch(e){}`）。
 *
 * 而今天挖出的两个"天梯根本用不了"，**正是被空 catch 吞掉的**：
 *   · `_createForLadder` 没打开界面 → 房建好了、屏幕是白的
 *     → 外层 `try{...}catch(e){}` 把报错吃了 → **控制台干干净净**
 *   · 匹配失败 → 同样被吞
 *
 * > **空 catch 的代价不是"隐藏了一个错误"，
 * > 而是"隐藏了错误存在这件事"。**
 *
 * 从代码看正常、从日志看正常，只有用户看到白屏 ——
 * 这就是为什么这类 bug 能一直活着。
 *
 * ═══ 为什么不去改那 56 处 ═══
 *
 * 因为很多是**防御性的、该留着**（比如"取不到就用默认值"）。
 * 逐个判断哪些该报错、哪些不该，风险比收益大。
 *
 * 做法：装一个**全局观察者** —— 把 `error` 和 `unhandledrejection`
 * 记进环形缓冲区。平时零成本，出问题时能立刻回答
 * "是不是有东西在悄悄报错"这个问题。
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('悄悄报错观察者 v1155');

const src = fs.readFileSync((__HSN_ROOT + 'hansen_silent_watch_v1155.js'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '');

/* ① 两种错误都要接住 */
{
  ok(/addEventListener\('error'/.test(code),
     '★ 接住普通脚本错误');
  ok(/addEventListener\('unhandledrejection'/.test(code),
     '★ **接住没人处理的 Promise 报错** —— ' +
     '对战/天梯全是 Promise 链，这类最容易被漏掉');
}

/* ② 不能自己把内存吃光 */
{
  ok(/MAX = 30/.test(code) && /buf\.length > MAX/.test(code) && /buf\.shift\(\)/.test(code),
     '★ 环形缓冲，最多留 30 条 —— ' +
     '一个"观察错误"的模块自己撑爆内存就荒唐了');
}

/* ③ 观察者本身绝不能抛错 */
{
  const noteBody = code.slice(code.indexOf('function note'), code.indexOf('function note') + 420);
  ok(/try \{/.test(noteBody) && /catch \(e\) \{\}/.test(noteBody),
     '★ 记录本身包在 try 里 —— ' +
     '**观察者出错反而搅乱页面，那就本末倒置了**');
  ok(/try \{\s*window\.addEventListener\('error'/.test(code.replace(/\s+/g, ' ').replace(/try \{ /g, 'try {\n')) ||
     /try \{[\s\S]{0,80}addEventListener\('error'/.test(code),
     '★ 连挂监听这一步也包在 try 里（老浏览器可能没有这些事件）');
}

/* ④ 要能被查询 */
{
  for (const m of ['recent', 'count', 'clear', 'report']) {
    ok(new RegExp(m + ':').test(code), `★ 导出 ${m}()`);
  }
  ok(/最近没有悄悄报错/.test(src),
     '★ 没有报错时说人话，而不是返回空字符串让人不知道是"没错"还是"没跑"');
}

/* ⑤ 必须真的接到页面上 —— 否则等于没做 */
{
  const pages = ['index.html', 'spelling_pk.html', 'island_animal.html'];
  for (const pg of pages) {
    const html = fs.readFileSync((__HSN_ROOT + '') + pg, 'utf8');
    ok(html.includes('hansen_silent_watch_v1155.js'),
       `★ ${pg} 已加载观察者`);
  }
}

/* ⑥ 位置要在 SW 升级门之后 —— 那条铁律不能破 */
{
  const html = fs.readFileSync((__HSN_ROOT + 'spelling_pk.html'), 'utf8');
  const iGate = html.indexOf('hansen_sw_upgrade_gate_v944.js');
  const iWatch = html.indexOf('hansen_silent_watch_v1155.js');
  ok(iGate >= 0 && iWatch > iGate,
     '★ 排在 SW 升级门**之后** —— ' +
     '升级门必须保持首脚本位置，否则"做出来的东西不显示"会复发（v1139 的教训）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
