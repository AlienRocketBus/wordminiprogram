#!/usr/bin/env node
/* test_friends_r2_cloud_v1164.mjs —— 好友 / 收件箱 / 排行榜：读有延迟、冒充好友、不让排序、页面放着不动
 *（审查第二轮 FX-4、安全 R2-2、T7、R2-5（回归，配额））
 *
 * 真页面、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答。
 *
 *   ① 新手机第一次用好友、读有 2.6 秒延迟：自己的好友记录照样认得出来（FX-4：以前「我的好友」一直是空的、
 *      再点加好友写出重复的、给好友发招呼说「只能给好友发招呼」，刷新页面之前一直这样）
 *   ② 陌生人填上孩子好友的竞赛 ID、写上自己真的 _openid 发一条招呼 —— 显示「来源不明」，不当成好友发的（安全 R2-2）
 *   ③ 云端不让排序（没建索引，回 HTTP 500，SDK 只说 network request error）：排行榜和收件箱照样出来（T7）
 *   ④ 好友页开着：切到后台就不再查库（回来马上刷一次）；5 分钟没碰屏幕就停下、说「点一下刷新」（R2-5 配额）
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('好友 / 收件箱 / 排行榜 · 真 SDK（审查 FX-4、安全 R2-2、T7、R2-5）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const j = (x) => { try { return JSON.stringify(x).slice(0, 400); } catch (e) { return String(x); } };
const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenLadderBoard && window.HansenSbProfile && window.HansenLadderUI);
let seq = 10;

async function phone(name, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, { name, ready: READY });
  live.push(p);
  const r = await H.loginPhone(p, '132000000' + (seq++));
  const prof = await p.eval(async (n) => {
    window.HansenSbProfile.setName(n);
    for (let i = 0; i < 80 && !(window.HansenSbProfile.readProfile() || {}).cid; i++) await new Promise((z) => setTimeout(z, 250));
    return window.HansenSbProfile.readProfile();
  }, nick);
  await t.ok(r && r.ok && prof && prof.cid > 0, `[${name}] 登录 + 云端发了竞赛 ID（cid=${prof && prof.cid}）`, () => explain(j(r)));
  if (r && r.uid) { names[r.uid] = nick; p.uid = r.uid; }
  p.cid = prof && prof.cid; p.nick = nick;
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
/* 读有延迟：一次刷新（15 秒）之内收敛就算对 */
async function converge(fn, good, ms = 16000) {
  const t0 = Date.now(); let last = null;
  while (Date.now() - t0 < ms) {
    last = await fn();
    if (good(last)) return last;
    await H.sleep(800);
  }
  return last;
}
const friendOf = (r, cid) => ((r && r.friends) || []).find((x) => x.cid === cid);
async function befriend(A, B) {
  /* 孩子把竞赛 ID 告诉同学要一会儿 —— 那时两边的在线记录早就写好了（读有延迟时，刚写的几秒内别人读不到） */
  for (const p of [A, B]) await p.eval(async () => { await window.HansenFriends._beat(); return true; });
  await H.sleep((emu.knobs.consistencyLagMs || 0) + 600);
  const a1 = await A.eval((c) => window.HansenFriends.addFriend(c), B.cid);
  const b1 = await B.eval((c) => window.HansenFriends.addFriend(c), A.cid);
  await t.ok(a1 && a1.ok && b1 && b1.ok, `两个人互相加了好友（${j({ a1, b1 })}）`, () => explain());
  const la = await converge(() => A.eval(() => window.HansenFriends.listFriends()), (r) => { const f = friendOf(r, B.cid); return f && !f.pending; });
  const lb = await converge(() => B.eval(() => window.HansenFriends.listFriends()), (r) => { const f = friendOf(r, A.cid); return f && !f.pending; });
  return { la, lb };
}
const reads = (uid, t0, t1) => emu.log.filter((x) => x.uid === uid && x.action === 'database.queryDocument' && /^hansen_friend/.test(x.collection) && x.t >= t0 && x.t < (t1 || Infinity)).length;
async function setHidden(p, hidden) {
  return p.eval((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
    return true;
  }, hidden);
}

{
  /* ══ ① 读有 2.6 秒延迟的新手机 ═══════════════════════════════════ */
  await part('① 新手机第一次用好友、读有 2.6 秒延迟：自己的记录照样认得出（FX-4）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 40, consistencyLagMs: 2600 } });
    names = {};
    const A = await phone('甲', '小爱'), B = await phone('乙', '小博');
    const { la, lb } = await befriend(A, B);
    const fa = friendOf(la, B.cid), fb = friendOf(lb, A.cid);
    await t.ok(fa && !fa.pending && fb && !fb.pending, `两边加了对方：一次刷新之内都显示成正式好友（甲看到：${j(fa)}；乙看到：${j(fb)}）—— 以前「我的好友」一直是空的`, () => explain());
    const again = await A.eval((c) => window.HansenFriends.addFriend(c), B.cid);
    await H.sleep(3000);
    const rows = (emu.dump('hansen_friends') || []).filter((d) => d.kind === 'friend' && d._openid === A.uid && Number(d.friend) === B.cid);
    await t.ok(again && (again.ok || again.already) && rows.length === 1, `再点一次「加好友」：说「已经是好友了」，不写重复的（甲名下加乙的记录 ${rows.length} 条；${j(again)}）`, () => explain());
    const sent = await A.eval((c) => window.HansenFriends.sendQuick(c, 'pk'), B.cid);
    await t.ok(sent && sent.ok, `给好友发「来一局？」成功（${j(sent)}）—— 以前「只能给好友发招呼」`, () => explain());
    const inb = await converge(() => B.eval(() => window.HansenFriends.inbox()), (r) => r && r.ok && (r.msgs || []).some((m) => m.from === A.cid));
    await t.ok(inb && inb.ok && inb.msgs.some((m) => m.from === A.cid && !m.suspicious), `乙一次刷新之内收到甲的招呼，发件人可信（${j(inb && inb.msgs)}）`, () => explain());
  });

  /* ══ ② 冒充好友 ═════════════════════════════════════════════════ */
  await part('② 陌生人冒充孩子的好友发招呼：显示「来源不明」（安全 R2-2）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('甲', '小爱'), B = await phone('乙', '小博'), S = await phone('陌生人', '路人');
    await befriend(A, B);
    const real = await B.eval((c) => window.HansenFriends.sendQuick(c, 'pk'), A.cid);
    await t.ok(real && real.ok, '乙（真好友）发了一条「来一局？」', () => explain());
    /* 陌生人：改过的前端，直接往收件箱写一条 —— 竞赛 ID 填乙的、名字写「小博」、fromOpenid 写自己真的 */
    const spoof = await S.eval(async ([fromCid, toCid]) => {
      await window.HansenFriends._beat();
      const oid = window.HansenFriends._myOpenid();
      const db = (await window.HansenAuth._app()).database();
      const r = await db.collection('hansen_friend_msgs').add({ from: fromCid, fromName: '小博', to: toCid, fromOpenid: oid, qid: 'gg', at: Date.now(), read: false });
      return { oid, r: r && (r.code || r.id || r._id || 'ok') };
    }, [B.cid, A.cid]);
    await t.ok(spoof && spoof.oid, `陌生人写进去了一条假招呼（他自己的 _openid：${String(spoof && spoof.oid).slice(-6)}）`, () => explain(j(spoof)));
    const inb = await converge(() => A.eval(() => window.HansenFriends.inbox()), (r) => r && r.ok && (r.msgs || []).length >= 2);
    const msgs = (inb && inb.msgs) || [];
    const fromB = msgs.filter((m) => m.from === B.cid);
    const odd = msgs.filter((m) => m.suspicious);
    await t.ok(fromB.length === 1 && fromB[0].text && /来一局/.test(fromB[0].text), `真好友的那条照样显示成乙发的（${j(fromB)}）`, () => explain(j(msgs)));
    await t.ok(odd.length === 1 && odd[0].fromName === '(来源不明)', `冒充的那条显示「来源不明」，不显示成「小博」发的（${j(odd)}）—— 以前孩子看到的是好友发来的`, () => explain(j(msgs)));
  });

  /* ══ ③ 云端不让排序 ═════════════════════════════════════════════ */
  await part('③ 云端不让排序（HTTP 500）：排行榜、收件箱照样出来（T7）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, consistencyLagMs: 300, orderByStatus: 500 } });
    names = {};
    const A = await phone('甲', '小爱'), B = await phone('乙', '小博');
    await befriend(A, B);
    await B.eval((c) => window.HansenFriends.sendQuick(c, 'pk'), A.cid);
    const inb = await converge(() => A.eval(() => window.HansenFriends.inbox()), (r) => r && r.ok && (r.msgs || []).some((m) => m.from === B.cid));
    await t.ok(inb && inb.ok && inb.msgs.some((m) => m.from === B.cid), `收件箱照样出来（${j(inb && { ok: inb.ok, kind: inb.kind, n: (inb.msgs || []).length })}）—— 以前一直「连不上网络」`, () => explain());
    const seed = (p) => p.eval(async () => {
      const R = window.HansenPkRecord;
      const G = (res) => ({ mode: 'A', result: res, oppName: '对手', myScore: 300, oppScore: 100, words: 5, correct: 4, totalMs: 7000, firstWins: 3, fastestMs: 800, oppRating: 1000 });
      [G('win'), G('win'), G('lose'), G('win')].forEach((g) => R.record(g));
      return window.HansenLadderBoard.push();
    });
    const pa = await seed(A), pb = await seed(B);
    await t.ok(pa && pa.ok && pb && pb.ok, `两人上传天梯分（${j({ pa, pb })}）`, () => explain());
    await H.sleep(6000);
    await A.eval(() => { window.HansenLadderUI.open(); return true; });
    const board = await converge(() => A.eval(() => ((document.getElementById('ldBoard') || {}).innerText || '')), (s) => /小爱/.test(s) && /小博/.test(s), 15000);
    await t.ok(/小爱/.test(board) && /小博/.test(board) && !/连不上网络/.test(board), `天梯页的排行榜照样出来、两个人都在（${String(board).replace(/\s+/g, ' ').slice(0, 120)}）`, () => explain());
  });

  /* ══ ④ 好友页放着不动 ═══════════════════════════════════════════ */
  await part('④ 好友页：后台不查库、回来马上刷；5 分钟没碰就停下（R2-5 配额）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    names = {};
    const A = await phone('甲', '小爱'), B = await phone('乙', '小博');
    await befriend(A, B);
    await A.eval(() => { window.HansenFriendsUI.open(); return true; });
    await H.sleep(2000);
    const t0 = Date.now();
    await H.sleep(32000);
    const vis = reads(A.uid, t0);
    await setHidden(A, true);
    await H.sleep(500);
    const t1 = Date.now();
    await H.sleep(32000);
    const hid = reads(A.uid, t1);
    await setHidden(A, false);
    const t2 = Date.now();
    await H.sleep(3000);
    const back = reads(A.uid, t2);
    await t.ok(vis >= 2, `好友页开着、在前台：照常隔 15 秒刷一次（32 秒里查了 ${vis} 次库）`, () => explain());
    await t.ok(hid === 0, `切到后台：32 秒里一次也没查（查了 ${hid} 次）—— 以前照样每 15 秒查三次`, () => explain());
    await t.ok(back >= 1, `回到前台：马上刷了一次（3 秒里查了 ${back} 次）`, () => explain());
    /* 孩子 5 分钟没碰屏幕（把手机的钟往后拨 6 分钟 —— 等同于真等了 6 分钟） */
    await A.eval(() => { const now0 = Date.now.bind(Date); const off = 6 * 60 * 1000; Date.now = () => now0() + off; return true; });
    const idle = await converge(() => A.eval(() => !!document.getElementById('frIdle')), (x) => x === true, 20000);
    const t3 = Date.now();
    await H.sleep(17000);
    const idleReads = reads(A.uid, t3);
    const bar = await A.eval(() => ((document.getElementById('frIdle') || {}).innerText || ''));
    await t.ok(idle === true && /点一下刷新/.test(bar), `5 分钟没碰：停下来，说「点一下刷新」（${bar || '没有这一行'}）`, () => explain());
    await t.ok(idleReads === 0, `停下以后不再查库（17 秒里查了 ${idleReads} 次）`, () => explain());
    if (idle) await A.tap('#frIdle');
    const t4 = Date.now();
    await H.sleep(3000);
    const woke = reads(A.uid, t4);
    await t.ok(woke >= 1 && !(await A.eval(() => !!document.getElementById('frIdle'))), `点一下：马上刷新、提示条收起（3 秒里查了 ${woke} 次）`, () => explain());
  });
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
