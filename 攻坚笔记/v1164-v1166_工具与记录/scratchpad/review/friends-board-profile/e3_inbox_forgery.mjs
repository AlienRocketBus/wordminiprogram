/* E3: 陌生人 C 冒充 A 的好友 B 给 A 发招呼，并把「发件人名字」写成任意文字。
 *   v1164 声称：收件箱只显示互为好友的人发来的；用 fromOpenid 对 _openid 防冒充。
 *   做法：C 用自己的账号（真 SDK、自己的会话、只写自己的记录）直接往 hansen_friend_msgs 加一条
 *         {from: B.cid, fromName: <任意字>, to: A.cid, qid:'pk'}，**不填 fromOpenid**。
 * 另外：C 再加一条填了 B 真实 _openid 的（应该被标「来源不明」—— 对照组）。
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const MODE = process.env.MODE || 'legacy';
const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenSbProfile);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const j = (x) => JSON.stringify(x);
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: MODE, latencyMs: 30, jitterMs: 30 } });
  for (const u of ['alice', 'bob', 'mallory']) emu.seedUser({ username: u, password: 'pw123456' });
  const mk = async (name, user, nick) => {
    const p = await H.openPhone(browser, emu, srv.origin, { name, ready: READY });
    await p.eval((n) => window.HansenSbProfile.setName(n), nick);
    const r = await H.loginPassword(p, user, 'pw123456');
    p.cid = await p.eval(() => (window.HansenSbProfile.readProfile() || {}).cid || 0);
    await p.eval(() => window.HansenFriends._beat());
    console.log(`[${name}] login=${r.ok} cid=${p.cid} openid=${String(await p.eval(() => window.HansenFriends._myOpenid())).slice(-6)}`);
    return p;
  };
  const A = await mk('A', 'alice', '小爱'), B = await mk('B', 'bob', '小博'), C = await mk('C', 'mallory', '路人');
  /* A、B 互为好友 */
  console.log('A add B', j(await A.eval((c) => window.HansenFriends.addFriend(c), B.cid)));
  console.log('B add A', j(await B.eval((c) => window.HansenFriends.addFriend(c), A.cid)));
  const la = await A.eval(() => window.HansenFriends.listFriends());
  console.log('A friends:', j((la.friends || []).map((f) => ({ cid: f.cid, name: f.name, mutual: f.mutual }))));

  /* C：只用自己的会话写自己的记录（这在「读取全部数据，修改本人数据」下完全合法） */
  const forged = await C.eval(async ([aCid, bCid]) => {
    const app = await window.HansenAuth._app();
    const db = app.database();
    /* B 的真实 _openid 谁都读得到（在线记录是公开可读的） */
    const pres = await db.collection('hansen_friends').where({ kind: 'presence', cid: bCid }).get();
    const bOpenid = pres && pres.data && pres.data[0] && pres.data[0]._openid;
    const r1 = await db.collection('hansen_friend_msgs').add({ from: bCid, fromName: '加QQ12345678找我', to: aCid, qid: 'pk', at: Date.now(), read: false });
    const r2 = await db.collection('hansen_friend_msgs').add({ from: bCid, fromName: '对照组', to: aCid, fromOpenid: bOpenid, qid: 'hi', at: Date.now() - 1000, read: false });
    /* 第三条：at 写成十年后 —— 永远排第一、永远是「新」 */
    const r3 = await db.collection('hansen_friend_msgs').add({ from: bCid, fromName: '置顶的冒充消息', to: aCid, qid: 'win', at: Date.now() + 10 * 365 * 86400000, read: false });
    return { r1: !!(r1 && (r1.id || r1._id)), r2: !!(r2 && (r2.id || r2._id)), r3: !!(r3 && (r3.id || r3._id)), bOpenid: String(bOpenid || '').slice(-6) };
  }, [A.cid, B.cid]);
  console.log('C forged writes:', j(forged), ' foreign-writes recorded by emulator:', H.foreignWrites(emu, 'hansen_friend_msgs').length);

  /* A 的收件箱（界面就是这么调的：onlyFrom = 互为好友的人） */
  const ib = await A.eval((b) => window.HansenFriends.inbox({ onlyFrom: [b] }), B.cid);
  console.log('A inbox (onlyFrom=[B]):', j((ib.msgs || []).map((m) => ({ from: m.from, fromName: m.fromName, text: m.text, suspicious: !!m.suspicious }))));
  /* A 打开好友页看到什么 */
  const ui = await A.eval(async () => {
    window.HansenFriendsUI.open();
    await new Promise((r) => setTimeout(r, 3000));
    const el = document.getElementById('hsn_friends_screen');
    const msgs = [...el.querySelectorAll('.fr_msg')].map((m) => m.innerText.replace(/\s+/g, ' '));
    window.HansenFriendsUI.close();
    return msgs;
  });
  console.log('A friends screen 收到的招呼:', j(ui));
  await A.eval(() => window.HansenFriends.markSeen());
  const ib2 = await A.eval((b) => window.HansenFriends.inbox({ onlyFrom: [b] }), B.cid);
  console.log('A inbox after markSeen (already viewed):', j({ unread: ib2.unread, first: ib2.msgs && ib2.msgs[0] && { fromName: ib2.msgs[0].fromName, isNew: ib2.msgs[0].isNew } }));
  const hit = ui.some((t) => /加QQ12345678找我/.test(t) && new RegExp('No\\.' + B.cid).test(t));
  console.log(hit ? 'RESULT: FORGED message shown to A as coming from B (No.' + B.cid + ') with stranger-chosen sender text' : 'RESULT: forged message NOT shown');
  for (const p of [A, B, C]) await p.close();
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
