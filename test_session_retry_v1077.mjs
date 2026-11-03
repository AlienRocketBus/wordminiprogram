const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_session_retry_v1077.mjs —— 空登录态必须重试，且「尚未就绪」≠「已过期」
 *
 * 事故（用户真机，明确确认「刚退出登录、重新用手机号登录成功了」）：
 *   ③  已登录 +86 186xxxxxxxx
 *   ③b 云端会话已失效
 *   实测写入失败：「云端登录已过期，请重新登录后再同步」
 *
 * 根因链：
 *   登录成功 → SDK **异步**把凭证写进本地存储（还没落定）
 *     ↓ 这几百毫秒内
 *   开机恢复 / 面板 / 上传 去问 getLoginState() → 返回空
 *     ↓ v1059 把空标成 expired:true（"确凿过期"），且**一次重试都没有**
 *   吐出「云端登录已过期，请重新登录」→ 用户退出重登 → 循环重演
 *
 * 用户因此被困死循环：**每次登录都真的成功，每次都在凭证落定前被问了一次。**
 *
 * 合同：
 *   ① 空登录态要重试若干次，中途一旦拿到 uid 就算成功
 *   ② 重试到底仍空 → notReady:true 且 expired:false（不得说成"已过期"）
 *   ③ 云端明确的鉴权错误 → 立刻判定 expired/definite，不做无谓重试
 *   ④ 刚登录 60 秒内即使确凿失效也不清本地标记（v1063 防线不得因本次改动丢失）
 *   ⑤ 面板用的 verifySession 必须与 ensureSession 同一套判据（不许两处真源）
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('空登录态重试与三态区分 v1077');

const src = fs.readFileSync((__HSN_ROOT + 'hansen_auth_v1004.js'), 'utf8');

function mk(loginStates) {
  const store = { _d: {}, getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; },
    get length() { return Object.keys(this._d).length; }, key(i) { return Object.keys(this._d)[i] || null; } };
  store.setItem('hansen_auth_v1004', JSON.stringify({ method: 'phone', signedAt: Date.now(), uid: 'U1' }));
  const events = [];
  const win = {
    localStorage: store, console, Date, Math, JSON, Object, Promise, Error, String, Number, Array, RegExp,
    setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 8)),
    document: { addEventListener() {}, dispatchEvent(e) { events.push(e); return true; },
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = (o || {}).detail; } },
    addEventListener() {}, crypto: { getRandomValues: a => a }, TextEncoder, TextDecoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
  };
  win.window = win;
  const ctx = { ...win, window: win };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const A = ctx.window.HansenAuth;
  let n = 0;
  A._setAuthForTest({
    getLoginState: () => {
      const s = loginStates[Math.min(n, loginStates.length - 1)];
      n++;
      return (s && s.__throw) ? Promise.reject(s.__throw) : Promise.resolve(s);
    }
  });
  return { A, store, events, calls: () => n };
}

/* ① 前几次空、之后拿到 uid → 必须成功 */
{
  const { A, calls } = mk([null, null, { user: { uid: 'U-OK' } }]);
  const r = await A.ensureSession();
  ok(r.ok === true, `★ 空了两次后拿到 uid → 判定成功（uid=${r.uid}）`);
  ok(calls() >= 3, `★ 确实重试了（共问了 ${calls()} 次，不是问一次就下结论）`);
}

/* ② 一直空 → notReady，且绝不说成"已过期" */
{
  const { A } = mk([null]);
  const r = await A.ensureSession();
  ok(r.ok === false, '一直空 → 不放行云端操作');
  ok(r.notReady === true, '★ 标记为 notReady（尚未就绪）');
  ok(r.expired === false, '★ **不得**标记为 expired —— 这正是让用户陷入死循环的那一步');
  ok(/尚未就绪/.test(r.reason) && !/已过期/.test(r.reason),
     `★ 文案是"稍候重试"而非"重新登录"：${r.reason}`);
}

/* ③ 云端确凿鉴权错误 → 立刻判 expired，不做无谓重试 */
{
  const { A, calls } = mk([{ __throw: { error: 'unauthenticated', error_description: 'credentials not found' } }]);
  const r = await A.ensureSession();
  ok(r.expired === true && r.definite === true, '★ 确凿鉴权错误 → expired + definite');
  ok(calls() === 1, `★ 确凿错误不重试（只问了 ${calls()} 次）`);
  ok(!/\[object Object\]/.test(String(r.reason)), `错误可读：${r.reason}`);
}

/* ④ v1063 新鲜期防线不得丢失 */
{
  const { A, store, events } = mk([{ __throw: { error: 'unauthenticated', error_description: 'credentials not found' } }]);
  await A.ensureSession();
  const lc = JSON.parse(store.getItem('hansen_auth_v1004') || '{}');
  ok(lc.method === 'phone', '★ 刚登录 60 秒内即使确凿失效也不清本地标记（v1063 防线仍在）');
  ok(events.length === 0, '★ 新鲜期内不发登出广播');
}

/* ⑤ 面板与云存档必须同一套判据 */
{
  const { A } = mk([null, null, { user: { uid: 'U-OK' } }]);
  const v = await A.verifySession();
  ok(v.ok === true && v.uid === 'U-OK', '★ verifySession 同样受益于重试（面板 ③b 不再误报）');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/function verifySession\(\)\s*\{\s*return ensureSession\(\)/.test(code),
     '★ verifySession 直接复用 ensureSession（不许两处各写一套判据）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
