/* test_session_truth_v1059.mjs —— 「登录状态的真假」回归台架
 *
 * 事故复盘（横跨 v1017 → v1058，整整 40 版没打中）：
 *   用户截图：界面顶部写着「✅ 已登录 +86 186xxxxxxxx」，
 *   而同一页的诊断面板写着「❌ 云端会话已失效」，
 *   每一次云端读写都返回 {"error":"unauthenticated",
 *                        "error_description":"credentials not found"}。
 *
 * 根因（两条，缺一不可）：
 *   ① isSignedIn() 只读 localStorage 的 {method,signedAt}——
 *      「我登录过」被当成「我现在还登录着」。
 *      真正会问云端的 verifySession() 在 v1031 就写好了，
 *      却**只接在诊断面板上显示给人看，从没被任何一处决定采用**。
 *      云存档的 8 处调用全部走的是假的那个。
 *   ② 所有错误显示都是 `'…：' + err`，而 CloudBase 抛的是普通对象
 *      （无 .message、非 Error 实例）→ 整句退化成 '[object Object]'。
 *      于是真正的错因被遮了 40 版，每轮排查只能靠猜。
 *
 * 本台架的合同：
 *   ① errText 对任何输入都不得吐出 [object Object]，且必须挖出 error_description
 *   ② 本地标记说已登录、云端 getLoginState() 却没有 uid
 *      → ensureSession 必须判定 expired，并**清掉那个撒谎的本地标记**
 *   ③ 断网等**不确定**的失败**绝不允许**清标记（否则进隧道就把人登出了）
 *   ④ 清标记时必须广播 hsn-auth-changed，界面不能继续挂着旧的"已登录"
 *   ⑤ 云存档的已登录路径必须过 ensureSession，不得再拿 isSignedIn 放行
 *   ⑥ 云存档不得吃 _cb 缓存跳过会话复验（否则会话死后永远不再检查）
 *   ⑦ 两处 import 的 SDK 必须是**完全相同的 URL**
 *      —— 多一个 ?v= 查询串就是两份独立 SDK、两套凭证，
 *         而 ?v= 是 bump_version.py 自动盖的，每升一版都会重新制造分裂
 */
import vm from 'node:vm'; import fs from 'node:fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const R = '/home/claude/work/repo/';
/* 结构类断言必须只看**代码**：本仓注释里大量引用旧代码原文
   （如 `import('...?v=1058')`、`if(_cb) return ...`），
   不剥注释会让测试对着散文下结论——那种"通过"毫无意义。 */
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
console.log('登录状态真源 + 错误可见性 v1059');

const authSrc = fs.readFileSync(R + 'hansen_auth_v1004.js', 'utf8');
const saveSrc = fs.readFileSync(R + 'hansen_cloud_save_v965.js', 'utf8');
const authCode = codeOnly(authSrc), saveCode = codeOnly(saveSrc);

/* ── 造一个能跑 hansen_auth 的沙箱 ───────────────────────── */
function mkAuth() {
  const store = {
    _d: {}, getItem(k) { return this._d[k] || null; },
    setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; },
    get length() { return Object.keys(this._d).length; }, key(i) { return Object.keys(this._d)[i] || null; }
  };
  const events = [];
  const win = {
    HANSEN_CLOUD_CONFIG: { envId: 'e' }, localStorage: store,
    document: {
      addEventListener() {}, removeEventListener() {},
      dispatchEvent(e) { events.push(e); return true; },
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      documentElement: { classList: { contains: () => false } }, body: null
    },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = (o || {}).detail; } },
    addEventListener() {}, setTimeout: (f) => { return 0; }, setInterval: () => 0,
    clearTimeout() {}, clearInterval() {}, TextEncoder, TextDecoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    fetch: () => Promise.reject(new Error('no-net')), console
  };
  win.window = win;
  const ctx = { ...win, window: win }; vm.createContext(ctx);
  vm.runInContext(authSrc, ctx);
  return { win, store, events };
}

/* ═══ ① errText 绝不吐 [object Object] ═══ */
{
  const { win } = mkAuth();
  const E = win.HansenAuth.errText;
  ok(typeof E === 'function', 'HansenAuth 暴露 errText');

  /* 用户截图里的那个真实对象 */
  const real = { error: 'unauthenticated', error_description: 'credentials not found' };
  const t = E(real);
  ok(!/\[object Object\]/.test(t), `真实云端错误不再是 [object Object] → "${t}"`);
  ok(/credentials not found/.test(t), 'error_description 被挖了出来（这正是被埋了 40 版的那句）');
  ok(/unauthenticated/.test(t), 'error 字段也保留了');

  /* 各种刁钻输入都不得漏出 [object Object] */
  const nasty = [{}, { a: { b: 1 } }, new Error('boom'), 'plain', null, undefined, 0, [], { code: 'X' }];
  let leaked = nasty.filter(v => /\[object Object\]/.test(E(v)));
  ok(leaked.length === 0, `${nasty.length} 种刁钻输入无一泄漏 [object Object]`);
  ok(E(new Error('boom')) === 'boom', 'Error 实例取 message');
  ok(E('plain') === 'plain', '字符串原样返回');
  ok(E(null) === '' && E(undefined) === '', 'null/undefined → 空串');
  ok(E({}) === '(无法解析的错误对象)', '空对象给出可读兜底而非 [object Object]');
}

/* ═══ ② 本地说登录、云端说没有 → 必须判过期并清标记 ═══ */
{
  const { win, store, events } = mkAuth();
  const A = win.HansenAuth;
  ok(typeof A.ensureSession === 'function', 'HansenAuth 暴露 ensureSession');

  /* 伪造「登录过」的本地标记——正是用户手机上的状态 */
  const LK = Object.keys(store._d)[0] || 'hansen_auth_v1004';
  store.setItem(LK, JSON.stringify({ method: 'phone', phone: '+86 18661320035', signedAt: Date.now(), uid: 'U1' }));
  ok(A.isSignedIn() === true, '前置：isSignedIn() 因本地标记返回 true（它就是这么被骗的）');

  /* 云端说：没有会话 */
  A._setAuthForTest({ getLoginState: () => Promise.resolve(null) });

  const r = await A.ensureSession();
  ok(r.ok === false, 'ensureSession 拦住了云端操作');
  ok(r.expired === true, '标记为 expired（会话不可用）');
  /* ★ 关键安全边界：空登录态**不足以**把人登出。
     SDK 恢复持久化会话是异步的，问得太早同样是空；
     网络不通时某些版本也返回空而非抛错。
     据此登出 = 「进隧道/开机快一点」就退出登录，比原 bug 更糟。 */
  ok(r.definite !== true, '★ 空登录态不算确凿结论');
  ok(A.isSignedIn() === true, '★ 空登录态绝不把用户登出（只拦操作，不清标记）');
  ok(!events.some(e => e.type === 'hsn-auth-changed'), '★ 未误发登出广播');
}

/* ═══ ③ getLoginState 抛鉴权错 → 同样判过期 ═══ */
{
  const { win, store } = mkAuth();
  const A = win.HansenAuth;
  const LK = 'hansen_auth_v1004';
  store.setItem(LK, JSON.stringify({ method: 'phone', signedAt: Date.now(), uid: 'U1' }));
  A._setAuthForTest({
    getLoginState: () => Promise.reject({ error: 'unauthenticated', error_description: 'credentials not found' })
  });
  const r = await A.ensureSession();
  ok(r.ok === false && r.expired === true, '鉴权类错误 → expired');
  ok(r.definite === true, '★ 云端明说 unauthenticated 才算确凿结论');
  ok(A.isSignedIn() === false, '★ 确凿失效时才清掉撒谎的本地标记');
  ok(!/\[object Object\]/.test(String(r.reason)), `reason 可读 → "${r.reason}"`);
}

/* ═══ ③b 确凿失效必须广播，界面不能继续挂着「已登录」═══ */
{
  const { win, store, events } = mkAuth();
  const A = win.HansenAuth;
  store.setItem('hansen_auth_v1004', JSON.stringify({ method: 'phone', phone: '+86 18661320035', signedAt: Date.now(), uid: 'U1' }));
  A._setAuthForTest({
    getLoginState: () => Promise.reject({ error: 'unauthenticated', error_description: 'credentials not found' })
  });
  await A.ensureSession();
  ok(events.some(e => e.type === 'hsn-auth-changed'),
     '★ 广播 hsn-auth-changed，界面不会继续挂着「已登录 +86 186…」');
}

/* ═══ ④ 断网等不确定失败 → 绝不清标记 ═══ */
{
  const { win, store } = mkAuth();
  const A = win.HansenAuth;
  store.setItem('hansen_auth_v1004', JSON.stringify({ method: 'phone', signedAt: Date.now(), uid: 'U1' }));
  A._setAuthForTest({ getLoginState: () => Promise.reject(new Error('Failed to fetch')) });
  const r = await A.ensureSession();
  ok(r.ok === false, '断网时不放行');
  ok(r.expired !== true, '断网不算会话过期');
  ok(A.isSignedIn() === true, '★ 断网绝不把用户登出（进隧道≠退出登录）');
}

/* ═══ ⑤ 会话有效 → 正常放行 ═══ */
{
  const { win, store } = mkAuth();
  const A = win.HansenAuth;
  store.setItem('hansen_auth_v1004', JSON.stringify({ method: 'phone', signedAt: Date.now(), uid: 'U1' }));
  A._setAuthForTest({ getLoginState: () => Promise.resolve({ uid: 'REAL-UID' }) });
  const r = await A.ensureSession();
  ok(r.ok === true && r.uid === 'REAL-UID', '会话有效时放行并带回真实 uid');
  ok(A.isSignedIn() === true, '有效会话不会误清标记');
}

/* ═══ ⑥ 未登录 → 明确拒绝，不去打扰云端 ═══ */
{
  const { win } = mkAuth();
  const r = await win.HansenAuth.ensureSession();
  ok(r.ok === false && r.reason === 'not-signed-in', '未登录直接拒绝');
}

/* ═══ ⑦ 云存档必须用真通行证（静态合同）═══ */
{
  ok(/ensureSession/.test(saveCode), '云存档引用了 ensureSession');
  /* 已登录分支必须在 _cb 缓存之前，否则会话死后永不复验 */
  const iApp = saveCode.indexOf('_app: function');
  const iEnsure = saveCode.indexOf('ensureSession', iApp);
  const iCache = saveCode.indexOf('if(_cb) return Promise.resolve(_cb)', iApp);
  ok(iApp >= 0 && iEnsure >= 0 && iCache >= 0, '定位到 _app 的三个关键点');
  ok(iEnsure < iCache, '★ 会话复验排在 _cb 缓存之前（缓存不得跳过复验）');
  /* 「不得存在 isSignedIn 就放行的路径」不能用正则粗筛——新代码的条件里
     本来就同时出现 isSignedIn 与 A._app，会被误判。
     改成**顺序合同**：_app 函数体内，每一次取账号实例之前都必须已过 ensureSession。 */
  const body = saveCode.slice(iApp, saveCode.indexOf('put: function', iApp));
  const calls = [...body.matchAll(/A\._app\(\)/g)].map(m => m.index);
  const gate = body.indexOf('ensureSession');
  ok(calls.length > 0, `_app 内确有取账号实例的调用（${calls.length} 处）`);
  ok(gate >= 0 && calls.every(i => i > gate),
     '★ 每一次取账号实例都排在 ensureSession 之后（不存在绕过会话探测的路径）');
}

/* ═══ ⑧ 两处 SDK import 必须是同一个 URL ═══ */
{
  const grab = (src) => [...src.matchAll(/import\(\s*['"](\.\/vendor_cloudbase_esm[^'"]*)['"]\s*\)/g)].map(m => m[1]);
  const a = grab(authCode), s = grab(saveCode);
  ok(a.length > 0 && s.length > 0, `两边都有 import（auth ${a.length} 处 / save ${s.length} 处）`);
  const all = [...new Set([...a, ...s])];
  ok(all.length === 1, `★ 全仓 SDK import 只有一个 URL → ${JSON.stringify(all)}`);
  ok(!all.some(u => u.includes('?')),
     '★ SDK import 不带任何查询串（? 会让浏览器加载第二份 SDK，凭证互不可见）');
  /* 这条专防 bump_version.py 每次升版重新盖戳 */
  ok(!/vendor_cloudbase_esm[^'"]*\?v=/.test(authCode + saveCode),
     '★ 没有 ?v= 资源戳（bump_version 只替换已有戳，不会补新的，故去掉即永久生效）');
  /* 引用的文件必须真实存在 —— v1057 那个写错文件名的坑 */
  for (const u of all) {
    ok(fs.existsSync(R + u.replace('./', '').split('?')[0]), `SDK 文件真实存在：${u}`);
  }
}

/* ═══ ⑨ 三处报错出口不得再直接拼接错误对象 ═══ */
{
  const diag = fs.readFileSync(R + 'hansen_cloud_diag_v1027.js', 'utf8');
  const rest = fs.readFileSync(R + 'hansen_cloud_restore_v1048.js', 'utf8');
  const pk = fs.readFileSync(R + 'hansen_sb_pk_v1022.js', 'utf8');

  ok(!/\+\s*\(i\.reason\s*\|\|/.test(codeOnly(diag)), '诊断⑩ 不再直接拼 i.reason');
  ok(!/'原始错误: '\s*\+\s*r\.error/.test(codeOnly(diag)), '诊断往返自检 不再直接拼 r.error');
  ok(/E\(/.test(codeOnly(diag)), '诊断面板改走 E() 统一出口');
  ok(!/String\(\(e && e\.message\) \|\| e\)/.test(codeOnly(rest)), '恢复模块不再用 String(e.message||e)');
  ok(/EText/.test(codeOnly(rest)) && /reportFail/.test(codeOnly(rest)), '恢复模块提供 EText + reportFail');
  ok(/HansenAuthUI/.test(codeOnly(rest)), '★ 会话过期时能把用户引到登录面板（不再是死路弹窗）');
  ok(/reportFail/.test(codeOnly(pk)), 'PK 页复用统一报错出口');
}

console.log(`\n通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
