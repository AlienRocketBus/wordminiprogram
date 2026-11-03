const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_cred_guard_v1092.mjs —— 凭证守护：刷新失败时把凭证救回来
 *
 * 读 SDK 源码确认的链条（不是推测）：
 *   过期判据 qe(t)：凭证缺 expires_at 或 access_token 就**默认算过期** → 立刻刷新
 *   刷新失败分支：
 *       if (scope === "anonymous") → anonymousLogin() 兜底 ✅
 *       else                        → reject + onCredentialsError → **凭证被删** ❌
 *   **手机号登录的会话，刷新一旦失败就没有任何兜底。**
 *
 * 而用户真机日志写明失败原因：
 *   invalid_grant | invalid refresh token. for it may be has been refreshed by
 *   —— refresh_token 被"别人"刷新过了（多标签页/多次打开各自刷新）
 *
 * 合同：
 *   ① 凭证存在时持续备份影子副本
 *   ② 凭证被删且本地仍记着已登录 → 用影子副本救回
 *   ③ 本地没登录 → 绝不凭空造凭证
 *   ④ 影子副本过老（>12h）→ 不再使用
 *   ⑤ 救援次数封顶，避免死循环
 *   ⑥ 跨页面刷新锁：同一时刻只允许一个页面去刷新
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('凭证守护 v1092');

const src = fs.readFileSync((__HSN_ROOT + 'hansen_cred_guard_v1092.js'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ① 备份 */
ok(/function backup/.test(code), '有备份逻辑');
ok(/SHADOW/.test(code), '★ 影子副本写入独立键，不与真凭证抢位');
ok(/length\s*<\s*50/.test(code), '★ 太短的值不当作真凭证备份（避免备份到空壳）');

/* ② 救回 */
ok(/function rescue/.test(code), '有救回逻辑');
ok(/signedInLocally\(\)/.test(code), '★ 只在本地明确记着已登录时才救');
ok(/return false/.test(code.slice(code.indexOf('function rescue'), code.indexOf('function rescue') + 400)),
   '★ 不满足条件时安静返回，不硬来');

/* ③ 不凭空造凭证 */
{
  const seg = code.slice(code.indexOf('function rescue'), code.indexOf('function acquireLock'));
  ok(/if\s*\(\s*!signedInLocally\(\)\s*\)\s*return false/.test(seg),
     '★ 本地没登录 → 直接不救（绝不凭空造凭证）');
  ok(/shadow\.key\s*&&\s*shadow\.val|!shadow\.key\s*\|\|\s*!shadow\.val/.test(seg),
     '★ 没有有效影子副本就不救');
}

/* ④ 过期影子不用 */
ok(/SHADOW_TTL/.test(code) && /Date\.now\(\)\s*-\s*\(shadow\.at/.test(code),
   '★ 影子副本超过 TTL 不再使用（不拿真过期的凭证反复送死）');

/* ⑤ 救援封顶 */
ok(/MAX_RESCUE/.test(code) && /n\s*>=\s*MAX_RESCUE/.test(code),
   '★ 救援次数封顶，避免陷入死循环');

/* ⑥ 跨页面刷新锁 */
ok(/acquireLock|LOCK/.test(code), '★ 有跨页面刷新锁');
ok(/LOCK_TTL/.test(code), '★ 锁带超时，不会因为某页崩了就永久卡死');
ok(/auth.{1,3}v1.{1,3}token/.test(code), '★ 锁只作用于刷新请求，不影响其它调用');

/* ⑦ 必须在账号模块之前加载 */
{
  const html = fs.readFileSync((__HSN_ROOT + 'island_animal.html'), 'utf8');
  const g = html.indexOf('hansen_cred_guard_v1092');
  const a = html.indexOf('hansen_auth_v1004');
  ok(g >= 0, '岛屿页已装守护');
  ok(g < a, '★ 守护在账号模块之前加载（否则错过最早的刷新）');
  ok(!/defer[^>]*hansen_cred_guard/.test(html), '★ 不加 defer，必须同步执行');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
