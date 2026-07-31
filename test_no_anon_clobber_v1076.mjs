/* test_no_anon_clobber_v1076.mjs —— 已登录时绝不发起匿名登录
 *
 * 事故（用户真机）：
 *   ③  已登录 +86 186xxxxxxxx      ← 本地标记为真，登录确实成功了
 *   ③b 云端会话已失效              ← 几秒后就没了
 *   实测写入：失败「云端登录已过期」
 *   更早一张截图还出现过「云端匿名登录未开通」。
 *
 * 根因：账号会话与匿名会话**共用同一个凭证槽位**（同 envId → 同存储键）。
 *   云存档的匿名兜底路径**无条件**调 signInAnonymously()，完全不看有没有账号登录：
 *     · 匿名成功 → 账号凭证被顶掉，用户读不到自己名下的存档（v1028 事故形态）
 *     · 匿名失败（控制台未开通）→ 失败过程中仍可能冲掉已有凭证
 *       → getLoginState() 返回 null → 判「已过期」
 *       → 用户看到「刚登录成功，一转眼又失效」
 *
 * 合同：
 *   ① 本地存在账号登录记录时，**绝不调用任何匿名登录 API**
 *   ② 此时探不到会话就明确报「已过期」，不得偷偷降级成匿名身份
 *      （降级比报错更糟：用户会以为一切正常，却读不到自己的存档）
 *   ③ 没有账号记录时（先玩后注册），匿名兜底照常工作
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('已登录时绝不匿名登录 v1076');

const src = fs.readFileSync('/home/claude/work/repo/hansen_cloud_save_v965.js', 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* 抠出匿名兜底那一段（从创建实例到 _cb = app） */
const i = code.indexOf('var app = cloudbase.init(initOpt)');
const seg = code.slice(i, code.indexOf('put: function(docId', i));
ok(i > 0, '定位到云存档的实例创建段');

/* ① 匿名调用之前必须先判断有没有账号记录 */
const anonAt = Math.min(
  ...['anonymousAuthProvider', 'signInAnonymously']
      .map(k => { const x = seg.indexOf(k); return x < 0 ? Infinity : x; }));
const guardAt = seg.indexOf("hansen_auth_v1004");
ok(guardAt >= 0, '★ 兜底段里读取了本地账号记录');
ok(guardAt < anonAt, '★ 账号判断在任何匿名登录调用**之前**');

/* ② 有账号时必须直接 return，不许流到匿名分支 */
const guardBlock = seg.slice(guardAt, anonAt === Infinity ? undefined : anonAt);
ok(/if\s*\(\s*hasAccount\s*\)/.test(guardBlock), '★ 存在 hasAccount 分支');
ok(/return\s/.test(guardBlock), '★ 有账号时直接 return，不会落到匿名登录');

/* ③ 有账号且探不到会话 → 必须明确报过期，不得静默降级 */
ok(/sessionDead\s*=\s*true/.test(guardBlock), '★ 探不到会话时抛 sessionDead');
ok(/expired\s*=\s*true/.test(guardBlock), '★ 标记 expired，界面才能引导重新登录');
ok(/云端登录已过期/.test(guardBlock), '★ 文案是人话');
ok(!/signInAnonymously|anonymousAuthProvider/.test(guardBlock),
   '★ hasAccount 分支内**完全没有**匿名登录调用');

/* ④ 没有账号记录时，匿名兜底必须还在（先玩后注册不能被误伤） */
ok(/signInAnonymously|anonymousAuthProvider/.test(seg),
   '未登录场景的匿名兜底仍然保留（先玩后注册不受影响）');

/* ⑤ 判据只看 localStorage，不依赖 HansenAuth 是否已加载 —— 
      脚本加载顺序不确定，正是这条路径被误触发的原因 */
/* 注意：guardAt 指向 'hansen_auth_v1004' 本身，切片会把该行开头切掉，
   所以这条要在整段 seg 上判，并另外确认它出现在匿名调用之前（上面已断言）。 */
ok(/localStorage\.getItem\(\s*['"]hansen_auth_v1004['"]/.test(seg),
   '★ 直接读 localStorage 判断，不依赖模块加载顺序');

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
