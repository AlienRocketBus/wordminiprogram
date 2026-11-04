/* E14: 不用任何开发者工具：陌生人在正常的起名框里起名「加QQ12345678」（validateName 放行），
 *      在好友页随手输一个竞赛 ID（号码从 1 开始连续发，谁都猜得到）点「加好友」——
 *      那个孩子的好友页就出现「🙋 想加你为好友：加QQ12345678」。全程只用界面。
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenSbProfile);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 30 } });
  for (const u of ['kid', 'stranger']) emu.seedUser({ username: u, password: 'pw123456' });
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
  await A.eval(() => window.HansenSbProfile.setName('小爱'));
  await H.loginPassword(A, 'kid', 'pw123456');
  await A.eval(() => window.HansenFriends._beat());
  const aCid = await A.eval(() => window.HansenSbProfile.readProfile().cid);

  const C = await H.openPhone(browser, emu, srv.origin, { name: 'C', ready: READY });
  /* 正常起名：走拼写大PK页的起名屏 */
  console.log('C setName via validateName:', JSON.stringify(await C.eval(() => window.HansenSbProfile.setName('加QQ12345678'))));
  await H.loginPassword(C, 'stranger', 'pw123456');
  await C.eval(() => window.HansenFriends._beat());
  /* 正常界面：点「好友」按钮 → 输号码 → 点「加好友」 */
  await C.tap('#pkFriends');
  await C.tap('#frCid');
  await C.type(String(aCid));
  await C.tap('#frAdd');
  const tip = await C.waitScreen(/已发出好友请求|互为好友|没找到/, { timeout: 15000 });
  console.log('C screen after 加好友:', (tip.match(/✅[^\n]*/) || [''])[0]);
  /* 孩子 A 打开好友页 */
  await A.tap('#pkFriends');
  const seen = await A.waitScreen(/想加你为好友/, { timeout: 20000 });
  console.log('A sees:', ((seen.match(/🙋[^\n]*\n[^\n]*\n[^\n]*/) || [''])[0]).replace(/\n/g, ' | '));
  console.log('foreign writes:', emu.foreign.length);
  await A.close(); await C.close();
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
