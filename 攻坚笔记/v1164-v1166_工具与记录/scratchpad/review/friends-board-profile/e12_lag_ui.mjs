/* E12: 读延迟 300–1500ms 时好友页的「刚操作完」状态：
 *   B 在「想加你为好友」里点「加他」→ 成功提示出来了，但列表立刻刷新时还读不到自己刚写的那条：
 *   请求卡片还在（还能再点「加他」），好友列表里也还没有 A —— 要等下一次 15 秒刷新。
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const LAG = Number(process.env.LAG || 1000);
const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenSbProfile);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const j = (x) => JSON.stringify(x);
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 60, jitterMs: 60 } });
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
  await H.sleep(300);
  await B.eval(() => window.HansenFriendsUI.open());
  await B.waitScreen(/想加你为好友/, { timeout: 15000 });
  emu.knobs.consistencyLagMs = LAG;   /* 从这一刻起，读比写慢 LAG 毫秒 */
  await B.tap('#frInc [data-acc="0"]');
  await H.sleep(2500);   /* 成功提示 + 立刻刷新都完成了 */
  const s = await B.eval(() => {
    const el = document.getElementById('hsn_friends_screen');
    return { tip: (document.getElementById('frCidTip') || {}).innerText || '', stillRequest: !!document.querySelector('#frInc [data-acc]'),
             list: ((document.getElementById('frList') || {}).innerText || '').replace(/\s+/g, ' ') };
  });
  console.log(`LAG=${LAG}: 2.5 s after tapping 加他 ->`, j(s));
  if (s.stillRequest) {
    await B.tap('#frInc [data-acc="0"]');
    await H.sleep(2500);
  }
  const rows = (emu.dump('hansen_friends') || []).filter((d) => d.kind === 'friend' && d.owner === B.cid && d.friend === A.cid).length;
  console.log(`B→A friend rows in DB after a second tap: ${rows}`);
  await A.close(); await B.close();
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
