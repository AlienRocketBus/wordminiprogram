/* E6: 「已读」用本机时间记（markSeen = 本机 Date.now()），而消息的 at 是发件人手机的时间。
 *     两部手机时钟差几分钟（孩子的平板/旧手机常见）：
 *       ① 发件人慢 5 分钟 → 新消息永远不算「新」，未读数 0
 *       ② 发件人快 10 分钟 → 看过了还一直是「新」
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenSbProfile);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const j = (x) => JSON.stringify(x);
const skew = (p, ms) => p.eval((off) => { const n0 = Date.now.bind(Date); Date.now = () => n0() + off; return true; }, ms);
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 30 } });
  for (const u of ['alice', 'bob']) emu.seedUser({ username: u, password: 'pw123456' });
  const mk = async (name, user, nick) => {
    const p = await H.openPhone(browser, emu, srv.origin, { name, ready: READY });
    await p.eval((n) => window.HansenSbProfile.setName(n), nick);
    await H.loginPassword(p, user, 'pw123456');
    p.cid = await p.eval(() => (window.HansenSbProfile.readProfile() || {}).cid || 0);
    await p.eval(() => window.HansenFriends._beat());
    return p;
  };
  const A = await mk('A', 'alice', '小爱'), B = await mk('B', 'bob', '小博');
  await A.eval((c) => window.HansenFriends.addFriend(c), B.cid);
  await B.eval((c) => window.HansenFriends.addFriend(c), A.cid);

  /* ① B 的手机慢 5 分钟 */
  await skew(B, -5 * 60000);
  await A.eval(() => window.HansenFriends.markSeen());        /* A 刚看过收件箱 */
  await H.sleep(1500);
  console.log('B send (clock -5min):', j(await B.eval((c) => window.HansenFriends.sendQuick(c, 'pk'), A.cid)));
  const ib1 = await A.eval((b) => window.HansenFriends.inbox({ onlyFrom: [b] }), B.cid);
  console.log('① A inbox right after B sent:', j({ unread: ib1.unread, msgs: (ib1.msgs || []).map((m) => ({ text: m.text, isNew: m.isNew })) }));
  const ui1 = await A.eval(async () => { window.HansenFriendsUI.open(); await new Promise((r) => setTimeout(r, 3000)); const t = [...document.querySelectorAll('#hsn_friends_screen .fr_msg, #hsn_friends_screen .fr_lbl')].map((e) => e.innerText.replace(/\s+/g, ' ')).join(' | '); window.HansenFriendsUI.close(); return t; });
  console.log('① A friends screen:', ui1);

  /* ② B 的手机快 10 分钟（在 -5 分钟基础上 +15 分钟） */
  await skew(B, 15 * 60000);
  console.log('B send (clock +10min):', j(await B.eval((c) => window.HansenFriends.sendQuick(c, 'gg'), A.cid)));
  /* A 打开好友页看到它（界面 1.5 秒后自动 markSeen），关掉，再打开 */
  await A.eval(async () => { window.HansenFriendsUI.open(); await new Promise((r) => setTimeout(r, 4000)); window.HansenFriendsUI.close(); });
  const ib2 = await A.eval((b) => window.HansenFriends.inbox({ onlyFrom: [b] }), B.cid);
  console.log('② A inbox after having viewed it:', j({ unread: ib2.unread, msgs: (ib2.msgs || []).map((m) => ({ text: m.text, isNew: m.isNew })) }));
  await A.close(); await B.close();
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
