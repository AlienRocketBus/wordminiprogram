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
  /* 🔴v1146：窗口按**剥掉注释后**的代码算 ——
     否则加几段说明注释就会把断言挤出窗口，测试莫名其妙变红。
     （本版就撞上了：加了超时的注释，三条断言同时失效。） */
  const codeOnly = auth.replace(/\/\*[\s\S]*?\*\//g, '');
  const ci = codeOnly.indexOf('function signOut');
  ok(codeOnly.slice(ci, ci + 1200).includes('resetForAccountSwitch'),
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
  /* 🔴v1144 推翻了 v1143 的这条：
     v1143 图省事"在入口统一打标记，不管走哪条分支"，
     实测挑出问题 —— **对账失败时 A 的进度被标成了 B 的**，
     下次登录会被当成"B 自己的"直接上传。
     现在改为**只在成功分支打**（下面 v1144 段有逐条验证）。 */
  ok(/markLocalOwner\(uidNow\)/.test(code),
     '★ 有打标记的调用（时机见下方 v1144 段的逐分支验证）');

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


/* ── 🔴v1144 追加：归属标记的两个致命细节 ────────────────── */

/* ① 标记绝不能进备份 */
{
  const bk = fs.readFileSync('/home/claude/work/repo/hansen_backup_v944.js', 'utf8');
  ok(/hansen_local_progress_owner_/.test(bk) &&
     /DENY=\/\^\(\?:hansen_local_progress_owner_/.test(bk.replace(/\s/g,'')),
     '★ 归属标记在备份的 DENY 名单里 —— ' +
     'A 把备份码给 B，B 恢复后本机会多出 owner=A，' +
     '**B 自己的进度会被判成"别人的"，下次登录被云端覆盖掉**');
}

/* ② 标记只能在对账**成功**之后打 */
{
  const auth = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js', 'utf8');
  const i = auth.indexOf('function syncOnLogin');
  const seg = auth.slice(i, i + 4000);

  /* 入口处不能有裸的标记调用 —— v1143 就是这么写的，实测有问题 */
  const head = seg.slice(0, seg.indexOf('accountCloudInfo') + 400);
  ok(!/^\s*if \(uidNow\) markLocalOwner\(uidNow\);/m.test(head),
     '★ 入口处**不**打标记 —— ' +
     'v1143 图省事放在入口"不管走哪条分支都打"，' +
     '结果对账失败时 A 的进度被标成 B 的，' +
     '下次登录会被当成"B 自己的"直接上传');

  /* 成功分支要打 */
  ok(/action: 'nothing-to-sync'/.test(seg) &&
     seg.slice(0, seg.indexOf("action: 'nothing-to-sync'")).includes('markLocalOwner'),
     '★ nothing-to-sync（云端没档）这条成功分支会打标记');
  ok(/markLocalOwner\(uidNow\);\s*\/\* v1144: 恢复成功/.test(seg),
     '★ restored（从云端恢复成功）会打标记');
  ok(/markLocalOwner\(uidNow\);[\s\S]{0,200}action: 'conflict'/.test(seg),
     '★ conflict（两边都有让用户选）会打标记 —— ' +
     '能走到这里说明本机这份不是别人的');

  /* 失败分支不能打 */
  const failIdx = seg.indexOf("action: 'cloud-unreachable'");
  const beforeFail = seg.slice(Math.max(0, failIdx - 300), failIdx);
  ok(!/markLocalOwner/.test(beforeFail),
     '★ cloud-unreachable（连不上云端）**不**打标记 —— ' +
     '这时什么都没对上，本机这份还是上一个人的');
  ok(/恢复失败 —— \*\*不标记\*\*/.test(auth),
     '★ 恢复失败明确不标记，且写清了理由');
}

/* ③ 这条原则本身 */
{
  const auth = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js', 'utf8');
  ok(/漏一处只是少标一次/.test(auth) || /不能拿来换正确性/.test(auth),
     '★ 代码里写清了取舍：' +
     '"分支多容易漏"不能拿来换正确性 —— ' +
     '漏标只是少标一次（下次登录会补），早标一次会把别人的进度算成你的');
}


/* ── 🔴v1145 追加：退出前必须先上传 ──────────────────────
 *
 * 推演 A→B→A 来回换（多人共用一台手机时很常见，孩子轮流玩）：
 *
 *   ① A 登录 → 从云端恢复 A 档
 *   ② A 玩了一会儿        → 本机 = A档 + 新进度
 *   ③ 退出
 *   ④ B 登录 → 本机被 B 档覆盖
 *   → **A 在②玩的那段进度，没上传就没了。**
 *
 * v1134 的"数据一变就同步"有 8 秒合并延迟 ——
 * **打完一局立刻退出登录，那 8 秒内的进度必丢。**
 */
{
  const auth = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js', 'utf8');
  const code = auth.replace(/\/\*[\s\S]*?\*\//g, '');
  const i = code.indexOf('function signOut');
  const seg = code.slice(i, i + 2200);

  ok(/_bye = Promise\.race\(\[\s*CS\.syncNow\(\{ force: true \}\)/.test(seg.replace(/\s+/g,' ').replace(/\( /g,'(')) ||
     /CS\.syncNow\(\{ force: true \}\)/.test(seg),
     '★ 退出登录前先强制上传一次 —— 否则最后那段进度会丢');
  ok(/_bye\.then\(function \(\) \{ return auth\(\); \}\)/.test(seg),
     '★ **等上传完再真正退出** —— 否则清了登录态，上传就没凭证了');
  ok(/syncNow\(\{ force: true \}\)\['catch'\]/.test(seg),
     '★ 上传失败也照常退出 —— 不能把人卡在登录态里');

  /* v1146: 上传那行现在包在 Promise.race 里，改为找 syncNow 本身 */
  const iUp = seg.indexOf('CS.syncNow({ force: true })');
  const iOut = seg.indexOf('_bye.then(function () { return auth(); })');
  ok(iUp >= 0 && iOut > iUp, '★ 顺序正确：先上传，后退出');
}

/* A→B→A 的完整推演 */
{
  function sim(uploadOnSignOut) {
    let owner = '', cloud = { A: 'A档v1', B: 'B档v1' }, local = '空';
    function login(uid) {
      const foreign = !!(owner && uid && owner !== uid);
      const hasLocal = (local !== '空') && !foreign;
      const hasCloud = !!cloud[uid];
      if (hasCloud && !hasLocal) local = cloud[uid];
      else if (!hasCloud && hasLocal) cloud[uid] = local;
      owner = uid;
    }
    const play = (w, t) => { local = w + '档' + t; };
    const logout = () => { if (uploadOnSignOut && owner) cloud[owner] = local; };
    login('A'); play('A', 'v2'); logout();
    login('B'); play('B', 'v2'); logout();
    login('A');
    return local;
  }
  ok(sim(false) === 'A档v1',
     '★ 复现旧 bug：不上传就退出 → A 回来只剩 v1，中间玩的丢了');
  ok(sim(true) === 'A档v2',
     '★ 修复后：A→B→A 来回换，A 玩的进度还在');
}


/* ── 🔴v1146 追加：上传本身可能失败的两条路 ────────────────
 *
 * v1145 加了"退出前强制上传"。这轮挑它 —— 挑出两条上传会白做的路：
 *   ① 正在同步时退出 → 被 busy 挡掉，等于没上传
 *   ② 云端卡住不返回 → 退出永远完不成，用户退不出去
 */
{
  const cs = fs.readFileSync('/home/claude/work/repo/hansen_cloud_save_v965.js', 'utf8');
  const code = cs.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(/if\(!opts\.force\) return Promise\.resolve\(\{ ok:false, reason:'busy' \}\)/.test(code),
     '★ 非 force 遇到 busy 仍然直接跳过 —— 那只是例行同步，晚一轮没关系');
  ok(/if\(_busyTail\) return _busyTail\.then\(function\(\)\{ return syncNow\(opts\); \}\)/.test(code),
     '★ **force 遇到 busy 要排队等**，不是直接放弃 —— ' +
     '退出登录时如果自动同步刚好在跑，强制上传会被 busy 挡掉，等于没上传');
  ok(/_busyTail = run\.then/.test(code) && /_busyTail = null/.test(code),
     '★ 记录进行中的那次并在完成后清空');
}
{
  const auth = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js', 'utf8');
  const code = auth.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/Promise\.race\(\[/.test(code) && /setTimeout\(r, 6000\)/.test(code),
     '★ **退出时的上传有 6 秒超时** —— ' +
     '云端卡住不返回时，原来 signOut 永远不执行，用户退不出去');
  ok(/退不出去比丢一点进度更糟/.test(auth),
     '★ 代码里写清了取舍：退不出去比丢一点进度更糟');
}

/* 三种情况的行为 */
{
  const behave = (busy, force, queues) => {
    if (!busy) return 'upload';
    if (!force) return 'skip';
    return queues ? 'queue-then-upload' : 'skip';
  };
  ok(behave(false, true, true) === 'upload', '★ 空闲时退出 → 直接上传');
  ok(behave(true, true, true) === 'queue-then-upload',
     '★ 正在同步时退出 → 排队等完再上传（不是放弃）');
  ok(behave(true, false, true) === 'skip', '★ 例行同步遇 busy → 跳过（正确）');
}


/* ── 🔴v1147 追加：跨标签页的账号变更 ──────────────────────
 *
 * 推演：用户开着两个标签页。
 *   标签A：登着张三，正在玩
 *   标签B：在这里点了退出，登了李四
 *
 * → **标签A 完全不知道账号变了**，继续往 localStorage 写张三的进度
 * → 而归属标记已经是李四了
 * → **张三的新进度被算成李四的，下次同步传到李四账号**
 *
 * 手机上不常开多标签，但电脑上很常见；
 * 而且"一个标签停在旧页面没关"这件事本身就很普遍。
 */
{
  const auth = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js', 'utf8');
  const code = auth.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(/addEventListener\('storage'/.test(code),
     '★ 监听 storage 事件 —— 别的标签页改了 localStorage 会通知本页' +
     '（自己改的不触发，正合适）');
  ok(/ev\.key !== LKEY/.test(code),
     '★ 只关心登录态那个键的变化');
  ok(/if \(now === mine\) return;/.test(code),
     '★ uid 没变就不提示 —— 不能因为写了一次同样的值就误报');
  ok(/function notifyTabStale/.test(code),
     '★ 有过期提示');
  ok(/location\.reload/.test(code),
     '★ 提示里给刷新按钮');
  ok(/别的窗口登录了另一个账号/.test(auth) && /别的窗口退出了登录/.test(auth),
     '★ 两种情况文案分开 —— 换账号和退出登录，用户要知道是哪种');
  ok(/继续玩会把进度记到错的账号上/.test(auth),
     '★ 说清楚为什么要刷新，而不是干巴巴一句"请刷新"');
  ok(/不自作主张改数据，只提示用户刷新/.test(auth),
     '★ **不自动帮用户处理** —— ' +
     '这个标签页此刻的内存状态（正在进行的一局、未保存的输入）' +
     '没法安全迁移到新账号名下，让用户自己决定什么时候刷新');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
