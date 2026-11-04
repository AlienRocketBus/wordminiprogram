// 好友 / 天梯排行榜 / 资料名 —— 真 SDK + 真页面 + 本地模拟云端（只模拟网络）
// 用法: node friends_board_e2e.mjs [legacy|rules]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createEmulator, ACL } from './emulator.mjs';
import { startStatic, launch, newCtx, E } from './harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] || 'legacy';
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m + (extra !== undefined ? '  ⟶ ' + JSON.stringify(extra).slice(0, 600) : '')); } };

const emu = createEmulator({
  collections: { hansen_pk_rooms: ACL.READONLY, hansen_saves: ACL.READONLY, sb_profile: ACL.READONLY,
    counters: ACL.ADMINONLY, hansen_friends: ACL.READONLY, hansen_friend_msgs: ACL.READONLY, hansen_pk_records: ACL.READONLY },
  knobs: { permissionMode: mode, latencyMs: Number(process.env.EMU_LATENCY || 30), jitterMs: Number(process.env.EMU_JITTER || 0), consistencyLagMs: Number(process.env.EMU_LAG || 0) },
});
emu.seedUser({ username: 'alice_fr', password: 'pw123456', name: 'Alice' });
emu.seedUser({ username: 'bob_fr', password: 'pw123456', name: 'Bob' });

// 变异检查：MUT_UI=文件路径 时用那份好友界面替换仓库里的（验证测试真能抓到旧问题）
const virtual = {};
if (process.env.MUT_UI) virtual['/hansen_friends_ui_v1107.js'] = { type: 'text/javascript; charset=utf-8', body: fs.readFileSync(process.env.MUT_UI, 'utf8') };
const srv = await startStatic(virtual);
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;
const browser = await launch();
const open = async (tag) => {
  const c = await newCtx(browser, emu, ORIGIN, { tag, url: '/spelling_pk.html', waitReady: false, ctxOpts: { serviceWorkers: 'block', viewport: { width: 390, height: 844 } } });
  await c.page.waitForFunction(() => window.HansenAuth && window.HansenFriends && window.HansenLadderBoard && window.HansenSbProfile, null, { timeout: 20000 });
  await c.page.waitForTimeout(800);
  return c;
};
const login = (page, u, name) => E(page, async ({ u, name }) => {
  const r = await window.HansenAuth.loginByPassword(u, 'pw123456').then((x) => ({ ok: true, x }), (e) => ({ ok: false, e: String(e && e.message || e) }));
  const s = await window.HansenAuth.ensureSession();
  const n = window.HansenSbProfile.setName(name);
  return { login: r, session: s, prof: window.HansenSbProfile.readProfile(), setName: n };
}, { u, name });

const friendWrites = () => emu.log.filter((x) => x.body && /hansen_friend/.test(x.body.collectionName || '') && /update|delete/.test(x.body.action || ''));
const deniedOrZero = () => friendWrites().filter((x) => x.res && (/"(updated|deleted)":0/.test(x.res.body) || /PERMISSION_DENIED/.test(x.res.body)));

try {
  const A = await open('A');
  const B = await open('B');
  const la = await login(A.page, 'alice_fr', '小爱');
  const lb = await login(B.page, 'bob_fr', '小博');
  ok(la.login.ok && la.session.ok && la.prof.cid > 0, 'A 登录 + 云端发号', la);
  ok(lb.login.ok && lb.session.ok && lb.prof.cid > 0, 'B 登录 + 云端发号', lb);
  const cidA = la.prof.cid, cidB = lb.prof.cid;
  // 登录发号之后再打开"读落后于写"（模拟云端读写不同步），看好友/排行榜扛不扛得住
  if (process.env.EMU_LAG_AFTER) emu.knobs.consistencyLagMs = Number(process.env.EMU_LAG_AFTER);

  // 资料名 getter
  const dn = await E(A.page, () => ({ dn: typeof window.HansenSbProfile.displayName === 'function' ? window.HansenSbProfile.displayName() : '(无 displayName)', st: typeof window.HansenSbProfile.status === 'function' ? window.HansenSbProfile.status() : null }));
  ok(dn.dn === '小爱', 'HansenSbProfile.displayName() 给出真名字', dn);

  // 首次打开排行榜（页面刚加载、db 还没预热）不能说"登录之后才能看到"
  await E(A.page, () => location.reload());
  await A.page.waitForFunction(() => window.HansenAuth && window.HansenLadderBoard, null, { timeout: 20000 });
  const first = await E(A.page, async () => window.HansenLadderBoard.fetchTop());
  ok(first.ok === true, '★ 页面刚加载第一次拉榜就成功（不是 not-signed-in）', first);
  ok(first.ok && Array.isArray(first.list) && first.list.length === 0, '★ 没人上榜时是 ok + 空列表（空 ≠ 出错）', first);

  // 心跳（在线状态）
  const ba = await E(A.page, async () => { await window.HansenFriends._beat(); return window.HansenFriends._myOpenid && window.HansenFriends._myOpenid(); });
  const bb = await E(B.page, async () => { await window.HansenFriends._beat(); return window.HansenFriends._myOpenid && window.HansenFriends._myOpenid(); });
  ok(!!ba && !!bb && ba !== bb, '心跳写上、各自学到自己的 _openid', { ba, bb });

  // A 加 B → pending
  const addAB = await E(A.page, (c) => window.HansenFriends.addFriend(c), cidB);
  ok(addAB.ok && !addAB.mutual, '★ A 加 B：成功，对方还没加 → 待确认', addAB);
  const lB1 = await E(B.page, () => window.HansenFriends.listFriends());
  ok(lB1.ok && (lB1.incoming || []).some((x) => x.cid === cidA), '★ B 看到「A 想加你」', lB1);
  // B 加 A → 双方 accepted
  const addBA = await E(B.page, (c) => window.HansenFriends.addFriend(c), cidA);
  ok(addBA.ok && addBA.mutual === true, '★ B 加回 A：直接互为好友', addBA);
  const lA2 = await E(A.page, () => window.HansenFriends.listFriends());
  const lB2 = await E(B.page, () => window.HansenFriends.listFriends());
  const fa = (lA2.friends || []).find((x) => x.cid === cidB), fb = (lB2.friends || []).find((x) => x.cid === cidA);
  ok(fa && !fa.pending, '★ A 那边：B 是正式好友', lA2);
  ok(fb && !fb.pending, '★ B 那边：A 是正式好友', lB2);
  ok(fa && fa.online === true && fa.name === '小博', 'A 看到 B 刚才还在 + 名字', fa);
  ok(deniedOrZero().length === 0, '★ 没有任何一次写别人的记录（无 updated:0 / 权限拒绝）', deniedOrZero().map((x) => x.body.action + ' ' + JSON.stringify(x.body.query)));

  // 快捷语
  const sent = await E(B.page, (c) => window.HansenFriends.sendQuick(c, 'pk'), cidA);
  ok(sent.ok, '★ B 给 A 发「来一局？」', sent);
  const inb = await E(A.page, () => window.HansenFriends.inbox());
  ok(inb.ok && inb.msgs.some((m) => m.from === cidB && /来一局/.test(m.text) && !m.suspicious), '★ A 收到 B 的招呼（发件人可信）', inb);

  // 界面：好友页
  const ui = await E(A.page, async () => {
    window.HansenFriendsUI.open();
    await new Promise((r) => setTimeout(r, 2500));
    const el = document.getElementById('hsn_friends_screen');
    return { z: el && getComputedStyle(el).zIndex, txt: el ? el.innerText : '' };
  });
  ok(ui.z === '2147483500', '★ 好友页 z-index 2147483500（在拼写大PK屏之上、对战屏之下）', ui.z);
  ok(/小博/.test(ui.txt) && /来一局/.test(ui.txt), '★ 好友页显示好友和收到的招呼', ui.txt.slice(0, 400));

  // 打开好友不许把看门狗架起来（先开天梯再开好友 → 8 秒后不该有救援屏）
  const wd = await E(A.page, async () => {
    window.HansenFriendsUI.close();
    if (window.HansenLadderUI) window.HansenLadderUI.open();
    await new Promise((r) => setTimeout(r, 800));
    window.HansenFriendsUI.open();
    const st0 = window.HansenPkWatchdog && window.HansenPkWatchdog._stateForTest();
    await new Promise((r) => setTimeout(r, 8500));
    return { armed: st0 && st0.armed, rescue: !!document.getElementById('pkRescue') };
  });
  ok(!wd.armed && !wd.rescue, '★ 打开好友页不触发看门狗救援', wd);
  await E(A.page, () => window.HansenFriendsUI.close());

  // 删除：A 删 B → B 那边变回待确认
  const rm = await E(A.page, (c) => window.HansenFriends.removeFriend(c), cidB);
  ok(rm.ok, 'A 删除 B', rm);
  const lB3 = await E(B.page, () => window.HansenFriends.listFriends());
  const fb3 = (lB3.friends || []).find((x) => x.cid === cidA);
  ok(fb3 && fb3.pending === true, '★ B 那边看到 A 不再是互为好友（等他也加你）', lB3);
  const lA3 = await E(A.page, () => window.HansenFriends.listFriends());
  ok(lA3.ok && !(lA3.friends || []).some((x) => x.cid === cidB), '★ A 的列表里没有 B 了', lA3);
  ok(deniedOrZero().length === 0, '★ 删除也只删自己的记录', deniedOrZero().map((x) => x.body.action + ' ' + JSON.stringify(x.body.query)));

  // 集合没建：hansen_friend_msgs
  emu.cols.delete('hansen_friend_msgs');
  const miss = await E(B.page, (c) => window.HansenFriends.sendQuick(c, 'gg'), cidA);
  ok(!miss.ok && miss.kind === 'config' && /hansen_friend_msgs/.test(miss.reason) && /读取全部数据，修改本人数据/.test(miss.reason), '★ 缺 hansen_friend_msgs → 说清楚要建哪个集合、权限选什么', miss);
  const missInbox = await E(A.page, () => window.HansenFriends.inbox());
  ok(!missInbox.ok && missInbox.kind === 'config', '缺集合时收件箱也报配置问题（不是假装没消息）', missInbox);
  emu.setAcl('hansen_friend_msgs', ACL.READONLY);
  emu.cols.delete('hansen_friends');
  const miss2 = await E(A.page, () => window.HansenFriends.listFriends());
  ok(!miss2.ok && miss2.kind === 'config' && /hansen_friends/.test(miss2.reason), '★ 缺 hansen_friends → 列表报配置问题', miss2);
  const missUi = await E(A.page, async () => {
    window.HansenFriendsUI.open();
    await new Promise((r) => setTimeout(r, 2000));
    const t = document.getElementById('hsn_friends_screen').innerText; window.HansenFriendsUI.close(); return t;
  });
  ok(/云端设置还差一步/.test(missUi) && /hansen_friends/.test(missUi), '★ 好友页显示「云端设置还差一步」+ 集合名', missUi.slice(0, 400));
  emu.setAcl('hansen_friends', ACL.READONLY);

  // 排行榜：两人打满定级赛后上传
  const seed = (page) => E(page, async () => {
    const R = window.HansenPkRecord;
    const G = (res) => ({ mode: 'A', result: res, oppName: '对手', myScore: 300, oppScore: 100, words: 5, correct: 4, totalMs: 7000, firstWins: 3, fastestMs: 800, oppRating: 1000 });
    [G('win'), G('win'), G('lose'), G('win')].forEach((g) => R.record(g));
    return window.HansenLadderBoard.push();
  });
  const pa = await seed(A.page), pb = await seed(B.page);
  ok(pa.ok && pb.ok, '★ 两人上传天梯分成功', { pa, pb });
  const top = await E(B.page, async () => { window.HansenLadderBoard._clearCacheForTest(); return window.HansenLadderBoard.fetchTop(); });
  ok(top.ok && top.list.length === 2 && top.list.some((x) => x.name === '小爱') && top.list.some((x) => x.name === '小博'), '★ 榜上有两个人（名字是自己起的）', top);
  ok(top.ok && top.myRank > 0, '榜上找得到自己', top.myRank);
  // 上传出错要报出来
  emu.injectFault((req, body) => body && body.action === 'database.updateDocument' && body.collectionName === 'sb_profile', (req) => ({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied' }) }), 3);
  const perr = await E(A.page, () => window.HansenLadderBoard.push());
  ok(!perr.ok && perr.kind === 'config' && /sb_profile/.test(perr.reason), '★ 上传被拒要报出来（不是 ok:true）', perr);
  emu.faults.length = 0;
  emu.injectFault((req, body) => body && body.action === 'database.queryDocument' && body.collectionName === 'sb_profile', () => ({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied' }) }), 2);
  const terr = await E(A.page, async () => { window.HansenLadderBoard._clearCacheForTest(); return window.HansenLadderBoard.fetchTop(); });
  ok(!terr.ok && terr.kind === 'config', '★ 拉榜被拒 → 报错（不是"没人上榜"）', terr);
  emu.faults.length = 0;
  // 天梯页第一次打开（页面刚加载）榜那一块不能说"登录之后"
  await E(B.page, () => location.reload());
  await B.page.waitForFunction(() => window.HansenLadderUI && window.HansenLadderBoard && window.HansenPkRecord, null, { timeout: 20000 });
  const ldTxt = await E(B.page, async () => {
    window.HansenLadderUI.open();
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const el = document.getElementById('ldBoard');
      const t = el ? el.innerText : '';
      if (t && !/正在|加载|读取/.test(t)) return t;
    }
    const el = document.getElementById('ldBoard'); return el ? el.innerText : '(没有 ldBoard)';
  });
  ok(!/登录之后/.test(ldTxt) && /小爱/.test(ldTxt) && /小博/.test(ldTxt), '★ 刷新后第一次开天梯页：榜直接显示两个人（不是「登录之后才能看到」）', ldTxt.slice(0, 300));
  await E(B.page, () => window.HansenLadderUI.close());

  // 岛屿页：好友页要盖在「拼写大PK」屏上面
  const isl = await E(B.page, async () => {
    location.href = '/island_animal.html';
  });
  await B.page.waitForFunction(() => window.HansenFriendsUI && window.HansenSbPK, null, { timeout: 30000 });
  await B.page.waitForTimeout(1500);
  const onTop = await E(B.page, async () => {
    const pk = window.HansenSbPK;
    try { if (pk && pk.open) pk.open(); } catch (e) {}
    await new Promise((r) => setTimeout(r, 600));
    const pkEl = document.getElementById('hsn_pk_screen');
    window.HansenFriendsUI.open();
    await new Promise((r) => setTimeout(r, 1500));
    const hit = document.elementFromPoint(195, 300);
    const fr = document.getElementById('hsn_friends_screen');
    return { pkOn: !!(pkEl && getComputedStyle(pkEl).display !== 'none'), pkZ: pkEl && getComputedStyle(pkEl).zIndex, onTop: !!(fr && hit && fr.contains(hit)) };
  });
  ok(onTop.onTop && onTop.pkOn, '★ 岛屿页：好友页盖在拼写大PK屏上面（点得到）', onTop);

  // 网络断
  await A.ctx.route(/tcb-api\.tencentcloudapi\.com\/web/, (r) => r.abort());
  const nerr = await E(A.page, async () => { window.HansenLadderBoard._clearCacheForTest(); return window.HansenLadderBoard.fetchTop(); });
  ok(!nerr.ok && nerr.kind === 'network', '★ 断网 → kind network', nerr);
  await A.ctx.unroute(/tcb-api\.tencentcloudapi\.com\/web/);

  console.log('\n  pageerrors:', [...A.consoleLines, ...B.consoleLines].filter((l) => /pageerror/.test(l)).slice(0, 5));
  console.log('  unrouted:', [...new Set([...A.unrouted, ...B.unrouted])].slice(0, 5));
} catch (e) {
  fail++; console.log('  XX  脚本异常 ' + (e && e.stack || e));
} finally {
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(HERE, `e2e_wire_${mode}.json`), JSON.stringify(emu.log.filter((x) => x.body && x.body.action).map((x) => ({ a: x.body.action, c: x.body.collectionName, q: x.body.query, r: x.res && x.res.body && x.res.body.slice(0, 200) })), null, 1));
  console.log(`\n结果(${mode}): ${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
}
