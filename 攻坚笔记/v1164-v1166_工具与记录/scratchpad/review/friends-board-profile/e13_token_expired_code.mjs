/* E13: 云端说「access_token 过期」（服务端比手机先判过期：手机时钟慢 / 服务端提前作废）时，
 *      好友页和排行榜给孩子看什么？—— 用 emu.expireAccessTokens(uid)：服务端令牌立刻作废、refresh_token 仍可用。
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenSbProfile && window.HansenLadderBoard);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const j = (x) => JSON.stringify(x);
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 30 } });
  emu.seedUser({ username: 'alice', password: 'pw123456' });
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
  await A.eval(() => window.HansenSbProfile.setName('小爱'));
  const r = await H.loginPassword(A, 'alice', 'pw123456');
  await A.eval(() => window.HansenFriends._beat());
  emu.expireAccessTokens(r.uid);
  const n0 = emu.log.length;
  const lf = await A.eval(() => window.HansenFriends.listFriends());
  const codes = emu.log.slice(n0).map((e) => (e.action || e.path) + '→' + (e.code || e.status)).join(' | ');
  console.log('listFriends after server-side token expiry:', j({ ok: lf.ok, kind: lf.kind, reason: String(lf.reason || '').slice(0, 120) }));
  console.log('requests:', codes.slice(0, 600));
  const tb = await A.eval(async () => { window.HansenLadderBoard._clearCacheForTest(); return window.HansenLadderBoard.fetchTop(); });
  console.log('fetchTop:', j({ ok: tb.ok, kind: tb.kind, reason: String(tb.reason || '').slice(0, 120) }));
  console.log('still signed in locally:', await A.eval(() => window.HansenAuth.isSignedIn()));
  await A.close();
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
