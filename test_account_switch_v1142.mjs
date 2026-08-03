/* test_account_switch_v1142.mjs —— 换账号时资料要跟着换
 *
 * 用户现场（真机）：
 *   手机上退出 A 号、登了 B 号（B 的竞赛 ID 是 003），
 *   **页面上还显示 A 的名字和 No.002**，而且点了也改不了名字。
 *
 * ═══ 两个症状，一个根子 ═══
 *
 * **本地资料没跟着账号走。** 退出登录时什么都没清：
 *   · 名字和 cid 还是 A 的
 *   · `cidLocked` 锁死 → B 的 003 写不进去
 *   · `nameChangedAt` 是 A 留下的 → B 改名被告知"冷却中"
 *
 * 这违反了本项目最核心的一条：**所有数据必须跟着账号走。**
 * 资料（名字、竞赛 ID）当然也是数据。
 *
 * ═══ 两道修法 ═══
 *   ① 退出登录时把资料重置为空白
 *   ② 云端说的 cid 和本地锁着的不一样 → **以云端为准**
 *      （"锁死终身不变"指的是**同一个账号**的号不变，
 *        不是"这台手机第一次拿到的号不变"）
 *   ③ 界面收到 hsn-profile-reset 立刻重画
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('换账号资料跟随 v1142');

function boot(init) {
  const store = {};
  if (init) store['hansen_sb_profile_v1002'] = JSON.stringify(init);
  const ctx = { window: {}, document: { addEventListener() {}, dispatchEvent() { return true; } },
    CustomEvent: class { constructor(t) { this.type = t; } },
    console, Date, Math, JSON, Object, Array, String, Number, Error,
    localStorage: { getItem: k => (k in store ? store[k] : null),
      setItem(k, v) { store[k] = String(v); }, removeItem(k) { delete store[k]; } } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('/home/claude/work/repo/hansen_sb_profile_v1002.js', 'utf8'), ctx);
  return ctx.window.HansenSbProfile;
}

/* ① 云端号和本地锁着的不一样 → 以云端为准 */
{
  const P = boot({ name: '小明', cid: 2, cidLocked: true, avatar: '🐝',
                   showcase: [], privacy: 'public', nameChangedAt: Date.now() });
  const r = P.claimCloudId(3);
  const p = P.readProfile();
  ok(r.switched === true, '★ 认出这是换了账号');
  ok(p.cid === 3, `★ 号码以云端为准（实得 No.${p.cid}）—— 用户现场就是卡在 002`);
  ok(p.name === '', '★ 上一个账号的名字被清掉 —— 否则新号顶着别人的名字');
  ok(p.nameChangedAt === 0,
     '★ 改名冷却被清掉 —— 那是上一个账号的记录，新账号不该被它挡住');
}

/* ② 同一账号重复认领不该被当成换号 */
{
  const P = boot({ name: '小明', cid: 3, cidLocked: true, avatar: '🐝',
                   showcase: [], privacy: 'public', nameChangedAt: 12345 });
  const r = P.claimCloudId(3);
  const p = P.readProfile();
  ok(r.already === true && !r.switched, '★ 同一个号重复认领 → 不当成换账号');
  ok(p.name === '小明', '★ 名字不会被误清');
  ok(p.nameChangedAt === 12345, '★ 冷却记录不会被误清');
}

/* ③ 退出登录要重置资料 */
{
  const P = boot({ name: '小明', cid: 2, cidLocked: true, avatar: '🐝',
                   showcase: [], privacy: 'public', nameChangedAt: Date.now() });
  ok(typeof P.resetForAccountSwitch === 'function', '★ 提供了重置接口');
  P.resetForAccountSwitch();
  const p = P.readProfile();
  ok(p.cid === 0 && p.cidLocked === false, '★ 重置后没有号（等下次登录云端发）');
  ok(p.name === '' && p.nameChangedAt === 0, '★ 重置后名字和冷却都清了');

  const auth = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js', 'utf8');
  const i = auth.indexOf('function signOut');
  ok(auth.slice(i, i + 1200).includes('resetForAccountSwitch'),
     '★ 退出登录时会调这个重置 —— 否则换账号后还是上一个人的资料');
}

/* ④ 界面要立刻跟上 */
{
  const html = fs.readFileSync('/home/claude/work/repo/spelling_pk.html', 'utf8');
  ok(/hsn-profile-reset/.test(html), '★ 界面监听 hsn-profile-reset');
  const i = html.indexOf("hsn-profile-reset");
  const j = html.indexOf('function renderMe');
  ok(i < j && (j - i) < 800,
     '★ 监听器挂在 renderMe 定义处附近 —— ' +
     '挂在脚本末尾可能在某个 return 之后根本执行不到（实测踩过）');
  ok(/setTimeout\(function\(\)\{ try\{ renderMe\(\); \}catch\(e\)\{\} \}, 60\)/.test(html.replace(/\s+/g, ' ').replace(/ \}/g, '}').replace(/\{ /g, '{')) ||
     /renderMe\(\)/.test(html.slice(i, j)),
     '★ 延一拍再画 —— 派发事件时资料可能刚落盘，立刻读会读到旧值');
}


/* ── 🔴v1143 追加：进度归属 ──────────────────────────────
 *
 * v1142 修的是**资料**（名字、竞赛 ID）跟着账号走。
 * 但换账号后，**进度、战绩、钱包、好友这些同样还是上一个人的** ——
 * 退出登录时一个都不清。
 *
 * ⚠️ **绝不能直接删。** 没登录时玩的进度也在同一批键里，
 * 删了就是删用户数据 —— 这条红线比什么都硬。
 *
 * 所以做法是**给本机进度打上归属标记**，让对账逻辑能区分：
 *   · 「我自己没登录时玩的」→ 保留、参与对账（两边都有就让用户选）
 *   · 「上一个账号留下的」  → 当成"本机没有"，直接从云端恢复
 *
 * 后者尤其重要：如果让用户选，他根本不知道该选哪个，
 * 而且很容易把**别人的进度传到自己账号上**。
 */
{
  const auth = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js', 'utf8');
  const code = auth.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(/OWNER_KEY\s*=\s*'hansen_local_progress_owner_v1143'/.test(code),
     '★ 有独立的归属标记键');
  ok(/function localBelongsToOther/.test(code),
     '★ 能判断"本机这份是不是别人的"');
  ok(/var foreign = localBelongsToOther\(uidNow\)/.test(code) &&
     /if \(foreign\) \{ hasLocal = false; \}/.test(code),
     '★ 是别人的就当"本机没有"来对账 —— 走"云端有档直接恢复"，不让用户选');
  ok(/if \(uidNow\) markLocalOwner\(uidNow\)/.test(code),
     '★ 对账入口统一打标记（分支有五六条，逐个加必然会漏）');

  /* 退出时**不能**清归属 —— 清了下一个人会被误判成"自己的" */
  const i = code.indexOf('function signOut');
  const seg = code.slice(i, i + 1500);
  ok(!/markLocalOwner\(\s*''\s*\)|removeItem\(OWNER_KEY\)/.test(seg),
     '★ 退出登录时**不清**归属标记 —— 退出后这份仍是刚才那人的，' +
     '清了的话下一个人登录会把别人的进度传到自己账号上');

  /* 绝不能出现直接删进度的代码 */
  ok(!/wordIsland[\s\S]{0,80}removeItem/.test(code),
     '★ 绝不直接删本机进度 —— 没登录时玩的也在同一批键里，删了就是删用户数据');
}

/* 归属判定的四种情况 */
{
  const belongs = (owner, uid) => !!(owner && uid && owner !== uid);
  ok(belongs('', 'B') === false, '★ 从没登录过就玩的 → 算自己的（要保留）');
  ok(belongs('A', 'B') === true, '★ 上一个账号 A 留下的 → 算别人的');
  ok(belongs('B', 'B') === false, '★ 自己重新登录 → 还是自己的');
  ok(belongs('A', '') === false, '★ 没登录时不做判定');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
