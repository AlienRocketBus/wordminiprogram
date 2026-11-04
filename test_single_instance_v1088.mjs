const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_single_instance_v1088.mjs —— 已登录时绝不创建第二个 CloudBase 实例
 *
 * ═══ 用户真机凭证生死簿抓到的现行（确凿证据，不是推测）═══
 *
 *   12:44:29  HTTP 400  /auth/v1/token?client_id=ambitious-…
 *             invalid_grant | invalid refresh token.
 *                             for it may be has been refreshed by
 *   12:44:29  ❗删除 credentials_ambitious-…  原有 1314 字节
 *             t.<anonymous> (vendor_cloudbase_esm_v965.js)   ← SDK 自己删的
 *
 * 「refresh token 无效 —— 因为它可能已经被别人刷新过了」
 *
 * 根因：**多个 CloudBase 实例并发刷新同一个 refresh_token**。
 *   每个实例有各自的内存态，却共用同一个 localStorage 凭证槽位：
 *     实例 A 刷新成功 → 写入新的 refresh_token
 *     实例 B 手里还是旧的 → 服务端回 invalid_grant
 *     → SDK 拦截器判定鉴权失败 → 把整个凭证删掉
 *   此后 getLoginState() 永远 null，用户被彻底挡在门外。
 *
 * v1076 想拦这件事，但**防线放在了 cloudbase.init() 之后** ——
 * 实例照样被创建、凭证照样被读取和刷新。
 *
 * 合同：
 *   ① 已登录时，`_app()` 里对账号记录的判断必须在 `cloudbase.init` **之前**
 *   ② iframe 内一律不碰云端凭证（预热 iframe 有 5 个，每个都是一次撞车机会）
 *   ③ 账号模块未就绪时宁可失败，也不得另起实例去抢刷新
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('单实例契约 v1088');

const src = fs.readFileSync((__HSN_ROOT + 'hansen_cloud_save_v965.js'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const initAt = code.indexOf('cloudbase.init(initOpt)');
ok(initAt > 0, '定位到 cloudbase.init');

/* ① 账号判断必须在 init 之前 */
{
  const acctAt = code.indexOf('_hasAcct');
  ok(acctAt > 0, '存在账号记录判断');
  ok(acctAt < initAt, '★ 账号判断在 cloudbase.init **之前**（v1076 就错在放到了后面）');
  const seg = code.slice(acctAt, initAt);
  ok(/if\s*\(\s*_hasAcct\s*\)/.test(seg), '★ 有 _hasAcct 分支');
  ok(/return\s/.test(seg), '★ 已登录时直接 return，一行都不多跑');
  ok(/_A\._app\(\)|A\._app\(\)/.test(seg), '★ 复用账号实例而非另建');
  ok(!/cloudbase\.init/.test(seg), '★ 该分支内完全没有 cloudbase.init');
}

/* ② iframe 内不碰云端 */
{
  const frameAt = code.indexOf('_inFrame');
  ok(frameAt > 0 && frameAt < initAt, '★ iframe 判断也在 init 之前');
  const seg = code.slice(frameAt, initAt);
  ok(/window\.top\s*!==\s*window\.self/.test(seg), '★ 用 window.top 判断是否在子框');
  ok(/return\s+Promise\.reject/.test(seg), '★ 子框内直接拒绝，不创建实例');
}

/* ③ 账号模块未就绪时不得另起实例 */
{
  const seg = code.slice(code.indexOf('_hasAcct'), initAt);
  ok(/尚未就绪|notReady/.test(seg), '★ 账号模块没好时明确报错而非降级另建实例');
}

/* ④ 全仓只允许这一处 cloudbase.init */
{
  const all = (code.match(/cloudbase\.init\s*\(/g) || []).length;
  ok(all === 1, `★ 云存档里只有一处 cloudbase.init（实得 ${all}）`);
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
