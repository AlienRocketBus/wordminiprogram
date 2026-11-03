/* E11: 显示给孩子的名字全来自别人自己写的记录，显示时不再过一遍 validateName。
 *   C（陌生人，只写自己的记录，权限完全合法）：
 *     ① 在线记录 name='官方客服'（validateName 明令禁止的词）→ 加 A → A 的好友页「🙋 想加你为好友：官方客服」
 *     ② 自己的 sb_profile：name='加微信1234567领皮肤'、ladderRating=9999 → 所有孩子的排行榜第一名
 *   对照：走正常起名 setName('官方客服') 会被拒。
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenSbProfile && window.HansenLadderBoard && window.HansenLadderUI && window.HansenPkRecord);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const j = (x) => JSON.stringify(x);
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 30 } });
  for (const u of ['alice', 'mallory']) emu.seedUser({ username: u, password: 'pw123456' });
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
  await A.eval(() => window.HansenSbProfile.setName('小爱'));
  await H.loginPassword(A, 'alice', 'pw123456');
  const aCid = await A.eval(() => (window.HansenSbProfile.readProfile() || {}).cid || 0);
  await A.eval(() => window.HansenFriends._beat());

  const C = await H.openPhone(browser, emu, srv.origin, { name: 'C', ready: READY });
  console.log('control: setName(官方客服) ->', j(await C.eval(() => window.HansenSbProfile.setName('官方客服'))));
  await C.eval(() => window.HansenSbProfile.setName('路人'));
  await H.loginPassword(C, 'mallory', 'pw123456');
  const cUid = await C.uid();
  const w = await C.eval(async ([aCid, uid]) => {
    const db = (await window.HansenAuth._app()).database();
    const p = await db.collection('hansen_friends').add({ kind: 'presence', cid: 2, name: '官方客服', at: Date.now() });
    const f = await db.collection('hansen_friends').add({ kind: 'friend', owner: 2, friend: aCid, name: 'x', at: Date.now() });
    const s = await db.collection('sb_profile').doc(uid).update({ name: '加微信1234567领皮肤', ladderRating: 9999, ladderGames: 99, ladderAt: Date.now() });
    return { p: !!(p && p.id), f: !!(f && f.id), s: s && s.updated };
  }, [aCid, cUid]);
  console.log('C wrote only its own docs:', j(w), ' foreign writes:', emu.foreign.length);

  const ui = await A.eval(async () => {
    window.HansenFriendsUI.open();
    await new Promise((r) => setTimeout(r, 3000));
    const inc = document.getElementById('frInc');
    const t1 = inc ? inc.innerText.replace(/\s+/g, ' ') : '(no incoming)';
    window.HansenFriendsUI.close();
    window.HansenLadderBoard._clearCacheForTest();
    window.HansenLadderUI.open();
    let t2 = '';
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); const el = document.getElementById('ldBoard'); t2 = el ? el.innerText : ''; if (t2 && !/正在|加载|读取/.test(t2)) break; }
    window.HansenLadderUI.close();
    return { incoming: t1, board: t2.replace(/\s+/g, ' ') };
  });
  console.log('A friends 想加你为好友:', ui.incoming);
  console.log('A ladder board:', ui.board);
  await A.close(); await C.close();
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
