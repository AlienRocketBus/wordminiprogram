/* test_auth_session_v1164.mjs —— 会话判定 / 凭证守护 / 备份不碰 SDK 键（v1164）
 *
 * 背景（读 SDK 2.30.0 源码 + 用真 SDK 对着模拟云端逐条跑出来的事实）：
 *   · getLoginState() 没会话一律给 null，几乎从不抛错；
 *   · uid 只来自本机缓存 user_info_<env>，缓存没了 st.user.uid 就是空的；
 *   · 凭证只在 credentials_<env>，被 invalid_grant 删掉就回不来；
 *   · user_info 缓存坏了 getLoginState 会抛 SyntaxError/TypeError（唯一会抛错的情况）；
 *   · 刷新请求没有超时；
 *   · 数据库出错时不抛错，而是返回 {code, message}。
 *
 * v1163 的后果：凭证没了的人永远「尚未就绪」（不让重新登录）；user_info 没了的人进不了天梯；
 *   缓存坏了被当成"确凿过期"登出；网卡住时一直转圈；count 出错被当成 0 人发出 No.1；
 *   凭证守护的救援次数一辈子不清零；备份把 SDK 的 user_info/device_id 也收进去、恢复时删掉。
 *
 * 合同（每条都有"改坏就红"的断言）：
 *   ① 没凭证 + 不是刚登录 → 确凿过期、清本地记录、广播，且不白白重试
 *   ② 凭证还在 → 只是"尚未就绪"，不登出
 *   ③ 凭证没了先请守护救一次，救回就成功；救不回才过期；每次探测只救一次
 *   ④ 有会话没 uid → getCurrentUser 补；不行用令牌 sub；都限时
 *   ⑤ user_info 缓存坏了 → 删掉再探，不登出；程序错误不算"鉴权失败"
 *   ⑥ 整个探测限 10 秒 → {notReady, slow, kind:'slow'}
 *   ⑦ 没登录 → kind 'signin'
 *   ⑧ 凭证守护：同一个 refresh_token 救援次数不清零、换了新 token 才清零、封顶 3 次
 *   ⑨ 备份不收、不恢复、不删 SDK 自己的键；老快照带着它们也能恢复（静默丢掉）；启动恢复日志同理
 *   ⑩ 建档发号查 {code}：出错不建档、不发号
 *   ⑪ 子框借顶层实例时 auth 对象只取一次（优先用顶层那一个）
 *   ⑫ 退出登录：先清本地记录再让 SDK 退出、限时、清守护
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('会话判定 / 凭证守护 / 备份 v1164');
const R = '/home/claude/work/repo/';
const authSrc = fs.readFileSync(R + 'hansen_auth_v1004.js', 'utf8');
const guardSrc = fs.readFileSync(R + 'hansen_cred_guard_v1092.js', 'utf8');
const backupSrc = fs.readFileSync(R + 'hansen_backup_v944.js', 'utf8');
const bootSrc = fs.readFileSync(R + 'hansen_backup_bootstrap_v944.js', 'utf8');
const ENV = 'envtest-abcdef0123456789';
const CR = 'credentials_' + ENV, UI = 'user_info_' + ENV;
const CREDVAL = JSON.stringify({ access_token: 'A'.repeat(40), refresh_token: 'RT1', expires_in: 7200, expires_at: new Date(Date.now() + 7e6).toISOString() });

/* localStorage 替身：方法挂在原型上（凭证守护按原型取原始方法） */
class FakeStorage {
  constructor(seed) { Object.defineProperty(this, '_d', { value: Object.assign({}, seed || {}), enumerable: false }); }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; }
  setItem(k, v) { this._d[k] = String(v); }
  removeItem(k) { delete this._d[k]; }
  key(i) { return Object.keys(this._d)[i] || null; }
  get length() { return Object.keys(this._d).length; }
}

function mkWin(store, extra) {
  const events = [];
  const win = Object.assign({
    HANSEN_CLOUD_CONFIG: { envId: ENV, region: '' }, localStorage: store, console,
    document: { addEventListener() {}, removeEventListener() {}, dispatchEvent(e) { events.push(e); return true; },
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: null, documentElement: {},
      readyState: 'complete', visibilityState: 'visible' },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = (o || {}).detail; } },
    addEventListener() {}, setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 8)), clearTimeout() {},
    setInterval: () => 0, clearInterval() {}, TextEncoder, TextDecoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    fetch: () => Promise.reject(new Error('no-net'))
  }, extra || {});
  win.window = win; win.self = win; if (!win.top) win.top = win;
  return { win, events };
}
function loadAuth(seed, extra) {
  const store = new FakeStorage(seed);
  const { win, events } = mkWin(store, extra);
  const ctx = vm.createContext(win);
  vm.runInContext(authSrc, ctx);
  return { A: win.HansenAuth, win, store, events };
}
const marker = (agoMs) => JSON.stringify({ method: 'phone', phone: '+86 13800000000', signedAt: Date.now() - agoMs, uid: 'U1' });
const OLD = 600000;
const counter = (states) => { let n = 0; const f = () => { const s = states[Math.min(n, states.length - 1)]; n++; return typeof s === 'function' ? s() : (s && s.__throw ? Promise.reject(s.__throw) : Promise.resolve(s)); }; f.n = () => n; return f; };

/* ═══ ① 没凭证 + 不是刚登录 → 确凿过期 ═══ */
{
  const { A, events } = loadAuth({ hansen_auth_v1004: marker(OLD) });
  const gls = counter([null]);
  A._setAuthForTest({ getLoginState: gls });
  const r = await A.ensureSession();
  ok(r.ok === false && r.expired === true && r.definite === true, '★ 本机没有凭证 → 确凿过期（以前永远是"尚未就绪"，不让人重新登录）');
  ok(r.kind === 'expired' && r.noCredentials === true && r.notReady === false, `kind=expired / noCredentials（实为 ${r.kind}）`);
  ok(/重新登录/.test(r.reason), '文案让人去重新登录：' + r.reason);
  ok(gls.n() === 1 && r.tries === 1, `★ 凭证都没了就不白白重试（问了 ${gls.n()} 次）`);
  ok(A.isSignedIn() === false, '★ 清掉了撒谎的本地"已登录"记录');
  ok(events.some((e) => e.type === 'hsn-auth-changed'), '★ 广播 hsn-auth-changed，界面立刻跟上');
}

/* ═══ ② 凭证还在 → 只是尚未就绪 ═══ */
{
  const { A, events } = loadAuth({ hansen_auth_v1004: marker(OLD), [CR]: CREDVAL });
  const gls = counter([null]);
  A._setAuthForTest({ getLoginState: gls });
  const r = await A.ensureSession();
  ok(r.ok === false && r.notReady === true && r.expired === false && r.kind === 'session', `★ 凭证还在 → notReady / kind=session（实为 ${r.kind}）`);
  ok(gls.n() === 5, `重试到底才下结论（问了 ${gls.n()} 次）`);
  ok(A.isSignedIn() === true && !events.some((e) => e.type === 'hsn-auth-changed'), '★ 不登出、不广播（网慢≠过期）');
}

/* ═══ ③ 凭证守护救一次 ═══ */
{
  const { A, store, win } = loadAuth({ hansen_auth_v1004: marker(OLD) });
  let rescues = 0;
  win.HansenCredGuard = { rescue: () => { rescues++; store.setItem(CR, CREDVAL); return true; } };
  A._setAuthForTest({ getLoginState: () => Promise.resolve(store.getItem(CR) ? { user: { uid: 'UR' } } : null) });
  const r = await A.ensureSession();
  ok(r.ok === true && r.uid === 'UR' && rescues === 1, `★ 凭证不在 → 守护用影子副本救回 → 成功（救了 ${rescues} 次）`);
  ok(/影子副本救回/.test(A._trace()), '轨迹里记下了"救回"');
}
{
  const { A, win } = loadAuth({ hansen_auth_v1004: marker(OLD) });
  let rescues = 0;
  win.HansenCredGuard = { rescue: () => { rescues++; return true; } };   /* 救回的是死凭证：SDK 又删掉了 */
  A._setAuthForTest({ getLoginState: () => Promise.resolve(null) });
  const r = await A.ensureSession();
  ok(r.expired === true && rescues === 1, `★ 救回来也不管用 → 判过期；一次探测只救一次（救了 ${rescues} 次）`);
}

/* ═══ ④ 有会话没 uid → 补取 ═══ */
{
  const { A } = loadAuth({ hansen_auth_v1004: marker(OLD), [CR]: CREDVAL });
  let gcu = 0;
  A._setAuthForTest({ getLoginState: () => Promise.resolve({ user: {} }), getCurrentUser: () => { gcu++; return Promise.resolve({ uid: 'G1' }); } });
  const r = await A.ensureSession();
  ok(r.ok === true && r.uid === 'G1' && gcu === 1, `★ user_info 没了 → getCurrentUser 补回 uid（${r.uid}）`);
}
{
  const { A } = loadAuth({ hansen_auth_v1004: marker(OLD), [CR]: CREDVAL });
  A._setAuthForTest({ getLoginState: () => Promise.resolve({ user: {} }),
    getCurrentUser: () => Promise.reject(new Error('Failed to fetch')),
    getClaims: () => Promise.resolve({ data: { claims: { sub: 'S1' } } }) });
  const r = await A.ensureSession();
  ok(r.ok === true && r.uid === 'S1' && /令牌/.test(r.uidFrom), `★ 取不到账号信息 → 用登录令牌 sub（${r.uid} / ${r.uidFrom}）`);
}
{
  const { A } = loadAuth({ hansen_auth_v1004: marker(OLD), [CR]: CREDVAL });
  const t0 = Date.now();
  A._setAuthForTest({ getLoginState: () => Promise.resolve({ user: {} }),
    getCurrentUser: () => new Promise(() => {}),                     /* /user/me 卡住 */
    getClaims: () => Promise.resolve({ data: { claims: { sub: 'S2' } } }) });
  const r = await A.ensureSession();
  const ms = Date.now() - t0;
  ok(r.ok === true && r.uid === 'S2' && ms >= 5500 && ms < 9500, `★ getCurrentUser 卡住 → 6 秒后改用令牌（${ms}ms）`);
}

/* ═══ ⑤ user_info 缓存坏了 ═══ */
{
  const { A, store } = loadAuth({ hansen_auth_v1004: marker(OLD), [CR]: CREDVAL, [UI]: '{"version":"localCachev1","content":null}' });
  A._setAuthForTest({ getLoginState: () => store.getItem(UI)
    ? Promise.reject(new TypeError("Cannot read properties of null (reading 'uid')"))
    : Promise.resolve({ user: { uid: 'C1' } }) });
  const r = await A.ensureSession();
  ok(r.ok === true && r.uid === 'C1', '★ 坏缓存删掉再探 → 成功');
  ok(store.getItem(UI) === null && A.isSignedIn() === true, '坏缓存已删、人没被登出');
}
{
  const { A } = loadAuth({ hansen_auth_v1004: marker(OLD), [CR]: CREDVAL });
  A._setAuthForTest({ getLoginState: () => Promise.reject(new SyntaxError("Unexpected token 'x', \"xx\" is not valid JSON")) });
  const r = await A.ensureSession();
  ok(r.expired !== true && r.definite !== true && A.isSignedIn() === true,
     '★ 「Unexpected token」是程序错误，不是"令牌过期" —— 不登出（以前 /token/ 一匹配就把人登出）');
}

/* ═══ ⑥ 整个探测限 10 秒 ═══ */
{
  const { A } = loadAuth({ hansen_auth_v1004: marker(OLD), [CR]: CREDVAL });
  A._setAuthForTest({ getLoginState: () => new Promise(() => {}) });   /* 刷新请求挂死 */
  const t0 = Date.now();
  const r = await A.ensureSession();
  const ms = Date.now() - t0;
  ok(r.ok === false && r.notReady === true && r.slow === true && r.kind === 'slow' && r.expired === false,
     `★ 挂死 → {notReady, slow, kind:slow}（${r.kind}）`);
  ok(ms >= 9800 && ms < 12500, `★ 按真实时间约 10 秒返回（${ms}ms；测试桩把定时器压到 8ms 也不会提前）`);
  ok(/超时/.test(r.reason) && A.isSignedIn() === true, '文案说"超时"，且不登出：' + r.reason);
}

/* ═══ ⑦ 没登录 ═══ */
{
  const { A } = loadAuth({});
  const r = await A.ensureSession();
  ok(r.ok === false && r.kind === 'signin' && r.notSignedIn === true && r.reason === 'not-signed-in', '没登录 → kind=signin');
}

/* ═══ ⑧ 凭证守护的救援次数 ═══ */
{
  const store = new FakeStorage({ hansen_auth_v1004: marker(OLD), [CR]: CREDVAL });
  const { win } = mkWin(store);
  vm.runInContext(guardSrc, vm.createContext(win));
  const G = win.HansenCredGuard;
  ok(G && G.status().maxRescue === 3, '守护在，封顶 3 次');
  store.setItem('hansen_cred_rescue_n', '3');
  G.backup();
  ok(G.status().rescued === 3, '★ 同一个 refresh_token 再备份 → 次数不清零（死会话不会被无限救）');
  store.setItem(CR, CREDVAL.replace('RT1', 'RT2'));
  G.backup();
  ok(G.status().rescued === 0, '★ SDK 换了新 refresh_token（登录/刷新成功）→ 次数清零（以前一辈子不清，救满 3 次守护永久失效）');
  /* 封顶：同一份影子反复被删反复救，最多 3 次 */
  let n = 0;
  for (let i = 0; i < 5; i++) { store.removeItem(CR); if (G.rescue('test')) n++; }
  ok(n === 3 && G.status().rescued === 3, `★ 死会话最多救 3 次（救了 ${n} 次）`);
  store.removeItem(CR); G.backup();
  ok(G.status().rescued === 3, '凭证不在时备份什么也不做');
  G.reset();
  ok(G.status().rescued === 0 && G.status().hasShadow === false, 'reset 清次数和影子');
}

/* ═══ ⑨ 备份不碰 SDK 键 ═══ */
const sdkSeed = {
  [CR]: CREDVAL, [UI]: '{"version":"localCachev1","content":{"uid":"REAL"}}', device_id: 'dev-1',
  ['lang_' + ENV]: 'zh-CN', ['x-tcb-trace_' + ENV]: 't1', hansen_cred_shadow: '{}', hansen_cred_rescue_n: '1'
};
const playerSeed = { wordIslandAnimal: '{"learned":[1,2,3]}', hansen_wallet_coins: '100', sb_best_cpm: '42', language: 'en', langPref: 'x' };
function loadBackup(seed) {
  const store = new FakeStorage(seed);
  const { win } = mkWin(store);
  vm.runInContext(backupSrc, vm.createContext(win));
  return { B: win.HansenBackup, store };
}
const fnv = (items) => { const s = items.map((x) => x.key + '\u0000' + x.value).join('\u0001'); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return 'fnv1a32-' + (h >>> 0).toString(16).padStart(8, '0'); };
{
  const { B } = loadBackup(Object.assign({}, sdkSeed, playerSeed));
  const keys = B.build().items.map((x) => x.key);
  const leaked = keys.filter((k) => k in sdkSeed);
  ok(leaked.length === 0, `★ 备份不收 SDK 键（user_info/device_id/lang/x-tcb/凭证）${leaked.length ? '：漏了 ' + leaked.join(',') : ''}`);
  ok(Object.keys(playerSeed).every((k) => keys.includes(k)), '★ 玩家数据一个不少（language / langPref 这种普通键不被误伤）');
  ok(B.isOwnedKey(UI) === false && B.isOwnedKey('device_id') === false && B.isOwnedKey('x-tcb-trace_' + ENV) === false, 'isOwnedKey 对 SDK 键为 false');
}
{
  /* v1163 上传的老快照：带着 SDK 键（还是"别人的" user_info）——要能恢复，且绝不写回 */
  const src = loadBackup(Object.assign({}, playerSeed));
  const p = src.B.build();
  p.items = p.items.concat([
    { key: UI, value: '{"version":"localCachev1","content":{"uid":"FOREIGN"}}' },
    { key: 'device_id', value: 'dev-OLD' }, { key: CR, value: '{"refresh_token":"STALE","access_token":"' + 'x'.repeat(60) + '"}' }
  ]).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  p.checksum = fnv(p.items);
  const dst = loadBackup(Object.assign({}, sdkSeed, { wordIslandAnimal: '{"learned":[9]}' }));
  let err = '';
  try { dst.B.restore(JSON.stringify(p)); } catch (e) { err = e.message; }
  ok(!err, '★ 带着 SDK 键的老快照照样能恢复（拒收会让所有老云存档都恢复不了）' + (err ? '：' + err : ''));
  ok(dst.store.getItem(UI) === sdkSeed[UI] && dst.store.getItem('device_id') === 'dev-1' && dst.store.getItem(CR) === CREDVAL,
     '★ 本机的 user_info / device_id / 凭证原样不动（以前恢复会删掉或盖成快照里的）');
  ok(dst.store.getItem('wordIslandAnimal') === playerSeed.wordIslandAnimal, '玩家数据正常恢复');
  const parsed = dst.B.parse(JSON.stringify(p));
  ok(!parsed.items.some((x) => x.key in sdkSeed) && dst.B.parse(JSON.stringify(parsed)).items.length === parsed.items.length,
     '解析结果不含 SDK 键，且自身校验和自洽（可再次解析）');
  const tampered = JSON.parse(JSON.stringify(p)); tampered.items.find((x) => x.key === UI).value += 'x';
  ok((() => { try { dst.B.parse(JSON.stringify(tampered)); return false; } catch (e) { return /校验和/.test(e.message); } })(),
     '被丢掉的 SDK 键也计入校验和（改了照样能发现）');
}
{
  /* 启动恢复日志（v1163 写的）里带 SDK 键：不拦停应用、不写回、不删现有的 */
  const before = [{ key: 'device_id', value: 'dev-OLD' }, { key: UI, value: '{"version":"localCachev1","content":{"uid":"OLD"}}' }, { key: 'wordIslandAnimal', value: '{"learned":[1]}' }]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const journal = JSON.stringify({ schema: 1, appVersion: 1163, phase: 'prepared', beforeRaw: before, checksum: fnv(before) });
  const store = new FakeStorage(Object.assign({}, sdkSeed, { wordIslandAnimal: '{"learned":[1,2,3,4]}', hansen_backup_restore_journal_v942: journal }));
  const { win } = mkWin(store);
  vm.runInContext(bootSrc, vm.createContext(win));
  const res = win.__hansenBackupBootstrap && win.__hansenBackupBootstrap.result;
  ok(res && res.recovered === true && !res.blocked, `★ 带 SDK 键的旧日志不会拦停启动（${JSON.stringify(res)}）`);
  ok(store.getItem('device_id') === 'dev-1' && store.getItem(UI) === sdkSeed[UI] && store.getItem(CR) === CREDVAL, '★ 回滚不写回、不删 SDK 键');
  ok(store.getItem('wordIslandAnimal') === '{"learned":[1]}', '玩家数据照常回滚到恢复前');
}

/* ═══ ⑩ 建档发号查 {code} ═══ */
function fakeDb(plan) {
  const calls = [];
  const coll = () => ({
    doc: () => ({ get: () => { calls.push('get'); return Promise.resolve(plan.get.shift()); },
      set: () => { calls.push('set'); return Promise.resolve(plan.set ? plan.set.shift() : { upserted_id: 'x' }); },
      update: (d) => { calls.push('update:' + d.cid); return Promise.resolve(plan.update ? plan.update.shift() : { updated: 1 }); } }),
    where: () => ({ count: () => { calls.push('count'); return Promise.resolve(plan.count.shift()); } })
  });
  return { calls, app: { database: () => ({ collection: coll, serverDate: () => ({ $date: 1 }), command: { lt: (x) => ({ $lt: x }) } }) } };
}
async function runProfile(plan) {
  const f = fakeDb(plan);
  const top = { HansenAuth: { _app: () => Promise.resolve(f.app), _authObj: () => null } };
  const { A } = loadAuth({}, { top });
  let r, err = '';
  try { r = await A.ensureProfile('UID1'); } catch (e) { err = String(e.message); }
  return { r, err, calls: f.calls };
}
{
  const x = await runProfile({ get: [{ code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied' }], count: [] });
  ok(/DATABASE_PERMISSION_DENIED/.test(x.err) && !x.calls.includes('set'), `★ 读资料返回 {code} → 报错，不去建档（${x.calls.join(',')}）`);
}
{
  const x = await runProfile({ get: [{ data: [{ cid: 0, createdAt: new Date() }] }], count: [{ code: 'DATABASE_COLLECTION_NOT_EXIST' }] });
  ok(x.r == null && !x.calls.some((c) => c.startsWith('update')), `★ count 返回 {code} → 不发号（以前当成 0 人，发出 No.1）`);
}
{
  const x = await runProfile({ get: [{ data: [{ cid: 0, createdAt: new Date() }] }], count: [{ total: 4 }, { total: 0 }] });
  ok(x.r && x.r.cid === 5 && x.calls.includes('update:5'), `正常时发号 = 比我早的人数 + 1（No.${x.r && x.r.cid}）`);
}
{
  const x = await runProfile({ get: [{ data: [{ cid: 0, createdAt: new Date() }] }], count: [{ total: 4 }, { total: 0 }], update: [{ code: 'DATABASE_PERMISSION_DENIED' }] });
  ok(x.r == null, '★ 写号返回 {code} → 不当成发号成功');
}

/* ═══ ⑪ 子框：auth 对象只取一次 ═══ */
{
  let made = 0, gls = 0;
  const topAuth = { getLoginState: () => { gls++; return Promise.resolve({ user: { uid: 'TOP' } }); } };
  const topApp = { auth: () => { made++; return { getLoginState: () => Promise.resolve({ user: { uid: 'NEW' } }) }; } };
  const { A } = loadAuth({ hansen_auth_v1004: marker(OLD) }, { top: { HansenAuth: { _app: () => Promise.resolve(topApp), _authObj: () => topAuth } } });
  const r1 = await A.ensureSession(), r2 = await A.ensureSession();
  ok(r1.uid === 'TOP' && r2.uid === 'TOP' && made === 0 && gls === 2, `★ 子框用顶层那一个 auth 对象，不新造（新造 ${made} 次）`);
}
{
  let made = 0;
  const topApp = { auth: () => { made++; return { getLoginState: () => Promise.resolve({ user: { uid: 'NEW' } }) }; } };
  const { A } = loadAuth({ hansen_auth_v1004: marker(OLD) }, { top: { HansenAuth: { _app: () => Promise.resolve(topApp), _authObj: () => null } } });
  await A.ensureSession(); await A.ensureSession(); await A.ensureSession();
  ok(made === 1, `★ 顶层没有现成的 → 只取一次并缓存（以前每次调用都 a.auth() 一次；实为 ${made} 次）`);
}

/* ═══ ⑫ 退出登录 ═══ */
{
  const { A, win } = loadAuth({ hansen_auth_v1004: marker(OLD), [CR]: CREDVAL });
  let signedWhenSdk = null, resets = 0;
  win.HansenCredGuard = { reset: () => { resets++; } };
  A._setAuthForTest({ signOut: () => { signedWhenSdk = A.isSignedIn(); return new Promise(() => {}); } });   /* revoke 卡住 */
  const t0 = Date.now();
  const r = await A.signOut();
  const ms = Date.now() - t0;
  ok(r && r.ok === true && A.isSignedIn() === false, '退出成功');
  ok(signedWhenSdk === false, '★ SDK 退出前本地记录已清（守护不会把刚删的凭证救回来）');
  ok(ms >= 5500 && ms < 9000, `★ SDK 退出卡住也只等约 6 秒（${ms}ms）`);
  ok(resets >= 1, '★ 退出时清掉凭证守护的影子副本');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
