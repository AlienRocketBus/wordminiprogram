/* test_session_truth_v1059.mjs —— v1075 会话唯一真源回归
 * 本地 marker 只用于显示；只有 SDK session UID 与 marker UID 精确一致，
 * 才能放行账号与云存档操作。网络未知时拒绝云操作但保留本地数据。 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const authSrc = fs.readFileSync(path.join(ROOT, 'hansen_auth_v1004.js'), 'utf8');
const saveSrc = fs.readFileSync(path.join(ROOT, 'hansen_cloud_save_v965.js'), 'utf8');
const codeOnly = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('登录状态唯一真源 v1059→v1075');

function storage() {
  return {
    _d: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; },
    get length() { return Object.keys(this._d).length; },
    key(i) { return Object.keys(this._d)[i] || null; }
  };
}
function boot(marker) {
  const localStorage = storage(), sessionStorage = storage(), events = [];
  if (marker) localStorage.setItem('hansen_auth_v1004', JSON.stringify(marker));
  const document = {
    addEventListener() {}, removeEventListener() {},
    dispatchEvent(e) { events.push(e); return true; },
    getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    documentElement: { classList: { contains() { return false; } } }, body: null
  };
  const win = {
    HANSEN_CLOUD_CONFIG: { envId: 'test', region: 'ap-shanghai' },
    __HANSEN_AUTH_NO_BOOT__: true, __HANSEN_AUTH_TEST_FAST__: true,
    localStorage, sessionStorage, document,
    CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = (opts || {}).detail; } },
    addEventListener() {}, setTimeout, clearTimeout, setInterval, clearInterval,
    TextEncoder, TextDecoder, console,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary')
  };
  win.window = win;
  const ctx = { window: win, document, localStorage, sessionStorage, CustomEvent: win.CustomEvent,
    setTimeout, clearTimeout, setInterval, clearInterval, TextEncoder, TextDecoder, console };
  vm.createContext(ctx);
  vm.runInContext(authSrc, ctx);
  return { A: win.HansenAuth, localStorage, events };
}
const sessionResult = uid => ({ data: { session: { user: { uid } } }, error: null });

{
  const b = boot({ method: 'phone', uid: 'U1', signedAt: Date.now() });
  ok(b.A.isSignedIn() === false, 'marker 单独存在绝不冒充有效登录');
  b.A._setSessionForTest('confirmed', 'U1');
  ok(b.A.isSignedIn() === true, '内存 session truth 与 marker UID 一致才显示登录');
}
{
  const b = boot({ method: 'phone', uid: 'U1', signedAt: Date.now() });
  b.A._setAuthForTest({ getSession: () => Promise.resolve(sessionResult('U1')) });
  const r = await b.A.ensureSession('U1');
  ok(r.ok && r.uid === 'U1' && b.A.isSignedIn(), 'ensureSession 用真实 SDK session 确认同一 UID');
}
{
  const marker = { method: 'phone', uid: 'U1', phone: '+86 15550836896', signedAt: Date.now() };
  const b = boot(marker);
  b.A._setAuthForTest({ getSession: () => Promise.resolve(sessionResult('U2')) });
  const r = await b.A.ensureSession('U1');
  ok(!r.ok && r.mismatch && b.A.sessionStatus().state === 'mismatch', '不同 UID fail closed');
  ok(b.A.readLocal().uid === 'U1' && b.A.readLocal().phone === marker.phone,
     'UID 冲突不删除本地 marker 或学习身份');
}
{
  const b = boot({ method: 'phone', uid: 'U1', signedAt: Date.now() });
  b.A._setAuthForTest({ getSession: () => Promise.reject(new Error('Failed to fetch')) });
  const r = await b.A.ensureSession('U1');
  ok(!r.ok && r.definite === false && b.A.sessionStatus().state === 'unknown',
     '断网是 unknown：拒绝云操作，不伪造登出结论');
  ok(b.A.readLocal().uid === 'U1', '断网保留 marker 与本地进度');
}
{
  const b = boot({ method: 'phone', phone: '+86 15550836896', signedAt: Date.now() });
  b.A._setAuthForTest({ getSession: () => Promise.resolve({ data: { session: null }, error: null }) });
  const st = await b.A.refreshSession();
  ok(st.state === 'legacy_reauth' && b.A.needsReauth(), '没有 UID 的旧 marker 必须重新认证');
}
{
  const b = boot();
  const value = b.A.errText({ error: 'unauthenticated', error_description: 'credentials not found' });
  ok(!value.includes('[object Object]') && value.includes('credentials not found'),
     'CloudBase 普通对象错误保持可读');
}
{
  const authCode = codeOnly(authSrc), saveCode = codeOnly(saveSrc);
  ok(/ensureSession/.test(saveCode), '云存档每次账号读写仍通过 ensureSession');
  const uidIndex = saveCode.indexOf("out.push('u:'");
  const phoneIndex = saveCode.indexOf("out.push('p:'");
  const nameIndex = saveCode.indexOf("out.push('n:'");
  ok(uidIndex >= 0 && phoneIndex > uidIndex && nameIndex > uidIndex,
     '稳定 UID 是唯一新写入命名空间；手机号/用户名仅作为兼容候选');
  const imports = [...(authCode + '\n' + saveCode)
    .matchAll(/import\(\s*['"](\.\/vendor_cloudbase_esm[^'"]*)['"]\s*\)/g)].map(m => m[1]);
  const unique = [...new Set(imports)];
  ok(imports.length >= 2 && unique.length === 1 && !unique[0].includes('?'),
     '认证与云存档复用同一个无查询串 SDK 模块 URL');
  ok(fs.existsSync(path.join(ROOT, unique[0].replace('./', ''))), '锁定 SDK 文件真实存在');
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
