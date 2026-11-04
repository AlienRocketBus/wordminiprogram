/* E7: 好友页每 15 秒整屏 innerHTML 重画 ——
 *   ① 正在输入的竞赛 ID 输入框被换成一个新节点（字留下了、焦点用脚本塞回去；手机上软键盘会收起）
 *   ② 「加好友」请求还没回来时赶上刷新：按钮又变回可点的「加好友」，孩子再点一次 → 发出第二个请求
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenSbProfile);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const j = (x) => JSON.stringify(x);
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

  /* ① */
  await A.eval(() => window.HansenFriendsUI.open());
  await H.sleep(2500);
  await A.tap('#frCid');
  await A.type(String(B.cid));
  await A.eval(() => { window.__in0 = document.getElementById('frCid'); window.__blur = 0; window.__in0.addEventListener('blur', () => { window.__blur++; }); });
  await H.sleep(16000);   /* 等一次 15 秒刷新 */
  const r1 = await A.eval(() => {
    const now = document.getElementById('frCid');
    return { sameNode: now === window.__in0, value: now && now.value, focused: document.activeElement === now, blurEventsOnOldInput: window.__blur };
  });
  console.log('① after one 15 s refresh while typing:', j(r1));

  /* ② 加好友的写请求卡住（弱信号），期间赶上一次刷新 */
  const hold = emu.hold({ action: 'database.addDocument', collection: 'hansen_friends' });
  const reqsBefore = emu.log.filter((e) => e.action === 'database.addDocument' && e.collection === 'hansen_friends').length;
  await A.tap('#frAdd');
  await H.sleep(800);
  const s1 = await A.eval(() => { const b = document.getElementById('frAdd'); return { text: b && b.textContent, disabled: !!(b && b.disabled) }; });
  await H.sleep(15500);
  const s2 = await A.eval(() => { const b = document.getElementById('frAdd'); return { text: b && b.textContent, disabled: !!(b && b.disabled) }; });
  console.log('② button while add in flight: before refresh', j(s1), ' after refresh', j(s2));
  if (!s2.disabled) { await A.tap('#frAdd'); await H.sleep(1500); }
  const reqsAfter = emu.log.filter((e) => e.action === 'database.addDocument' && e.collection === 'hansen_friends').length;
  console.log(`② add requests sent while the first was still pending: ${reqsAfter - reqsBefore} (pending in hold: ${hold.pending})`);
  hold.release();
  await H.sleep(2500);
  const rows = (emu.dump('hansen_friends') || []).filter((d) => d.kind === 'friend');
  console.log('② friend rows A→B in DB after release:', rows.filter((r) => r.friend === B.cid).length);
  await A.close(); await B.close();
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
