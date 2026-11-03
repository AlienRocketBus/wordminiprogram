/* E9: 两个孩子拿到同一个竞赛 ID（E1 里同时注册 + 读延迟时实测会发生）之后，好友功能会怎样。
 *   X、Y 都是 No.1（服务端资料里就是这样），Z 是 No.2。Z 想加的是 X。
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenSbProfile);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const j = (x) => JSON.stringify(x);
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 30 } });
  const ux = emu.seedUser({ username: 'xiao_x', password: 'pw123456' });
  const uy = emu.seedUser({ username: 'xiao_y', password: 'pw123456' });
  emu.seedUser({ username: 'xiao_z', password: 'pw123456' });
  /* 两人的云端资料都是 cid=1（E1 实测会出现的状态） */
  emu.seedDoc('sb_profile', { _id: ux.uid, uid: ux.uid, name: '小X', cid: 1, createdAt: { $date: Date.now() - 5000 } }, ux.uid, 5000);
  emu.seedDoc('sb_profile', { _id: uy.uid, uid: uy.uid, name: '小Y', cid: 1, createdAt: { $date: Date.now() - 4990 } }, uy.uid, 4990);
  const mk = async (name, user, nick) => {
    const p = await H.openPhone(browser, emu, srv.origin, { name, ready: READY });
    await p.eval((n) => window.HansenSbProfile.setName(n), nick);
    await H.loginPassword(p, user, 'pw123456');
    p.cid = await p.eval(() => (window.HansenSbProfile.readProfile() || {}).cid || 0);
    await p.eval(() => window.HansenFriends._beat());
    console.log(`[${name}] cid=${p.cid}`);
    return p;
  };
  const X = await mk('X', 'xiao_x', '小X'), Y = await mk('Y', 'xiao_y', '小Y'), Z = await mk('Z', 'xiao_z', '小Z');
  console.log('Z adds No.1 (meaning 小X):', j(await Z.eval(() => window.HansenFriends.addFriend(1))));
  const ly = await Y.eval(() => window.HansenFriends.listFriends());
  console.log('Y (not the intended kid) sees incoming:', j((ly.incoming || []).map((f) => f.name + ' No.' + f.cid + ' ' + f.sub)));
  console.log('Y taps 加他:', j(await Y.eval(() => window.HansenFriends.addFriend(3))));
  const lz = await Z.eval(() => window.HansenFriends.listFriends());
  console.log('Z friend list:', j((lz.friends || []).map((f) => ({ cid: f.cid, name: f.name, mutual: f.mutual }))));
  console.log('Z sends 来一局？ to No.1:', j((await Z.eval(() => window.HansenFriends.sendQuick(1, 'pk'))).ok));
  const iy = await Y.eval(() => window.HansenFriends.inbox({ onlyFrom: [3] }));
  const ix = await X.eval(() => window.HansenFriends.inbox({ onlyFrom: [] }));
  console.log('Y inbox:', j((iy.msgs || []).map((m) => m.fromName + ':' + m.text)), ' X inbox total (incl. hidden):', ix.total, 'strangers:', ix.strangers);
  for (const p of [X, Y, Z]) await p.close();
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
