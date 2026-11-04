/* E10: 老师新建好友集合时用了控制台的默认权限「仅创建者可读写」（PRIVATE），而不是「读取全部数据，修改本人数据」。
 *   老的「基础权限」下，读别人的记录不报错，只是悄悄看不到 —— 于是没有任何「云端设置还差一步」提示：
 *   ① hansen_friends 是 PRIVATE：加好友永远「没找到 No.X 这个人，看看号码对不对」
 *   ② hansen_friend_msgs 是 PRIVATE：招呼发出去「已发出」，对方永远收不到，也没有任何报错
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenSbProfile);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const j = (x) => JSON.stringify(x);
async function setup(over) {
  const emu = H.makeEmulator({ collections: H.defaultCollections(over), knobs: { permissionMode: 'legacy', latencyMs: 30 } });
  for (const u of ['alice', 'bob']) emu.seedUser({ username: u, password: 'pw123456' });
  const mk = async (name, user, nick) => {
    const p = await H.openPhone(browser, emu, srv.origin, { name, ready: READY });
    await p.eval((n) => window.HansenSbProfile.setName(n), nick);
    await H.loginPassword(p, user, 'pw123456');
    p.cid = await p.eval(() => (window.HansenSbProfile.readProfile() || {}).cid || 0);
    await p.eval(() => window.HansenFriends._beat());
    return p;
  };
  return { emu, A: await mk('A', 'alice', '小爱'), B: await mk('B', 'bob', '小博') };
}
try {
  {
    const { A, B } = await setup({ hansen_friends: H.ACL.PRIVATE });
    const r = await A.eval((c) => window.HansenFriends.addFriend(c), B.cid);
    console.log(`① hansen_friends=PRIVATE: A adds B (No.${B.cid}) ->`, j(r));
    await A.close(); await B.close();
  }
  {
    const { A, B } = await setup({ hansen_friend_msgs: H.ACL.PRIVATE });
    await A.eval((c) => window.HansenFriends.addFriend(c), B.cid);
    await B.eval((c) => window.HansenFriends.addFriend(c), A.cid);
    const s = await B.eval((c) => window.HansenFriends.sendQuick(c, 'pk'), A.cid);
    const ib = await A.eval((c) => window.HansenFriends.inbox({ onlyFrom: [c] }), B.cid);
    console.log('② hansen_friend_msgs=PRIVATE: B sends ->', j(s), ' A inbox ->', j({ ok: ib.ok, kind: ib.kind, n: (ib.msgs || []).length }));
    await A.close(); await B.close();
  }
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
