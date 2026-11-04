#!/usr/bin/env node
/* test_session_r2_cloud_v1164.mjs —— 登录 / 退出 / 换账号时云存档对不对（审查第二轮 R2-1、R2-3、R2-4、R2-5、R2-6（账号）、
 * FX-1、FX-7、R2-4（回归））
 *
 * 真页面、真 SDK（真写凭证）；只有腾讯云由 cloudbase_emulator.mjs 应答。云端存档是加密的 ——
 * 「云端里是什么」一律用另一部新手机登录同一个账号、看它恢复出来的东西来判断（孩子换手机就是这样）。
 *
 *   ① 退出登录、再用同一个账号登回来：名字还在，云端也还是带名字的那份（R2-1 / FX-1：以前退出时把资料清空，
 *      登回来以后把空资料传上云，每台设备都成了「点这里设置名字」）
 *   ② 登录那一下读不到云端：先不上传本机这几个词（以前下一次自动同步就把云端 20 个词盖成 3 个）；
 *      网好了自动再对一次账，云端那份恢复到本机（R2-3）
 *   ③ 共用一台手机：甲退出、乙登录，网很慢 —— 换账号时的自动同步不许把甲留下的进度传进乙的账号（R2-4）
 *   ④ 旧版本「用户名注册」的账号点「开始排位」：说实话 + 「📱 用手机号注册」，不说「段位和战绩都还在」（R2-5）
 *   ⑤ 登录面板「☁️ 立即把进度存到云端」失败时说人话，不印 local-empty-refuse-upload（R2-6）
 *   ⑥ 「立即同步」：别的手机刚把云端盖掉，这台点了就真传（R2-4 回归）；云端那条被删了，登录对账时要真传上去（FX-7）
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('登录 / 退出 / 换账号时的云存档 · 真 SDK（审查 R2-1/3/4/5/6、FX-1、FX-7）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const flat = (s) => String(s || '').replace(/\s+/g, ' ');
const has = (s, re) => re.test(String(s || ''));

const ISLAND = { path: '/island_animal.html', ready: () => !!(window.HansenAuth && window.HansenCloudSave && window.HansenSbProfile && window.HansenBackup) };
async function phone(name, opts = ISLAND) {
  const p = await H.openPhone(browser, emu, srv.origin, Object.assign({ name }, opts));
  live.push(p);
  return p;
}
async function closeAll() {
  await H.cleanPhones(t, live);
  for (const p of live) await p.close();
  live.length = 0;
}
async function part(title, fn) {
  /* 只跑某几段（排查用）：R2_ONLY=①,③ node 这个文件 */
  const only = String(process.env.R2_ONLY || '').split(',').filter(Boolean);
  if (only.length && !only.some((x) => title.startsWith(x))) return;
  t.section(title);
  try { await fn(); }
  catch (e) { await t.ok(false, '这一段脚本出错：' + String(e && e.stack || e).slice(0, 500), () => explain()); }
  try { await closeAll(); } catch (e) { /* 已关 */ }
}
/* 用真的 HansenAuth 登录（和面板走同一条路），把登录对账的结果（sync）也带回来 */
async function login(p, num) {
  const r = await p.eval(async ([n, c]) => {
    try {
      await window.HansenAuth.sendPhoneCode(n);
      const x = await window.HansenAuth.loginByPhoneCode(c);
      const s = await window.HansenAuth.ensureSession();
      return { ok: !!(s && s.ok), uid: String((s && s.uid) || (x && x.uid) || ''), sync: (x && x.sync) || null };
    } catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
  }, [num, emu.knobs.verificationCode]);
  if (r && r.uid) { p.uid = r.uid; p.cloudUid = r.uid; names[r.uid] = p.name; }
  await t.ok(r && r.ok && r.uid, `[${p.name}] 登录 ${num.slice(-4)}（对账：${r && r.sync ? (r.sync.action || r.sync.reason) : '—'}）`, () => explain(JSON.stringify(r)));
  return r || {};
}
const words = (p) => p.eval(() => { try { return (JSON.parse(localStorage.getItem('wordIslandFood') || '{}').learned || []).length; } catch (e) { return -1; } });
const setWords = (p, n) => p.eval((k) => { localStorage.setItem('wordIslandFood', JSON.stringify({ learned: Array.from({ length: k }, (_, i) => i + 1) })); return true; }, n);
const saveWrites = (uid) => emu.writes.filter((w) => w.uid === uid && w.collection === 'hansen_saves');
/* 恢复成功以后页面会自己刷新（内存里的旧数据作废）—— 等它刷完再看 */
async function settle(p, ms = 4000) {
  await H.sleep(ms);
  try { await p.page.waitForFunction(ISLAND.ready, null, { timeout: 30000 }); } catch (e) { /* 没刷新 */ }
  await H.sleep(500);
}
/* 换一部全新的手机登录同一个账号：它恢复出来的，就是云端那一份 */
async function cloudWords(num, label) {
  const F = await phone(label || '新手机');
  await login(F, num);
  await settle(F, 3000);
  return { n: await words(F), name: await F.eval(() => { try { return (JSON.parse(localStorage.getItem('hansen_sb_profile_v1002') || '{}').name) || ''; } catch (e) { return ''; } }) };
}

{
  /* ══ ① 退出再登回来 ══════════════════════════════════════════════ */
  await part('① 退出登录、再用同一个账号登回来：名字还在，云端也还在（R2-1 / FX-1）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, consistencyLagMs: 200 } });
    names = {};
    const A = await phone('甲');
    await login(A, '13400000011');
    await A.eval(() => { window.HansenSbProfile.setName('小明同学'); return true; });
    await setWords(A, 10);
    const up = await A.eval(() => window.HansenCloudSave.syncNow({ force: true, rewrite: true }));
    await t.ok(up && up.ok, `先把带名字的进度传上云（${JSON.stringify(up && { ok: up.ok, reason: up.reason })}）`, () => explain());
    await A.eval(() => window.HansenAuth.signOut());
    await H.sleep(800);
    const back = await login(A, '13400000011');
    await settle(A, 2500);
    const nmA = await A.eval(() => window.HansenSbProfile.readProfile().name || '');
    await t.ok(nmA === '小明同学', `登回来以后这台手机上名字还在（「${nmA}」；对账：${back.sync && back.sync.action}）—— 以前退出时清空了，登回来变成「点这里设置名字」`, () => explain());
    const c = await cloudWords('13400000011', '另一台手机');
    await t.ok(c.name === '小明同学' && c.n === 10, `另一台手机登同一个账号：拿到的是带名字的那份（名字「${c.name}」、${c.n} 个词）—— 以前云端被空资料盖掉了`, () => explain());
  });

  /* ══ ② 登录时读不到云端 ══════════════════════════════════════════ */
  await part('② 登录那一下读不到云端：先不上传；网好了自动再对账（R2-3）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, consistencyLagMs: 200 } });
    names = {};
    const T = await phone('平板');
    await login(T, '13400000022');
    await setWords(T, 20);
    const up = await T.eval(() => window.HansenCloudSave.syncNow({ force: true, rewrite: true }));
    await t.ok(up && up.ok, '平板上 20 个词已经在云端', () => explain());
    await T.close(); live.splice(live.indexOf(T), 1);
    const N = await phone('新手机');
    await setWords(N, 3);
    const blk = emu.fault({ db: true, collection: 'hansen_saves', do: 'abort' });
    const ln = await login(N, '13400000022');
    const flag = await N.eval(() => (window.HansenCloudSave.reconcileState ? window.HansenCloudSave.reconcileState() : '(没有这一项)'));
    await t.ok(ln.sync && ln.sync.action === 'cloud-unreachable', `登录时云端读不到：对账结论是「读不到」（${ln.sync && ln.sync.action}）`, () => explain());
    blk.remove();                      /* 网好了 —— 但这台手机还没和这个账号对上账 */
    const w0 = saveWrites(N.uid).length;
    const tLogin = Date.now();
    await setWords(N, 4);
    await N.eval(() => { window.HansenCloudSave.notifyChanged(); return true; });
    /* 岛屿页里嵌着的几层页面（季节页）各有一份账号模块：它们这时想传，也只许排队等那 20 秒 */
    for (const f of N.page.frames()) await f.evaluate(() => { try { if (window.HansenAuth) window.HansenAuth.uploadGate(); } catch (e) {} return true; }).catch(() => {});
    await H.sleep(10000);              /* 8 秒合并上传的时间过了 */
    const wMid = saveWrites(N.uid).length - w0;
    const flagMid = await N.eval(() => (window.HansenCloudSave.reconcileState ? window.HansenCloudSave.reconcileState() : '(没有这一项)'));
    const retried = await N.eval(() => /上次登录时没对上账/.test(String(window.HansenAuth._trace ? window.HansenAuth._trace() : '')));
    await t.ok(flag === N.uid, `记下了「这个账号在这台手机上还没对上账」（${flag || '没记'}）`, () => explain());
    /* 「稍后重试」从失败的那次算起 20 秒内最多一次：以前登录一失败就紧接着再试，网刚恢复就在孩子玩着时恢复云端 + 刷新，
       中间学的那一下把旧进度写回本机、刷新后传上云（慢机器上：传了 1 次、云端 20 → 4）。这一条不靠机器快慢，一改回去就红 */
    await t.ok(flagMid === N.uid && !retried, `登录对账失败后 10 秒里没有马上再对一次账（${retried ? '又对了一次' : '没再对'}；还没对上账的记号：${flagMid || '已清 —— 刚失败就又对上了'}）`, () => explain());
    await t.ok(wMid === 0, `没对上账之前，孩子又学了一个词：一次也没往云端传（传了 ${wMid} 次）—— 以前 4 个词盖掉了云端的 20 个`, () => explain());
    /* 稍后自动重试（切回前台 / 网恢复都会触发；20 秒内最多一次） */
    const wait = 21000 - (Date.now() - tLogin);
    if (wait > 0) await H.sleep(wait);
    await N.eval(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      return true;
    });
    await settle(N, 6000);
    const nN = await words(N);
    const flag2 = await N.eval(() => (window.HansenCloudSave.reconcileState ? window.HansenCloudSave.reconcileState() : '(没有这一项)'));
    await t.ok(nN === 20 && !flag2, `网好了自动再对一次账：云端的 20 个词恢复到了这台手机（本机现在 ${nN} 个；还没对上账的记号：${flag2 || '已清'}）`, () => explain());
    const c = await cloudWords('13400000022', '第三台手机');
    await t.ok(c.n === 20, `云端还是 20 个词（另一台手机拿到 ${c.n} 个）`, () => explain());
  });

  /* ══ ③ 共用手机换账号、网很慢 ═════════════════════════════════════ */
  await part('③ 共用一台手机：甲退出、乙登录，数据库每次要 5 秒 —— 不许把甲的进度传进乙的账号（R2-4）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, consistencyLagMs: 200 } });
    names = {};
    const TB = await phone('乙的平板');
    await login(TB, '13400000033');
    await setWords(TB, 15);
    const upB = await TB.eval(() => window.HansenCloudSave.syncNow({ force: true, rewrite: true }));
    await t.ok(upB && upB.ok, '乙的 15 个词已经在云端', () => explain());
    await TB.close(); live.splice(live.indexOf(TB), 1);
    const S = await phone('共用手机');
    await login(S, '13400000044');
    await setWords(S, 5);
    await S.eval(() => window.HansenCloudSave.syncNow({ force: true, rewrite: true }));
    await S.eval(() => window.HansenAuth.signOut());
    await H.sleep(800);
    emu.knobs.latencyMs = (req) => (new URL(req.url).pathname === '/web' ? 5000 : 40);
    const lb = await login(S, '13400000033');
    emu.knobs.latencyMs = 40;
    await settle(S, 12000);            /* 换账号时排上的自动同步（8 秒多）也到点了 */
    const c = await cloudWords('13400000033', '乙的新手机');
    await t.ok(c.n === 15, `乙的云端还是他自己的 15 个词（另一台手机拿到 ${c.n} 个；登录对账：${lb.sync && lb.sync.action}）—— 以前被甲留下的 5 个词盖掉了`, () => explain());
  });

  /* ══ ④ 旧版本的用户名账号 ════════════════════════════════════════ */
  await part('④ 旧版本「用户名注册」的账号点「开始排位」：说实话，按钮去手机号注册（R2-5）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    names = {};
    const L = await phone('老账号', { path: '/spelling_pk.html' });
    await L.eval(() => { localStorage.setItem('hansen_auth_v1004', JSON.stringify({ method: 'password', username: 'kid_old01', signedAt: Date.now() - 3600 * 1000, uid: '' })); return true; });
    await L.page.reload({ waitUntil: 'domcontentloaded' });
    await L.page.waitForFunction(() => !!(window.HansenAuth && window.HansenLadderUI), null, { timeout: 30000 });
    await H.sleep(800);
    await L.tap('#pkLadder');
    await H.answerNameIfAsked(L, '小蜂老账号');
    const home = await L.waitScreen(/开始排位|手机号注册|要先登录|登录过期/, { timeout: 10000 }).catch((e) => e.lastText || '');
    if (/开始排位/.test(home) && (await L.hitTest('#ldGo', { timeout: 1500 })).ok) await L.tap('#ldGo');
    const scr = await L.waitScreen(/手机号注册|云端登录过期|排位要先登录|云端还没连上|连不上网络/, { timeout: 45000 }).catch((e) => e.lastText || '');
    await t.ok(has(scr, /这个账号要换成手机号注册/) && !has(scr, /段位和战绩都还在/), `说的是「这个账号要换成手机号注册」，不说「段位和战绩都还在」（看到：${flat(scr).slice(0, 120)}）`, () => explain());
    const btn = await L.eval(() => ((document.getElementById('ldGoLogin') || {}).innerText || '').trim());
    await t.ok(/用手机号注册/.test(btn), `按钮是「📱 用手机号注册」（看到：${btn || '没有按钮'}）`, () => explain());
    if (btn) await L.tap('#ldGoLogin');
    const form = await L.hitTest('#auPhone', { timeout: 5000 });
    await t.ok(form.ok, `点了就是手机号注册的表单、手机号框点得到（${form.ok || form.why}）`, () => explain());
  });

  /* ══ ⑤ 「立即把进度存到云端」的失败原因 ══════════════════════════════ */
  await part('⑤ 登录面板「☁️ 立即把进度存到云端」：失败时说人话（R2-6）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    names = {};
    const P = await phone('新账号', { path: '/spelling_pk.html' });
    await login(P, '13400000055');
    await P.eval(() => { window.HansenAuthUI.open(); return true; });
    await P.tap('#auPush');
    const msg = await H.until(async () => {
      const v = await P.eval(() => ((document.getElementById('auMsg') || {}).innerText || '').trim());
      return (typeof v === 'string' && v && !/正在上传|处理中/.test(v)) ? v : null;
    }, { timeout: 25000, interval: 200 }) || '';
    await t.ok(has(msg, /还没有学会的单词/) && !has(msg, /local-empty|refuse|upload-failed|[a-z]+-[a-z]+-[a-z]+/), `一个词都没学过就点：说「还没有学会的单词，先玩一会儿再存」（看到：${msg}）—— 以前「上传没成功：local-empty-refuse-upload」`, () => explain());
  });

  /* ══ ⑥ 「立即同步」要真传 ═══════════════════════════════════════════ */
  await part('⑥ 「立即同步」：别的手机刚把云端盖掉也真传；云端那条被删了，登录对账时真传上去（R2-4 回归 / FX-7）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, consistencyLagMs: 200 } });
    names = {};
    /* 用拼写大PK页：岛屿页里预热着的星海岛隔几秒就改一次自己的进度（每次都算「内容变了」），看不出「没变就跳过」 */
    const SPK = { path: '/spelling_pk.html', ready: ISLAND.ready };
    const B = await phone('乙手机', SPK);
    await login(B, '13400000066');            /* 云端、本机都是空的 */
    const A = await phone('甲手机', SPK);
    await setWords(A, 10);
    await login(A, '13400000066');            /* 云端是空的、本机有 10 个词 → 传上去 */
    await settle(A, 3000);
    /* 甲手机这一份已经传上去了（之后甲手机上什么都没改） */
    const ua = await A.eval(() => window.HansenCloudSave.syncNow({ force: true, rewrite: true }));
    await H.sleep(2500);
    await setWords(B, 2);
    const ub = await B.eval(() => window.HansenCloudSave.syncNow({ force: true, rewrite: true }));
    await t.ok(ua && ua.ok && ub && ub.ok, '甲手机（10 个词）传过一次以后，乙手机（2 个词）又把云端盖掉了', () => explain());
    /* 甲手机上打开设置里的云存档卡片，点「立即同步」 */
    await A.eval(() => { const d = document.createElement('div'); d.id = 'hsnBackupSection'; d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0b1020;overflow:auto;padding:12px'; document.body.appendChild(d); return true; });
    const same = await A.eval(() => window.HansenCloudSave.localHash() === (window.HansenCloudSave.uploadState() || {}).lastHash);
    await t.ok(same === true, `甲手机上的内容和它上次传的一模一样（这正是以前「内容没变化，无需上传」的情形）`, () => explain());
    const w0 = saveWrites(A.uid).length;
    await A.tap('#hsnCloudSync', { timeout: 8000 });
    const said = await H.until(async () => { const v = await A.eval(() => ((document.getElementById('hsnCloudCard') || {}).innerText || '')); return /已上云|内容没变化|同步失败/.test(v) ? v : null; }, { timeout: 15000 }) || '';
    const wA = saveWrites(A.uid).length - w0;
    await t.ok(wA >= 1 && !has(said, /内容没变化/), `点「立即同步」真传了一次（传了 ${wA} 次；卡片上：${(flat(said).match(/(已上云|内容没变化|同步失败)[^ ]{0,16}/) || [''])[0]}）—— 以前「内容没变化，无需上传」，云端还是乙的 2 个词`, () => explain());
    const c1 = await cloudWords('13400000066', '丙手机');
    await t.ok(c1.n === 10, `另一台手机拿到的是甲刚传的 10 个词（${c1.n} 个）`, () => explain());
    /* 云端那条被删了（老师照着指南删了重建集合）→ 登录对账时要真传上去 */
    const doc = (emu.dump('hansen_saves') || []).find((d) => d._openid === A.uid);
    const rm = doc ? await A.eval(async (id) => { const db = (await window.HansenAuth._app()).database(); const r = await db.collection('hansen_saves').doc(id).remove(); return r && (r.code || 'removed=' + r.deleted); }, doc._id) : 'no-doc';
    await H.sleep(1500);   /* 读延迟（200 毫秒）早就过了：云端确实读得到「没有」 */
    const gone = !(emu.dump('hansen_saves') || []).some((d) => d._openid === A.uid);
    await t.ok(gone, `云端那条存档删掉了（${rm}）`, () => explain());
    const w1 = saveWrites(A.uid).length;
    const s2 = await A.eval(() => window.HansenAuth.syncOnLogin());
    await H.sleep(1500);
    const back = (emu.dump('hansen_saves') || []).some((d) => d._openid === A.uid);
    const wrote = saveWrites(A.uid).length - w1;
    await t.ok(s2 && s2.action === 'uploaded' && back && wrote >= 1, `对账发现云端没有、本机有 → 真传上去了（对账：${s2 && s2.action}；传了 ${wrote} 次；云端${back ? '又有了' : '还是空的'}）—— 以前「内容没变」跳过，嘴上说「进度已存到云端」`, () => explain());
  });
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
