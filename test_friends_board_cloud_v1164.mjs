#!/usr/bin/env node
/* test_friends_board_cloud_v1164.mjs —— 好友 / 天梯排行榜 / 资料名 · 真 SDK 端到端
 *
 * 为什么要有它：好友和排行榜以前的测试都换了假数据库 —— 假的什么都让写，
 *   于是「接受好友 = 去改对方的记录」「删好友两边都删」这种在真机上根本写不进去的协议一直是绿的；
 *   排行榜第一次打开永远「登录之后才能看到」、权限被拒显示成「还没有人上榜」，也没有一个测试抓到。
 *   这里页面、账号、vendor SDK 都是真的，只有腾讯云由 cloudbase_emulator.mjs 应答
 *   （「读取全部数据，修改本人数据」：legacy = 改别人的静默 0 条，rules = 直接拒绝）。
 *
 *   ① 资料名：HansenSbProfile.displayName() 给出孩子自己起的名字
 *   ② 排行榜：页面刚加载第一次拉榜就成功；没人上榜 = ok + 空列表（空 ≠ 出错）
 *   ③ 好友：A 加 B → B 看到「想加你」；B 加回 → 互为好友；招呼收得到；删好友只删自己那条
 *      —— 全程没有一次去改别人的记录
 *   ④ 好友页盖在大PK屏之上、打开好友页不会冒出看门狗救援屏
 *   ⑤ 集合没建 → 说清楚建哪个集合、权限选什么（好友页显示「云端设置还差一步」）
 *   ⑥ 排行榜上传 / 拉取被拒要报出来；刷新后第一次开天梯页榜直接显示；断网 → kind network
 *   ⑦ 岛屿页：好友页盖在拼写大PK屏上面（点得到）
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('好友 / 天梯排行榜 / 资料名 · 真 SDK 端到端（v1164）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null;
const names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const j = (x) => { try { return JSON.stringify(x).slice(0, 500); } catch (e) { return String(x); } };
const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenLadderBoard && window.HansenSbProfile && window.HansenLadderUI);

async function phone(name, user, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, { name, ready: READY });
  live.push(p);
  const r = await H.loginPassword(p, user, 'pw123456');
  const prof = await p.eval(async (n) => {
    window.HansenSbProfile.setName(n);
    /* 登录后台会去云端发竞赛 ID：等它落定（读有延迟时 ensureProfile 会多读几次） */
    for (let i = 0; i < 40 && !(window.HansenSbProfile.readProfile() || {}).cid; i++) await new Promise((z) => setTimeout(z, 250));
    return window.HansenSbProfile.readProfile();
  }, nick);
  await t.ok(r && r.ok && prof && prof.cid > 0, `[${name}] 用户名登录 + 云端发了竞赛 ID（cid=${prof && prof.cid}）`, () => explain(j(r)));
  if (r && r.uid) names[r.uid] = nick;
  p.cid = prof && prof.cid;
  return p;
}
const friendForeign = () => H.foreignWrites(emu, 'hansen_friends').concat(H.foreignWrites(emu, 'hansen_friend_msgs'));
/* 🔴审查 T11：真云端读有延迟（最终一致）—— 刚写的别人要过一会儿才读得到。这里按 300 毫秒延迟跑，
   每一项「一次刷新（15 秒）之内收敛」就算对：好友页 15 秒刷一次，孩子看到的就是这个 */
async function converge(fn, good, ms = 15000) {
  const t0 = Date.now(); let last = null;
  while (Date.now() - t0 < ms) {
    last = await fn();
    if (good(last)) return last;
    await H.sleep(700);
  }
  return last;
}

async function run(mode) {
  t.section(`READONLY · ${mode}`);
  emu = H.makeEmulator({ knobs: { permissionMode: mode, latencyMs: 40, jitterMs: 60, consistencyLagMs: 300 } });
  emu.seedUser({ username: 'alice_fr', password: 'pw123456', name: 'Alice' });
  emu.seedUser({ username: 'bob_fr', password: 'pw123456', name: 'Bob' });
  const A = await phone('A', 'alice_fr', '小爱'), B = await phone('B', 'bob_fr', '小博');

  /* ① 资料名 */
  const dn = await A.eval(() => ({ dn: window.HansenSbProfile.displayName(), st: window.HansenSbProfile.status() }));
  await t.ok(dn && dn.dn === '小爱' && dn.st && dn.st.name === '小爱', `资料名 displayName() / status().name 是孩子起的名字（${j(dn)}）`);

  /* ② 排行榜：刷新后第一次拉榜（app 还在加载）就要成功；没人上榜是空列表 */
  await A.page.reload({ waitUntil: 'domcontentloaded' });
  await A.page.waitForFunction(READY, null, { timeout: 45000 });
  const first = await A.eval(() => window.HansenLadderBoard.fetchTop());
  await t.ok(first && first.ok === true && Array.isArray(first.list) && first.list.length === 0,
    `★ 页面刚加载第一次拉榜就成功，没人上榜 = ok + 空列表（${j(first)}）`, () => explain());

  /* ③ 好友 */
  const beat = await A.eval(async () => { await window.HansenFriends._beat(); return window.HansenFriends._myOpenid(); });
  const beatB = await B.eval(async () => { await window.HansenFriends._beat(); return window.HansenFriends._myOpenid(); });
  await t.ok(beat && beatB && beat !== beatB, `在线心跳写上了，各自认得出自己的记录（${String(beat).slice(-6)} / ${String(beatB).slice(-6)}）`, () => explain());
  const addAB = await A.eval((c) => window.HansenFriends.addFriend(c), B.cid);
  await t.ok(addAB && addAB.ok && !addAB.mutual, `★ A 加 B：成功，B 还没加回 → 待确认（${j(addAB)}）`, () => explain());
  const lB1 = await converge(() => B.eval(() => window.HansenFriends.listFriends()), (r) => r && r.ok && (r.incoming || []).some((x) => x.cid === A.cid));
  await t.ok(lB1 && lB1.ok && (lB1.incoming || []).some((x) => x.cid === A.cid), `★ B 看到「小爱想加你为好友」（${j(lB1 && lB1.incoming)}）`, () => explain());
  const addBA = await B.eval((c) => window.HansenFriends.addFriend(c), A.cid);
  await t.ok(addBA && addBA.ok && addBA.mutual === true, `★ B 加回 A：直接互为好友（${j(addBA)}）`, () => explain());
  const lA2 = await converge(() => A.eval(() => window.HansenFriends.listFriends()), (r) => ((r && r.friends) || []).some((x) => x.cid === B.cid && !x.pending && x.online === true));
  const lB2 = await converge(() => B.eval(() => window.HansenFriends.listFriends()), (r) => ((r && r.friends) || []).some((x) => x.cid === A.cid && !x.pending));
  const fa = ((lA2 && lA2.friends) || []).find((x) => x.cid === B.cid), fb = ((lB2 && lB2.friends) || []).find((x) => x.cid === A.cid);
  await t.ok(fa && !fa.pending && fb && !fb.pending, '★ 两边都是正式好友', () => explain(j({ lA2, lB2 })));
  await t.ok(fa && fa.online === true && fa.name === '小博', `A 看到 B 刚才还在线 + 名字（${j(fa)}）`);
  await t.ok(friendForeign().length === 0, `★ 加好友没有去改别人的记录（尝试 ${friendForeign().length} 次）`, () => explain(j(friendForeign().slice(0, 3))));

  const sent = await B.eval((c) => window.HansenFriends.sendQuick(c, 'pk'), A.cid);
  await t.ok(sent && sent.ok, `B 给 A 发「来一局？」（${j(sent)}）`, () => explain());
  const inb = await converge(() => A.eval(() => window.HansenFriends.inbox()), (r) => r && r.ok && (r.msgs || []).some((m) => m.from === B.cid));
  await t.ok(inb && inb.ok && inb.msgs.some((m) => m.from === B.cid && /来一局/.test(m.text) && !m.suspicious), `★ A 收到 B 的招呼，发件人可信（${j(inb && inb.msgs)}）`, () => explain());

  /* ④ 好友页：层级、内容、看门狗 */
  const ui = await A.eval(async () => {
    window.HansenFriendsUI.open();
    await new Promise((r) => setTimeout(r, 2500));
    const el = document.getElementById('hsn_friends_screen');
    return { z: el && getComputedStyle(el).zIndex, txt: el ? el.innerText : '' };
  });
  await t.ok(ui && ui.z === '2147483500', `★ 好友页 z-index 2147483500（大PK屏之上、对战屏之下）：${ui && ui.z}`);
  await t.ok(ui && /小博/.test(ui.txt) && /来一局/.test(ui.txt), `★ 好友页上有好友和收到的招呼（${String(ui && ui.txt).slice(0, 160).replace(/\n/g, ' ')}）`, () => explain());
  const wd = await A.eval(async () => {
    window.HansenFriendsUI.close();
    window.HansenLadderUI.open();
    await new Promise((r) => setTimeout(r, 800));
    window.HansenFriendsUI.open();
    await new Promise((r) => setTimeout(r, 8500));
    return { rescue: !!document.getElementById('pkRescue') };
  });
  await t.ok(wd && !wd.rescue, '★ 先开天梯再开好友页：8 秒后不会冒出「这一步没能打开」', () => explain());
  await A.eval(() => window.HansenFriendsUI.close());

  const rm = await A.eval((c) => window.HansenFriends.removeFriend(c), B.cid);
  const lB3 = await converge(() => B.eval(() => window.HansenFriends.listFriends()), (r) => { const f = ((r && r.friends) || []).find((x) => x.cid === A.cid); return f && f.pending === true; });
  const fb3 = ((lB3 && lB3.friends) || []).find((x) => x.cid === A.cid);
  const lA3 = await converge(() => A.eval(() => window.HansenFriends.listFriends()), (r) => r && r.ok && !(r.friends || []).some((x) => x.cid === B.cid));
  await t.ok(rm && rm.ok && fb3 && fb3.pending === true && lA3 && lA3.ok && !(lA3.friends || []).some((x) => x.cid === B.cid),
    '★ A 删 B：A 的列表里没有 B 了，B 那边变回「等他也加你」', () => explain(j({ rm, lB3, lA3 })));
  await t.ok(friendForeign().length === 0, `★ 删好友也只删自己那条（尝试改别人的 ${friendForeign().length} 次）`, () => explain(j(friendForeign().slice(0, 3))));

  /* ⑤ 集合没建 */
  emu.dropCollection('hansen_friend_msgs');
  const miss = await B.eval((c) => window.HansenFriends.sendQuick(c, 'gg'), A.cid);
  await t.ok(miss && !miss.ok && miss.kind === 'config' && /hansen_friend_msgs/.test(miss.reason) && /读取全部数据，修改本人数据/.test(miss.reason),
    `★ 缺 hansen_friend_msgs → 说清楚建哪个集合、权限选什么（${j(miss)}）`);
  const missInbox = await A.eval(() => window.HansenFriends.inbox());
  await t.ok(missInbox && !missInbox.ok && missInbox.kind === 'config', `缺集合时收件箱也报配置问题，不是假装没消息（${j(missInbox)}）`);
  emu.setCollection('hansen_friend_msgs', { acl: H.ACL.READONLY });
  emu.dropCollection('hansen_friends');
  const missUi = await A.eval(async () => {
    window.HansenFriendsUI.open();
    await new Promise((r) => setTimeout(r, 2500));
    const tx = document.getElementById('hsn_friends_screen').innerText; window.HansenFriendsUI.close(); return tx;
  });
  await t.ok(/云端设置还差一步/.test(String(missUi)) && /hansen_friends/.test(String(missUi)) && /技术信息/.test(String(missUi)),
    `★ 缺 hansen_friends → 好友页「云端设置还差一步」+ 集合名 + 技术信息（${String(missUi).slice(0, 160).replace(/\n/g, ' ')}）`);
  emu.setCollection('hansen_friends', { acl: H.ACL.READONLY });

  /* ⑥ 排行榜：两人打满定级赛后上传 */
  const seed = (p) => p.eval(async () => {
    const R = window.HansenPkRecord;
    const G = (res) => ({ mode: 'A', result: res, oppName: '对手', myScore: 300, oppScore: 100, words: 5, correct: 4, totalMs: 7000, firstWins: 3, fastestMs: 800, oppRating: 1000 });
    [G('win'), G('win'), G('lose'), G('win')].forEach((g) => R.record(g));
    return window.HansenLadderBoard.push();
  });
  const pa = await seed(A), pb = await seed(B);
  await t.ok(pa && pa.ok && pb && pb.ok, `★ 两人上传天梯分成功（${j({ pa, pb })}）`, () => explain());
  /* 不清缓存：孩子刚传完分就打开榜（以前榜在本机缓存 60 秒，刚传完那一下拿到的旧榜一挂一分钟） */
  const top = await converge(() => B.eval(() => window.HansenLadderBoard.fetchTop()), (r) => r && r.ok && (r.list || []).length === 2 && r.myRank > 0);
  await t.ok(top && top.ok && top.list.length === 2 && top.list.some((x) => x.name === '小爱') && top.list.some((x) => x.name === '小博') && top.myRank > 0,
    `★ 榜上有两个人（名字是自己起的），也找得到自己（${j(top && top.list)}）`, () => explain());
  const f1 = emu.fault({ action: 'database.updateDocument', collection: 'sb_profile', do: 'code', code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied', times: 3 });
  const perr = await A.eval(() => window.HansenLadderBoard.push());
  f1.remove();
  await t.ok(perr && !perr.ok && perr.kind === 'config' && /sb_profile/.test(perr.reason), `★ 上传被拒要报出来，不是 ok:true（${j(perr)}）`);
  const f2 = emu.fault({ action: 'database.queryDocument', collection: 'sb_profile', do: 'code', code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied', times: 2 });
  const terr = await A.eval(async () => { window.HansenLadderBoard._clearCacheForTest(); return window.HansenLadderBoard.fetchTop(); });
  f2.remove();
  await t.ok(terr && !terr.ok && terr.kind === 'config', `★ 拉榜被拒 → 报错（不是「还没有人上榜」）（${j(terr)}）`);
  await B.page.reload({ waitUntil: 'domcontentloaded' });
  await B.page.waitForFunction(READY, null, { timeout: 45000 });
  const ldTxt = await B.eval(async () => {
    window.HansenLadderUI.open();
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const el = document.getElementById('ldBoard');
      const tx = el ? el.innerText : '';
      if (tx && !/正在|加载|读取/.test(tx)) return tx;
    }
    const el = document.getElementById('ldBoard'); return el ? el.innerText : '(没有 ldBoard)';
  });
  await t.ok(!/登录之后/.test(String(ldTxt)) && /小爱/.test(String(ldTxt)) && /小博/.test(String(ldTxt)),
    `★ 刷新后第一次开天梯页：榜直接显示两个人（${String(ldTxt).slice(0, 120).replace(/\n/g, ' ')}）`, () => explain());
  await B.eval(() => window.HansenLadderUI.close());
  const f3 = emu.fault({ uid: emu.uidOfLogin('alice_fr'), db: true, do: 'abort' });
  const nerr = await A.eval(async () => { window.HansenLadderBoard._clearCacheForTest(); return window.HansenLadderBoard.fetchTop(); });
  f3.remove();
  await t.ok(nerr && !nerr.ok && nerr.kind === 'network', `★ 断网 → kind network（${j(nerr)}）`);

  /* ⑦ 岛屿页：好友页要盖在「拼写大PK」屏上面 */
  await B.page.goto(srv.origin + '/island_animal.html', { waitUntil: 'domcontentloaded' });
  await B.page.waitForFunction(() => !!(window.HansenFriendsUI && window.HansenSbPK), null, { timeout: 45000 });
  await H.sleep(1500);
  const onTop = await B.eval(async () => {
    try { if (window.HansenSbPK.open) window.HansenSbPK.open(); } catch (e) {}
    await new Promise((r) => setTimeout(r, 600));
    const pkEl = document.getElementById('hsn_pk_screen');
    window.HansenFriendsUI.open();
    await new Promise((r) => setTimeout(r, 1500));
    const fr = document.getElementById('hsn_friends_screen');
    const hit = document.elementFromPoint(innerWidth / 2, 300);
    return { pkOn: !!(pkEl && getComputedStyle(pkEl).display !== 'none'), onTop: !!(fr && hit && fr.contains(hit)) };
  });
  await t.ok(onTop && onTop.pkOn && onTop.onTop, `★ 岛屿页：好友页盖在拼写大PK屏上面，点得到（${j(onTop)}）`, () => explain());

  const errs = [...A.errors, ...B.errors];
  await t.ok(!errs.length, `没有页面脚本报错（${errs.slice(0, 2).join(' | ') || '无'}）`);
  const leaks = [...A.leaks, ...B.leaks];
  await t.ok(!leaks.length, `没有一个请求跑到外网（${leaks.slice(0, 2).join(' | ') || '无'}）`);
  for (const p of [A, B]) await p.close();
  live.length = 0;
}

try {
  await run('legacy');
  await run('rules');
} catch (e) {
  await t.ok(false, '测试脚本异常：' + String((e && e.stack) || e).slice(0, 600), () => explain());
} finally {
  for (const p of live) await p.close().catch(() => {});
  await browser.close().catch(() => {});
  srv.close();
}
t.summary();
process.exit(t.failed ? 1 : 0);
