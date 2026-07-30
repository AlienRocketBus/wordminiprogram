/* test_auth_contract_v1075.mjs —— 真实 CloudBase 认证合同
 * 这不是“接口名字存在”测试；它验证 resolved {error}、真实 session+uid 提交门禁、
 * 一次短信事务、新老手机号分流、用户名密码登录，以及 v1058 假邮箱永久停用。 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const authSrc = fs.readFileSync(path.join(ROOT, 'hansen_auth_v1004.js'), 'utf8');
const uiSrc = fs.readFileSync(path.join(ROOT, 'hansen_auth_ui_v1004.js'), 'utf8');
const vendorSrc = fs.readFileSync(path.join(ROOT, 'vendor_cloudbase_esm_v965.js'), 'utf8');
let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  OK  ' + msg); }
  else { fail++; console.log('  XX  ' + msg); }
}
function storage() {
  return {
    d: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this.d, k) ? this.d[k] : null; },
    setItem(k, v) { this.d[k] = String(v); },
    removeItem(k) { delete this.d[k]; },
    clear() { this.d = {}; }
  };
}
function boot() {
  const local = storage(), session = storage(), events = [];
  const doc = {
    addEventListener() {}, removeEventListener() {},
    dispatchEvent(e) { events.push(e); return true; },
    getElementById() { return null; }, querySelector() { return null; },
    querySelectorAll() { return []; },
    documentElement: { classList: { contains() { return false; } } },
    body: null
  };
  const win = {
    HANSEN_CLOUD_CONFIG: { envId: 'test', region: 'ap-shanghai' },
    localStorage: local, sessionStorage: session, document: doc,
    CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = (opts || {}).detail; } },
    setTimeout, clearTimeout, setInterval, clearInterval,
    TextEncoder, TextDecoder, console
  };
  win.window = win;
  const ctx = { ...win, window: win, globalThis: win };
  vm.createContext(ctx);
  vm.runInContext(authSrc, ctx);
  return { A: win.HansenAuth, local, session, events };
}
function sessionResult(uid) {
  return { data: { session: uid ? { user: { uid } } : null }, error: null };
}

console.log('v1075 CloudBase 认证真实合同');

ok(/2\.30\.0/.test(vendorSrc), '仓库锁定的真实 CloudBase SDK 为 2.30.0');
ok(/signUpWithEmailAndPassword/.test(vendorSrc) && /verifyOtp/.test(vendorSrc),
   '真实 SDK 的邮箱注册是验证码二阶段，不是立即登录');
ok(!/@u\.wordadventure\.local/.test(authSrc), '认证代码不再生成不可收件的 .local 邮箱');
ok(!/signUpWithEmailAndPassword\s*\(/.test(authSrc), '业务代码不再拿邮箱发码冒充注册成功');
ok(!/\.updateUsername\s*\(/.test(authSrc), '注册链不再把 updateUsername 错调在 Auth 上');
ok(!/_pwReg|不需要手机号|registerByPassword\s*\(/.test(uiSrc),
   'UI 已移除“无需手机号直接用户名注册”的虚假承诺');
ok(/auNewUser/.test(uiSrc) && /auNewPwd2/.test(uiSrc),
   '新手机号收到发码结果后会收集用户名、密码和确认密码');

{
  const { A, local, session } = boot();
  let signed = false;
  const calls = [];
  A._setAuthForTest({
    getVerification(o) { calls.push(['send', o]); return Promise.resolve({ verification_id: 'V1', is_user: false }); },
    verify(o) { calls.push(['verify', o]); return Promise.resolve({ verification_token: 'T1' }); },
    signUp(o) { calls.push(['signup', o]); signed = true; return Promise.resolve({}); },
    getSession() { return Promise.resolve(sessionResult(signed ? 'U-NEW' : '')); }
  });
  const sent = await A.sendPhoneCode('15550836896');
  ok(sent.ok && sent.isUser === false && calls.filter(x => x[0] === 'send').length === 1,
     '新手机号只发送一次验证码并明确 is_user=false');
  const before = JSON.stringify(local.d);
  ok(!/abc123|123456|T1/.test(JSON.stringify(session.d)), '发码后存储中没有密码、短信码或 token');
  const result = await A.loginByPhoneCode('123456', 'Hansen_1', 'abc123', 'abc123');
  const signup = calls.find(x => x[0] === 'signup')[1];
  ok(signup.verification_token === 'T1' && signup.verification_code === '123456',
     '新用户首次 signUp 已携带同一事务的 code + token');
  ok(signup.username === 'Hansen_1' && signup.password === 'abc123',
     '新用户在手机号注册时一次性设置真实用户名和密码');
  ok(result.ok && result.uid === 'U-NEW', '只有真实 session+uid 后才返回登录成功');
  const marker = A.readLocal();
  ok(marker.schema === 1075 && marker.uid === 'U-NEW' && marker.signedAt > 0,
     '真实 uid 后才原子写入 v1075 认证 marker');
  ok(before === JSON.stringify(local.d), '会话确认前 localStorage 没有写入登录成功 marker');
  ok(Object.keys(session.d).length === 0, '注册完成后验证码事务已清理');
}

{
  const { A } = boot();
  let signed = false;
  const calls = [];
  A._setAuthForTest({
    getVerification() { return Promise.resolve({ verification_id: 'V2', is_user: true }); },
    verify() { calls.push('verify'); return Promise.resolve({ verification_token: 'T2' }); },
    signIn(o) { calls.push(o); signed = true; return Promise.resolve({}); },
    getSession() { return Promise.resolve(sessionResult(signed ? 'U-OLD' : '')); }
  });
  await A.sendPhoneCode('15550836896');
  const r = await A.loginByPhoneCode('123456');
  ok(r.uid === 'U-OLD' && calls.length === 2, '已有手机号用同一验证码事务登录，不重复注册');
}

{
  const { A } = boot();
  let signed = false, called = 0;
  A._setAuthForTest({
    signInWithPassword(o) {
      called++; signed = true;
      return Promise.resolve({ data: { user: { uid: 'U-PW' } }, error: null });
    },
    getSession() { return Promise.resolve(sessionResult(signed ? 'U-PW' : '')); }
  });
  const r = await A.loginByPassword('Hansen_1', 'abc123');
  ok(called === 1 && r.uid === 'U-PW', '用户名密码使用 signInWithPassword 并确认同一真实 uid');
}

{
  const { A } = boot();
  let sessionCalls = 0;
  A._setAuthForTest({
    signInWithPassword() {
      return Promise.resolve({ data: { user: null }, error: { code: 'INVALID_CREDENTIALS', message: 'bad' } });
    },
    getSession() { sessionCalls++; return Promise.resolve(sessionResult('SHOULD-NOT-HAPPEN')); }
  });
  let rejected = false;
  try { await A.loginByPassword('Hansen_1', 'wrong00'); } catch (_) { rejected = true; }
  ok(rejected && sessionCalls === 0 && !A.isSignedIn(),
     'fulfilled {error} 仍算失败，不确认 session、不写 marker');
}

{
  const { A } = boot();
  A._setAuthForTest({
    signInWithPassword() { return Promise.resolve({ data: {}, error: null }); },
    getSession() { return Promise.resolve(sessionResult('')); }
  });
  let rejected = false;
  try { await A.loginByPassword('Hansen_1', 'abc123'); } catch (e) {
    rejected = /会话|AUTH_SESSION/.test(String(e && (e.message || e.code || e)));
  }
  ok(rejected && !A.isSignedIn() && !A.readLocal().signedAt,
     '认证 API resolve 但 session/uid 为空时必须失败，绝不 pendingId 假成功');
}

{
  const { A, local } = boot();
  local.setItem('hansen_auth_v1004', JSON.stringify({ method: 'password', username: 'old', signedAt: Date.now() }));
  ok(!A.isSignedIn() && A.needsReauth(), 'v1074 无 uid 假 marker 只提示重新认证，不再算已登录');
  let msg = '';
  try { await A.registerByPassword('x', 'abc123', 'abc123'); } catch (e) { msg = e.message; }
  ok(/手机号/.test(msg), '旧 registerByPassword 调用明确转到真实手机号注册');
  ok(!A.normUsername('中文').ok && !A.normUsername('12345').ok &&
     A.normUsername('Hansen_1').ok && !A.normUsername('_bad').ok,
     '用户名规则与 CloudBase 一致：字母数字 - _、非纯数字、符号不在两端');
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail === 0 ? 0 : 1);
