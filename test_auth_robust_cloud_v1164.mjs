#!/usr/bin/env node
/* test_auth_robust_cloud_v1164.mjs —— 登录会话出状况时，孩子的进度和战绩保不保得住、看到的话对不对
 *（审查第一轮 AUTH-1、AUTH-2、AUTH-3、AUTH-4、AUTH-6、AUTH-7、TI-5）
 *
 * 真页面（含首页 index.html + 岛 iframe）、真账号模块、真云存档、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答。
 *
 *   ① 玩着玩着云端会话死了（审查 AUTH-1 / AUTH-2）：
 *      以前岛里的启动检查一判「过期」就把 uid 清掉 → 首页冒出整屏「别的窗口退出了登录」（根本没有别的窗口）、
 *      天梯战绩当场清零；重新登录后又拿云端的旧档把这段时间玩的进度盖掉。
 *      现在：uid 留着、战绩还在、没有假的「别的窗口」；重新登录把本机这份新进度传上去。
 *   ② 刷新令牌被拒、回的不是 invalid_grant（审查 TI-5）：以前「云端还没连上」无限循环；现在第二次起给「重新登录」。
 *   ③ 同一台手机：手机号账号退出、换用户名账号登录（审查 AUTH-4）：以前用户名账号用的是上一个手机号的云存档。
 *   ④ 新手机登录、自动取回云端进度（审查 AUTH-6）：以前提示「已自动取回云端进度（0 个单词）」。
 *   ⑤ 旧版本「用户名注册」留下的登录记录（审查 AUTH-7）：以前悄悄退出、再登录时说「没找到这个用户名，检查一下拼写」。
 *   ⑥ SDK 文件第一次没下载下来（审查 AUTH-3）：以前浏览器记住那次失败，之后所有云端功能都坏、天梯说「检查 Wi-Fi」。
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('登录会话出状况 · 真 SDK 端到端（审查 AUTH-1/2/3/4/6/7、TI-5）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let names = {};
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 200 } });
const emuT = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
let cur = emu;
const explain = (extra) => H.explainer(cur, () => live, () => names)(extra);
const flat = (s) => String(s || '').replace(/\s+/g, ' ');
const has = (s, re) => re.test(String(s || ''));
const WORDS = Array.from({ length: 30 }, (_, i) => i + 1);   /* 岛的进度里 learned 记的是词的序号；用「食物岛」的键 —— 开着的是动物岛，它会用内存里的那份覆盖自己的键 */

async function open(e, name, opts = {}) {
  const p = await H.openPhone(browser, e, srv.origin, Object.assign({ name }, opts));
  live.push(p);
  return p;
}
async function login(p, e, num) {
  const r = await p.eval(async ([num, c]) => {
    try {
      await window.HansenAuth.sendPhoneCode(num);
      const x = await window.HansenAuth.loginByPhoneCode(c);
      return { ok: !!(x && x.ok), uid: x && x.uid, sync: x && x.sync, reason: x && x.reason };
    } catch (err) { return { ok: false, err: String((err && err.message) || err) }; }
  }, [num, e.knobs.verificationCode]);
  if (r && r.uid) { p.cloudUid = String(r.uid); names[r.uid] = p.name; }
  return r;
}
async function setLearned(p, n) {
  return p.eval((ws) => { localStorage.setItem('wordIslandFood', JSON.stringify({ learned: ws })); return true; }, WORDS.slice(0, n));
}
const learnedOf = (p) => p.eval(() => { try { return (JSON.parse(localStorage.getItem('wordIslandFood') || '{}').learned || []).length; } catch (e) { return -1; } });
const recordOf = (p) => p.eval(() => { try { return JSON.parse(localStorage.getItem('hansen_pk_record_v1') || 'null'); } catch (e) { return null; } });

try {
  /* ══ 先把要等「刚登录 60 秒保护期」的两部手机登上 ═══════════════ */
  /* 首页 index.html 本身不带云存档模块 —— 进度、云存档都在岛（iframe）里，和孩子真用的时候一样 */
  const X = await open(emu, '首页', { path: '/index.html', ready: () => typeof window.openIsland === 'function' && !!window.HansenAuth });
  if ((await X.hitTest('#__hansen_onboarding button', { hasText: '跳过', timeout: 3000 })).ok) await X.tap('#__hansen_onboarding button', { hasText: '跳过' });
  /* 令牌只给 35 秒（SDK 记的过期点是 5 秒后）—— 吊销之前这段时间里 SDK 自己刷新出来的令牌也一样短命，
     吊销以后下一次用云端就一定要去刷新、一定会被拒（真机上就是「长期不用 / 别处刷新撞掉」） */
  emu.knobs.accessTokenTtlSec = 35;
  const lx = await login(X, emu, '13700000101');
  const xAt = Date.now();
  await t.ok(lx && lx.ok, `[首页] 登录 uid=${lx && lx.uid}`, () => explain(JSON.stringify(lx)));
  await X.eval(() => { window.openIsland('island_animal.html'); return true; });
  const fr = await H.until(async () => {
    const f = X.page.frames().find((x) => /island_animal/.test(x.url()));
    return f && (await f.evaluate(() => !!(window.HansenAuth && window.HansenPkRoom && window.HansenCloudSave)).catch(() => false)) ? f : null;
  }, { timeout: 45000, interval: 500 });
  await t.ok(!!fr, '首页里的岛打开了（岛里有云存档模块）');
  await setLearned(X, 10);
  const up = fr ? await fr.evaluate(() => window.HansenCloudSave.syncNow({ force: true })) : null;
  await t.ok(up && up.ok, `学会 10 个词，传到了云端（${JSON.stringify(up && { ok: up.ok, reason: up.reason })}）`, () => explain());
  await X.eval(() => { localStorage.setItem('hansen_pk_record_v1', JSON.stringify({ rating: 1080, peakRating: 1080, placementGames: 3, wins: 5, losses: 1, history: [] })); return true; });
  emu.revokeSessions(lx.uid);
  emu.knobs.accessTokenTtlSec = 7200;

  cur = emuT;
  const Z = await open(emuT, '刷新被拒');
  emuT.knobs.accessTokenTtlSec = 35;
  const lz = await login(Z, emuT, '13700000102');
  emuT.knobs.accessTokenTtlSec = 7200;
  await t.ok(lz && lz.ok, `[刷新被拒] 登录 uid=${lz && lz.uid}`, () => explain(JSON.stringify(lz)));
  emuT.revokeSessions(lz.uid);
  emuT.knobs.refreshErrorCode = 'unauthenticated';
  cur = emu;
  const left = 63000 - (Date.now() - xAt);
  if (left > 0) await H.sleep(left);

  try {
    /* ══ ① 会话死了 ════════════════════════════════════════════════ */
    t.section('① 玩着玩着云端会话死了：岛里的检查判了「过期」（审查 AUTH-1 / AUTH-2）');
    const es = fr ? await fr.evaluate(() => window.HansenAuth.ensureSession()) : null;
    await t.ok(es && es.expired, `岛里的检查：云端会话确实过期了（${JSON.stringify(es && { kind: es.kind, expired: es.expired })}）`, () => explain());
    await H.sleep(1500);
    let top = await X.screen();
    await t.ok(!has(top, /别的窗口/), `首页没有冒出「别的窗口退出了登录」—— 根本没有别的窗口（首页：${flat(top).slice(0, 60)}）`, () => explain());
    const lc = await X.eval(() => ({ uid: HansenAuth.readLocal().uid || '', signed: HansenAuth.isSignedIn() }));
    const rec = await recordOf(X);
    await t.ok(lc.uid === lx.uid && !lc.signed, `本机记的还是这个账号（uid 留着），只是不再算「登录着」（${JSON.stringify(lc)}）`, () => explain());
    await t.ok(rec && rec.wins === 5 && rec.rating === 1080, `天梯战绩还在（${rec ? rec.wins + ' 胜 ' + rec.rating + ' 分' : '被清掉了'}）—— 以前当场清零`, () => explain());
    await setLearned(X, 15);   /* 会话死掉以后接着玩：又学会 5 个词（传不上去） */
    /* 就在岛里重新登录（孩子在岛里点的登录）—— 首页也不能冒出「别的窗口登录了另一个账号」 */
    const re = fr ? await fr.evaluate(async ([num, c]) => {
      try { await window.HansenAuth.sendPhoneCode(num); const x = await window.HansenAuth.loginByPhoneCode(c); return { ok: !!(x && x.ok), uid: x && x.uid, sync: x && x.sync }; }
      catch (err) { return { ok: false, err: String((err && err.message) || err) }; }
    }, ['13700000101', emu.knobs.verificationCode]) : null;
    await H.sleep(1500);
    top = await X.screen();
    await t.ok(!has(top, /别的窗口/), `在岛里重新登录：首页没有冒出「别的窗口」（首页：${flat(top).slice(0, 60)}）`, () => explain());
    const after = await learnedOf(X);
    const cloudN = fr ? await fr.evaluate(() => window.HansenCloudSave.cloudLearned()) : -1;
    await t.ok(re && re.ok && re.uid === lx.uid, `重新登录同一个手机号（${JSON.stringify(re && { ok: re.ok, action: re.sync && re.sync.action })}）`, () => explain(JSON.stringify(re)));
    await t.ok(after === 15 && cloudN === 15, `后来玩的 5 个词没被云端旧档盖掉：本机 ${after} 个、云端 ${cloudN} 个（应都是 15）`, () => explain(JSON.stringify(re && re.sync)));
    const rec2 = await recordOf(X);
    await t.ok(rec2 && rec2.wins === 5, `重新登录后战绩也还在（${rec2 ? rec2.wins + ' 胜' : '没了'}）`);
  } catch (e) {
    await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400), () => explain());
  }

  try {
    /* ══ ② 刷新令牌被拒（不是 invalid_grant）════════════════════════ */
    t.section('② 刷新令牌被拒、回的是 unauthenticated（审查 TI-5）');
    cur = emuT;
    await Z.tap('#pkLadder'); await H.answerNameIfAsked(Z, '小蜂刷新'); await Z.waitScreen(/开始排位/, { timeout: 8000 }).catch(() => '');
    await Z.tap('#ldGo');
    const s1 = await Z.waitScreen(/云端还没连上|去登录|重新登录/, { timeout: 45000 }).catch((e) => e.lastText || '');
    let relogin = (await Z.hitTest('#ldRelogin', { timeout: 500 })).ok || (await Z.hitTest('#ldGoLogin', { timeout: 300 })).ok;
    if (!relogin && has(s1, /云端还没连上/)) {
      await Z.tap('#ldRetry');
      await Z.waitScreen(/云端还没连上/, { timeout: 45000 }).catch(() => '');
      relogin = (await Z.hitTest('#ldRelogin', { timeout: 3000 })).ok;
    }
    await t.ok(relogin, `最多第二次「云端还没连上」就给了「重新登录」这条出路（看到：${flat(await Z.screen()).slice(0, 110)}）—— 以前无限「再试一次」`, () => explain());
    cur = emu;
  } catch (e) {
    await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400), () => explain());
  }

  try {
    /* ══ ③ 换账号：手机号 → 用户名 ═════════════════════════════════ */
    t.section('③ 同一台手机：手机号账号退出，换用户名账号登录（审查 AUTH-4）');
    const pw = emu.seedUser({ username: 'kid_pw77', password: 'pw123456', name: '用户名小孩' });
    names[pw.uid] = '用户名小孩';
    const W = await open(emu, '共用手机');
    const la = await login(W, emu, '13700000103');
    await setLearned(W, 3);
    await W.eval(() => window.HansenCloudSave.syncNow({ force: true }));
    await W.eval(() => window.HansenAuth.signOut());
    const lb = await W.eval(async () => { const r = await window.HansenAuth.loginByPassword('kid_pw77', 'pw123456'); return { ok: !!(r && r.ok), uid: r && r.uid, action: r && r.sync && r.sync.action, reason: r && r.reason }; });
    const lcW = await W.eval(() => HansenAuth.readLocal());
    await t.ok(la && la.ok && lb && lb.ok && lb.uid === pw.uid, `两个账号都登上了（手机号 ${la && la.uid}，用户名 ${lb && lb.uid}）`, () => explain(JSON.stringify(lb)));
    await t.ok(lb && lb.action !== 'restored' && !lcW.phone, `用户名账号没有拿上一个手机号账号的云存档（对账：${lb && lb.action}；本机记的手机号：「${lcW.phone || ''}」）`, () => explain());
  } catch (e) {
    await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400), () => explain());
  }

  try {
    /* ══ ④ 新手机自动取回 ══════════════════════════════════════════ */
    t.section('④ 新手机登录、自动取回云端进度（审查 AUTH-6）');
    const V = await open(emu, '新手机');
    await setLearned(V, 2);
    const lv = await login(V, emu, '13700000101');
    await t.ok(lv && lv.ok && lv.sync && lv.sync.autoPicked === 'cloud' && lv.sync.cloudWords === 15,
      `自动取回云端进度，说的是真实的词数（${lv && lv.sync && lv.sync.cloudWords} 个，应是 15）—— 以前永远「0 个单词」`, () => explain(JSON.stringify(lv && lv.sync)));
  } catch (e) {
    await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400), () => explain());
  }

  try {
    /* ══ ⑤ 旧版本「用户名注册」═════════════════════════════════════ */
    t.section('⑤ 旧版本「用户名注册」留下的登录记录（审查 AUTH-7）');
    const U = await open(emu, '老用户');
    await U.eval(() => { localStorage.setItem('hansen_auth_v1004', JSON.stringify({ method: 'password', username: 'oldkid9', signedAt: Date.now() - 86400e3 })); return true; });
    await U.page.reload({ waitUntil: 'domcontentloaded' });
    await U.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom), null, { timeout: 45000 });
    const eu = await U.eval(() => window.HansenAuth.ensureSession());
    const pl = await U.eval(async () => {
      try { const r = await window.HansenAuth.loginByPassword('oldkid9', 'whatever1'); return { ok: !!(r && r.ok), reason: String((r && (r.reason || r.message)) || '') }; }
      catch (e) { return { ok: false, reason: String(window.HansenAuth.friendly ? window.HansenAuth.friendly(e) : ((e && e.message) || e)) }; }   /* 登录面板就是这样把错误翻成话的 */
    });
    await t.ok(pl && !pl.ok && /以前版本/.test(pl.reason || '') && !/检查一下拼写/.test(pl.reason || ''),
      `再用那个用户名登录：说实话（「${String((pl && pl.reason) || JSON.stringify(pl)).slice(0, 60)}…」）—— 以前说「检查一下拼写」（检查结果：${eu && eu.kind}${eu && eu.legacy ? ' · 旧版本记录' : ''}）`, () => explain());
  } catch (e) {
    await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400), () => explain());
  }

  try {
    /* ══ ⑥ SDK 文件没下载下来 ══════════════════════════════════════ */
    t.section('⑥ SDK 文件第一次没下载下来（审查 AUTH-3）');
    const S = await H.openPhone(browser, emu, srv.origin, { name: '弱信号' });
    live.push(S);
    let cut = 1;
    await S.page.route((u) => { const x = new URL(u); return x.pathname.endsWith('/vendor_cloudbase_esm_v965.js') && !x.search; },
      (r) => { if (cut-- > 0) r.abort('internetdisconnected').catch(() => {}); else r.continue().catch(() => {}); });
    const ls = await login(S, emu, '13700000104');
    await t.ok(ls && ls.ok, `第一次下载 SDK 失败以后，不刷新页面也能登录（${JSON.stringify(ls && { ok: ls.ok, err: ls.err })}）—— 以前浏览器记住失败，什么都用不了`, () => explain());
    await S.page.unroute(() => true).catch(() => {});
    await S.page.route((u) => new URL(u).pathname.endsWith('/vendor_cloudbase_esm_v965.js'), (r) => r.abort('internetdisconnected').catch(() => {}));
    await S.page.reload({ waitUntil: 'domcontentloaded' });
    await S.page.waitForFunction(() => !!(window.HansenAuth && window.HansenLadderUI), null, { timeout: 45000 });
    await H.sleep(500);
    await S.tap('#pkLadder'); await H.answerNameIfAsked(S, '小蜂弱信号'); await S.waitScreen(/开始排位/, { timeout: 8000 }).catch(() => '');
    await S.tap('#ldGo');
    const s6 = await S.waitScreen(/没下载完整|连不上网络/, { timeout: 60000 }).catch((e) => e.lastText || '');
    await t.ok(has(s6, /没下载完整/) && has(s6, /刷新/) && !has(s6, /Wi-Fi/), `SDK 一直下不来：天梯说「云端组件没下载完整 · 刷新页面」，不让人去查 Wi-Fi（看到：${flat(s6).slice(0, 90)}）`, () => explain());
  } catch (e) {
    await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400), () => explain());
  }

  for (const p of live) await t.ok(!p.errors.length, `[${p.name}] 没有页面报错（${p.errors.slice(0, 2).join(' | ') || '无'}）`);
} catch (e) {
  await t.ok(false, '测试脚本自己出错：' + String(e && e.stack || e).slice(0, 600), () => explain());
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
