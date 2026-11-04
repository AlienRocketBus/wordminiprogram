const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
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
  const src = fs.readFileSync((__HSN_ROOT + '') + file, 'utf8');
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
    /* 🔴v1098：原来是 ok(true,…) —— 恒真断言。
       "没有 reject"这件事本身也要验证，不能白给一个通过。 */
    ok(!/reject|throw/.test(seg),
       `★ ${label}：子框段内确实一处拒绝都没有（更保险）`);
  }
}

/* ③ 报错文案不得再出现那句会让用户以为功能坏了的话 */
{
  const a = fs.readFileSync((__HSN_ROOT + 'hansen_auth_v1004.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/子页面不创建云端实例/.test(a) || /_bgOnly/.test(a),
     '★ 「子页面不创建云端实例」不再出现在用户可见的登录路径上');
}

/* 🔴v1093：auth() 也必须跟着 app() 走 —— 这是 v1091 漏掉的一半。
   v1091 让子框借用顶层实例，app() 返回顶层那个 app 对象，
   **但 _auth 是本模块局部变量、在子框里永远是 null** →
   auth() 直接抛「鉴权不可用」→ 登录照样点不动。
   用户真机报的正是这句。 */
{
  const a = fs.readFileSync((__HSN_ROOT + 'hansen_auth_v1004.js'), 'utf8');
  const code = a.replace(/\/\*[\s\S]*?\*\//g, '');
  const i = code.indexOf('function auth()');
  const seg = code.slice(i, i + 900);
  ok(/app\(\)\.then\(function\s*\(\s*a\s*\)/.test(seg),
     '★ auth() 接住 app() 返回的实例（不是只看本地 _auth）');
  ok(/a\.auth\s*\(/.test(seg), '★ 用那个实例现取 auth');
  ok(/_authObj/.test(code), '★ 顶层暴露 _authObj 供子框借用');
}

/* 🔴v1093：用户可见入口不得吐 [object Object] */
{
  const a = fs.readFileSync((__HSN_ROOT + 'hansen_auth_v1004.js'), 'utf8');
  ok(/_readable\(sendPhoneCode\)/.test(a), '★ sendPhoneCode 包了可读错误');
  ok(/_readable\(loginByPhoneCode\)/.test(a), '★ loginByPhoneCode 包了可读错误');
  ok(/errText\(e\)\s*\|\|\s*'操作失败'/.test(a), '★ 错误一律经 errText 转人话');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
