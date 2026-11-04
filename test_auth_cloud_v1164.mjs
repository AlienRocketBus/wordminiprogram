#!/usr/bin/env node
/* test_auth_cloud_v1164.mjs —— 登录 / 会话 / 备份：真 SDK 写真凭证，只有网络是模拟的
 *
 * 为什么要有它：「已登录却进不了天梯」「云端会话尚未就绪」反复出现，而登录测试全绿 ——
 *   它们注入替身 SDK，替身不会删凭证、不会轮换刷新令牌、不会缺 user_info 缓存。
 *   这里 vendor SDK 是真的（真写 credentials_<env> / user_info_<env>），
 *   腾讯云由 cloudbase_emulator.mjs 应答（刷新令牌只能用一次、会话会被吊销）。
 *
 *   ① 手机号注册：在界面上点「注册 / 登录」→ 填号 → 获取验证码 → 填码 → 登录成功，云端真有这个账号
 *   ② 用户名登录：密码错了如实说、不写「已登录」；密码对了登录成功
 *   ③ 用户名注册如实拒绝：不写「已登录」、不发任何注册请求；界面只给「用手机号注册」
 *   ④ 登录响应缺 expires_in（SDK 会删凭证却照样 resolve）→ 不许假装登录成功
 *   ⑤ SDK 的 user_info 缓存没了 → 自动向云端补回 uid，照样能开房
 *   ⑥ user_info 缓存坏了 → 修好，不把人登出
 *   ⑦ 完整备份不收 SDK 的键；恢复一份带着 SDK 键的老快照，也不会动当前的凭证
 *   ⑧ 会话被吊销、过了刚登录的保护期 → 点排位要被引去登录（不是「连不上网络」），重新登录后照常
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('登录 / 会话 / 备份 · 真 SDK 端到端（v1164）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const has = (txt, re) => re.test(String(txt || ''));
const flat = (s) => String(s || '').replace(/\s+/g, ' ');
const ENV = H.cloudConfig().env;
const SDK_KEY = new RegExp('^(credentials|user_info|lang|access_token|refresh_token|login_type|anonymous_uuid|token_type)_|^device_id$|^x[-_]tcb|^tcb[-_]|' + ENV.replace(/[-]/g, '\\-'));

async function open(name) { const p = await H.openPhone(browser, emu, srv.origin, { name }); live.push(p); return p; }
const authState = (p) => p.eval((env) => ({
  signed: window.HansenAuth.isSignedIn(), cred: (localStorage.getItem('credentials_' + env) || '').length,
  info: localStorage.getItem('user_info_' + env), local: window.HansenAuth.readLocal(),
}), ENV);

try {
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 40, consistencyLagMs: 200 } });
  const pw = emu.seedUser({ username: 'kid_pw01', password: 'pw123456', name: '用户名小孩' });
  names[pw.uid] = '用户名小孩';

  /* ⑧ 先登上这一部：它要等过「刚登录 60 秒」的保护期，等的时候先测别的 */
  const X = await open('过期');
  emu.knobs.accessTokenTtlSec = 35;            // SDK 记的过期点 = 35-30 = 5 秒后
  const lx = await H.loginPhone(X, '13800000081');
  emu.knobs.accessTokenTtlSec = 7200;
  const xLoginAt = Date.now();
  names[lx.uid] = '过期'; X.nick = '小蜂过期';
  await t.ok(lx && lx.ok, `[过期] 先登录（令牌 5 秒后要刷新）uid=${lx && lx.uid}`, () => explain(JSON.stringify(lx)));
  emu.revokeSessions(lx.uid);                 // 云端把这次登录作废了（真机：别处刷新撞掉 / 长期不用）

  /* ══ ① 手机号注册（界面） ══════════════════════════════════════ */
  t.section('① 手机号注册：在界面上点出来');
  const P = await open('手机号');
  const said = await H.loginPhoneUI(P, '13800000082');
  const uidP = emu.uidOfLogin('+86 13800000082');
  names[uidP] = '手机号';
  await t.ok(has(said, /登录成功/) && uidP, `界面显示「登录成功」，云端真建了这个账号（uid=${uidP}；看到：${flat(said).slice(0, 80)}）`, () => explain());
  let st = await authState(P);
  const sP = await P.eval(() => HansenAuth.ensureSession());
  await t.ok(st.signed && st.cred > 50 && sP && sP.ok && sP.uid === uidP, `本机有真凭证（${st.cred} 字节）、会话可用、uid 对得上（${sP && sP.uid}）`, () => explain());
  const prof = (emu.dump('sb_profile') || []).find((d) => d._openid === uidP);
  await t.ok(!!prof, '登录后在 sb_profile 建了自己的档案（自己建的文档）', () => explain());

  /* ══ ② 用户名登录（界面） ══════════════════════════════════════ */
  t.section('② 用户名 + 密码登录');
  const Q = await open('用户名');
  await Q.tap('#pkReg');
  await Q.tap('.au_tab[data-m="password"]');
  await Q.tap('#auUser'); await Q.type('kid_pw01');
  await Q.tap('#auPwd'); await Q.type('wrong-pass');
  await Q.tap('#auGo');
  const bad = await H.authPanelMsg(Q);
  st = await authState(Q);
  await t.ok(!has(bad, /登录成功/) && !st.signed && !st.cred, `密码错了：如实说没成功，不写「已登录」（看到：${flat(bad).slice(-80)}）`, () => explain());
  await Q.tap('#auPwd'); await Q.page.keyboard.press('Control+A'); await Q.page.keyboard.press('Backspace');
  await Q.type('pw123456');
  await Q.tap('#auGo');
  const good = await H.authPanelMsg(Q);
  const sQ = await Q.eval(() => HansenAuth.ensureSession());
  await t.ok(has(good, /登录成功/) && sQ && sQ.ok && sQ.uid === pw.uid, `密码对了：登录成功，uid 是这个用户名账号（${sQ && sQ.uid}）`, () => explain());

  /* ══ ③ 用户名注册如实拒绝 ═══════════════════════════════════════ */
  t.section('③ 用户名注册：如实拒绝');
  const R = await open('注册');
  const before = emu.log.length;
  const rr = await R.eval(() => window.HansenAuth.registerByPassword('newkid01', 'pw123456').then(() => ({ ok: true }), (e) => ({ ok: false, msg: String((e && e.message) || e) })));
  st = await authState(R);
  const sent = emu.log.slice(before).filter((e) => /\/auth\/v1\/(signup|verification)/.test(e.path));
  await t.ok(rr && !rr.ok && has(rr.msg, /手机号/), `registerByPassword 如实拒绝，并指向手机号注册（${flat(rr && rr.msg).slice(0, 90)}）`);
  await t.ok(!st.signed && !st.cred && !sent.length, `没写「已登录」、没凭证、没发注册/验证码请求（发了 ${sent.length} 个）`, () => explain());
  await R.tap('#pkReg');
  await R.tap('.au_tab[data-m="password"]');
  /* 只看登录面板里的按钮（面板后面大PK首页的「注册 / 登录」入口不算） */
  const btns = await R.eval(() => { const card = document.getElementById('auUser') && document.getElementById('auUser').closest('.au_card'); return card ? [...card.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => b.innerText.trim()) : null; });
  const fakeReg = (btns || []).filter((x) => /注册/.test(x) && !/手机号/.test(x));
  await t.ok(Array.isArray(btns) && !fakeReg.length, `用户名那一页没有假的「注册」按钮（${fakeReg.join(' / ') || '没有'}）`, () => explain());
  await R.tap('#auPwToPhone');
  await t.ok((await R.hitTest('#auPhone', { timeout: 3000 })).ok, '点「用手机号注册」→ 换到手机号那一页、输入框点得到', () => explain());

  /* ══ ④ 登录响应缺 expires_in ═══════════════════════════════════ */
  t.section('④ 登录响应缺 expires_in（SDK 删了凭证却照样 resolve）');
  emu.knobs.omitExpiresIn = true;
  await R.tap('.au_tab[data-m="password"]');
  await R.tap('#auUser'); await R.type('kid_pw01');
  await R.tap('#auPwd'); await R.type('pw123456');
  await R.tap('#auGo');
  const m4 = await H.authPanelMsg(R);
  emu.knobs.omitExpiresIn = false;
  st = await authState(R);
  await t.ok(m4 && !has(m4, /登录成功/) && !st.signed && !st.cred, `不许假装登录成功（面板上写：${flat(m4).slice(0, 90)}；已登录=${st.signed}）`, () => explain());
  await t.ok(m4 && /[\u4e00-\u9fa5]/.test(m4) && !has(m4, /object Object|undefined/), `失败原因是人话，不是 [object Object]（${flat(m4).slice(0, 60)}）`, () => explain());
  /* 用户名存在、密码也对 —— 是云端没给有效凭证。说「没找到这个用户名 / 密码不对」就是乱写，孩子会去改一个本来没错的东西 */
  await t.ok(m4 && !has(m4, /没找到这个用户名|密码不对|密码错/), `失败原因要说实话：账号和密码都没错，是登录没真正完成（面板上写：${flat(m4).slice(0, 60)}）`, () => explain());

  /* ══ ⑤ user_info 缓存没了 ═══════════════════════════════════════ */
  t.section('⑤ SDK 的 user_info 缓存没了 → 自动补回');
  await P.eval((env) => localStorage.removeItem('user_info_' + env), ENV);
  await P.page.reload({ waitUntil: 'domcontentloaded' });
  await P.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI && window.HANSEN_VOCAB_ALL), null, { timeout: 45000 });
  await H.sleep(800);
  const s5 = await P.eval(() => HansenAuth.ensureSession());
  st = await authState(P);
  await t.ok(s5 && s5.ok && s5.uid === uidP && st.info && st.info.includes(uidP), `会话照样可用、uid 从云端补回、缓存也补上了（uid=${s5 && s5.uid}）`, () => explain(JSON.stringify(s5)));
  await P.tap('#pkRooms'); await H.answerNameIfAsked(P, '小蜂手机');
  await P.waitScreen(/开一间/, { timeout: 10000 }).catch(() => '');
  await P.tap('#prNew'); await P.tap('.pr_mode[data-mode="C"]');
  const w5 = await P.waitScreen(/等对手进来/, { timeout: 15000 }).catch((e) => e.lastText || '');
  const room5 = H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === uidP);
  await t.ok(has(w5, /等对手进来/) && room5 && room5.hostId === 'u' + uidP, `开房照常（房主身份 ${room5 && room5.hostId}）`, () => explain());
  await P.tap('#prBack');
  const gone5 = await H.until(() => !H.roomDocs(emu).some((d) => d.kind === 'room' && d._openid === uidP), { timeout: 8000 });
  await t.ok(gone5, '没人来就关掉房间 → 自己的房删掉了，不留幽灵房', () => explain());

  /* ══ ⑥ user_info 缓存坏了 ═══════════════════════════════════════ */
  t.section('⑥ user_info 缓存坏了 → 修好，不登出');
  await Q.eval((env) => localStorage.setItem('user_info_' + env, '{"version":"localCachev1","content":{"uid":'), ENV);
  await Q.page.reload({ waitUntil: 'domcontentloaded' });
  await Q.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom), null, { timeout: 45000 });
  await H.sleep(800);
  const s6 = await Q.eval(() => HansenAuth.ensureSession());
  st = await authState(Q);
  let infoOk = false; try { infoOk = !st.info || !!JSON.parse(st.info); } catch (e) { infoOk = false; }
  await t.ok(s6 && s6.ok && s6.uid === pw.uid && st.signed && infoOk, `会话照样可用（uid=${s6 && s6.uid}）、没被登出、坏缓存修好了`, () => explain(JSON.stringify(s6)));

  /* ══ ⑦ 完整备份不碰 SDK 的键 ═══════════════════════════════════ */
  t.section('⑦ 完整备份 / 恢复不碰 SDK 的键');
  const ls = await P.local();
  const sdkHere = Object.keys(ls).filter((k) => SDK_KEY.test(k));
  await t.ok(sdkHere.some((k) => k.startsWith('credentials_')) && sdkHere.some((k) => k.startsWith('user_info_')), `本机确实有 SDK 的键（${sdkHere.join(', ')}）`);
  const items = await P.eval(() => window.HansenBackup.build().items.map((x) => x.key));
  const inBak = (Array.isArray(items) ? items : []).filter((k) => SDK_KEY.test(k));
  await t.ok(Array.isArray(items) && items.length > 0 && !inBak.length, `备份里一个 SDK 键都没有（共 ${items && items.length} 项；混进来的：${inBak.join(', ') || '无'}）`, () => explain());
  const restored = await P.eval((env) => {
    const B = window.HansenBackup, base = B.build();
    const items = base.items.concat([
      { key: 'user_info_' + env, value: 'old-garbage' }, { key: 'device_id', value: '0000' },
      { key: 'credentials_' + env, value: '{"refresh_token":"stale"}' }, { key: 'lang_' + env, value: 'en' }]);
    items.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    let h = 2166136261; const s = items.map((x) => x.key + '\u0000' + x.value).join('\u0001');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    const payload = Object.assign({}, base, { items, checksum: 'fnv1a32-' + (h >>> 0).toString(16).padStart(8, '0') });
    try { B.restore(JSON.stringify(payload)); return { ok: true }; } catch (e) { return { ok: false, msg: String(e.message || e) }; }
  }, ENV);
  const ls2 = await P.local();
  const changed = sdkHere.filter((k) => ls2[k] !== ls[k]);
  const s7 = await P.eval(() => HansenAuth.ensureSession());
  await t.ok(restored && restored.ok && !changed.length && s7 && s7.ok && s7.uid === uidP,
    `恢复一份带 SDK 键的老快照：成功恢复，凭证/缓存一个字没动，会话照常（${restored && restored.ok ? '' : restored && restored.msg}${changed.length ? ' 被改的：' + changed.join(',') : ''}）`, () => explain());

  /* ══ ⑧ 会话被吊销 → 引去登录 ══════════════════════════════════ */
  t.section('⑧ 云端会话没了、过了刚登录的保护期 → 点排位被引去登录');
  const waitLeft = 62000 - (Date.now() - xLoginAt);
  if (waitLeft > 0) await H.sleep(waitLeft);
  await X.tap('#pkLadder');
  await H.answerNameIfAsked(X, X.nick);
  await X.tap('#ldGo').catch(() => {});
  const seen = new Set(); let auth = false, last = '';
  const t0 = Date.now();
  while (Date.now() - t0 < 40000) {
    last = (await X.screen()) + ' ' + X.dialogs.map((d) => d.message).join(' ');
    for (const k of [/连不上网络/, /云端还没连上/, /云端设置还差一步/, /登录过期|过期了/, /先登录|去登录|重新登录/]) if (k.test(last)) seen.add(k.source);
    if ((await X.hitTest('#auPhone', { timeout: 200 })).ok) { auth = true; break; }
    const lb = await X.hitTest('#ldGoLogin', { timeout: 200 });
    if (lb.ok) await X.tap('#ldGoLogin').catch(() => {});
    await H.sleep(500);
  }
  await t.ok(auth, `最后出现了登录面板（手机号输入框点得到）（${Math.round((Date.now() - t0) / 1000)} 秒；看到过：${[...seen].join('、') || '无'}）`, () => explain(flat(last).slice(0, 200)));
  await t.ok(![...seen].some((k) => /连不上网络|云端还没连上|云端设置/.test(k)), `没有说成「断网」「云端没连上」「云端设置」（看到过：${[...seen].join('、') || '无'}）`, () => explain());
  st = await authState(X);
  await t.ok(!st.signed, `本机「已登录」记录清掉了（已登录=${st.signed}），界面不再挂着假的「已登录」`, () => explain());
  if (auth) {
    await X.tap('#auPhone'); await X.type('13800000081');
    await X.tap('#auSend'); await X.waitScreen(/验证码已发送/, { timeout: 15000 }).catch(() => '');
    await X.tap('#auCode'); await X.type(emu.knobs.verificationCode);
    await X.tap('#auGo');
    const relog = await H.authPanelMsg(X);
    const sx = await X.eval(() => HansenAuth.ensureSession());
    await t.ok(has(relog, /登录成功/) && sx && sx.ok && sx.uid === lx.uid, `重新登录同一个手机号 → 还是原来的账号（uid=${sx && sx.uid}）`, () => explain());
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
