#!/usr/bin/env node
/* test_two_tabs_cloud_v1164.mjs —— 同一部手机开着两个页面，两边同时去刷新登录令牌（审查 AUTH-5）
 *
 * 真页面、真账号模块、真凭证守护、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答。
 *
 * 刷新令牌是一次性的：页面 1 先刷新成功、换到了新令牌；页面 2 拿旧令牌去刷新被拒（invalid_grant），
 * SDK 顺手把存储里的凭证删了 —— 连页面 1 刚写进去的新令牌一起删掉。
 * 以前凭证守护的备份 3 秒才更新一次，救回来的是那张已经用掉的旧令牌，再被拒一次就判「过期」、
 * 清掉两个页面共用的登录记录：两个页面都被退出登录，可页面 1 的云端会话其实好好的。
 * 现在：刷新一成功就马上备份新令牌；救回来的是最新那张，登录记录不清。
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('同一部手机两个页面同时刷新令牌 · 真 SDK 端到端（审查 AUTH-5）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null;
const names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const sess = async (fnEval) => fnEval(async () => { const s = await window.HansenAuth.ensureSession(); return { ok: !!s.ok, kind: s.kind || '', expired: !!s.expired }; });

try {
  for (let round = 1; round <= 2; round++) {
    t.section(`第 ${round} 次：两个页面同时醒来、同时刷新`);
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 30 } });
    const A = await H.openPhone(browser, emu, srv.origin, { name: '页面1' });
    live.push(A);
    emu.knobs.accessTokenTtlSec = 35;            /* SDK 记的过期点 = 35-30 = 5 秒后 */
    const lg = await H.loginPhone(A, '13800000' + (700 + round));
    emu.knobs.accessTokenTtlSec = 7200;
    names[lg.uid] = '同一个孩子';
    await t.ok(lg && lg.ok, `登录 uid=${lg && lg.uid}`, () => explain(JSON.stringify(lg)));
    /* 同一个浏览器里再开一页（共用 localStorage，各有一份 SDK） */
    const p2 = await A.ctx.newPage();
    const errs2 = [];
    p2.on('pageerror', (e) => errs2.push(String(e && e.message || e).slice(0, 160)));
    await p2.goto(srv.origin + '/spelling_pk.html', { waitUntil: 'domcontentloaded' });
    await p2.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom), null, { timeout: 45000 });
    await H.sleep(800);
    const first2 = await sess((f) => p2.evaluate(f));
    await t.ok(first2.ok, `第二个页面一打开也是登录着的（${JSON.stringify(first2)}）`, () => explain());
    /* 过了「刚登录 60 秒」的保护期（直接把登录时间往前拨，不用干等一分钟） */
    await A.eval(() => { const lc = JSON.parse(localStorage.getItem('hansen_auth_v1004')); lc.signedAt = Date.now() - 3600e3; localStorage.setItem('hansen_auth_v1004', JSON.stringify(lc)); return true; });
    await H.sleep(6500);                           /* 两边的 SDK 都认为令牌该刷新了 */
    const [r1, r2] = await Promise.all([sess((f) => A.eval(f)), sess((f) => p2.evaluate(f))]);
    const tok = emu.log.filter((e) => /\/token$/.test(e.path)).map((e) => `${e.status}${e.code ? ' ' + e.code : ''}`);
    await H.sleep(4000);
    const signed = await A.eval(() => HansenAuth.isSignedIn());
    const again1 = await sess((f) => A.eval(f));
    const again2 = await sess((f) => p2.evaluate(f));
    const db1 = await A.eval(async () => {
      try { const a = await HansenAuth._app(); const r = await a.database().collection('sb_profile').limit(1).get(); return r && r.code ? 'code ' + r.code : 'ok'; }
      catch (e) { return 'ERR ' + String(e && (e.message || e.error) || e).slice(0, 60); }
    });
    await t.ok(!r1.expired && !r2.expired, `同时刷新：两边都没被判「登录过期」（页面1 ${JSON.stringify(r1)}，页面2 ${JSON.stringify(r2)}；刷新请求：${tok.join(', ')}）`, () => explain());
    await t.ok(signed, `两个页面共用的登录记录还在（已登录=${signed}）—— 以前被一个页面的「过期」清掉，两边一起退出`, () => explain());
    await t.ok(again1.ok && again2.ok, `过一会儿两边都照常能用云端（页面1 ${JSON.stringify(again1)}，页面2 ${JSON.stringify(again2)}；页面1 读库：${db1}）`, () => explain());
    await t.ok(!A.errors.length && !errs2.length, `没有页面报错（${A.errors.concat(errs2).slice(0, 2).join(' | ') || '无'}）`);
    await A.close(); live.length = 0;
  }
} catch (e) {
  await t.ok(false, '测试脚本自己出错：' + String(e && e.stack || e).slice(0, 600), () => explain());
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
