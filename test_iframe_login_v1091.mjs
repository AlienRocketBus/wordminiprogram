/* test_iframe_login_v1091.mjs —— 子框内必须能登录
 *
 * 事故（v1090 我亲手造成）：
 *   为了堵住"多实例并发刷新 refresh_token"，我在 hansen_auth / hansen_cloud_save
 *   里加了「iframe 内一律不创建云端实例」的拦截。
 *   结果用户打开拼写大PK（**本身就在 index.html 的 iframe 壳里跑**），
 *   点登录直接看到：
 *       「登录没成功：子页面不创建云端实例（由主窗口统一处理）」
 *   —— **连登录都用不了了。**
 *
 * 我的错误在于把两件事混为一谈：
 *   · 后台自动行为（开机恢复、自动同步、会话探测）在子框里跑
 *     → 多实例并发 → 凭证被撞没（**该拦**）
 *   · 用户主动操作（登录、注册、手动同步）
 *     → 功能本身（**必须放行**，拦了比凭证偶尔被撞掉严重得多）
 *
 * 正确做法：同源时**借用顶层已有的实例** ——
 * 既只有一个实例（不会并发刷新），子框里的功能又照常可用。
 *
 * 合同：
 *   ① 子框内 app() 不得无条件拒绝
 *   ② 同源时优先借用顶层实例
 *   ③ 拒绝路径必须只针对后台标记，不针对"所有子框"
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('子框内必须能登录 v1091');

for (const [file, label] of [['hansen_auth_v1004.js', '账号'], ['hansen_cloud_save_v965.js', '云存档']]) {
  const src = fs.readFileSync('/home/claude/work/repo/' + file, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const i = code.indexOf('_inFrame');
  ok(i > 0, `${label}模块有子框判断`);
  const seg = code.slice(i, i + 900);

  /* ① 借用顶层实例 */
  ok(/window\.top/.test(seg) && /_app\s*\(\s*\)/.test(seg),
     `★ ${label}：同源时借用顶层实例（一个实例，不会并发刷新）`);

  /* ② 不得无条件拒绝 —— 那会让子框里的功能整个不可用 */
  const rejectIdx = seg.indexOf('Promise.reject');
  if (rejectIdx >= 0) {
    const before = seg.slice(0, rejectIdx);
    ok(/_bgOnly|后台/.test(before),
       `★ ${label}：拒绝路径只针对后台任务，不针对所有子框`);
  } else {
    ok(true, `★ ${label}：子框内完全不拒绝（更保险）`);
  }
}

/* ③ 报错文案不得再出现那句会让用户以为功能坏了的话 */
{
  const a = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/子页面不创建云端实例/.test(a) || /_bgOnly/.test(a),
     '★ 「子页面不创建云端实例」不再出现在用户可见的登录路径上');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
