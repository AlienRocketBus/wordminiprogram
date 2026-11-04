/* E2: 登录那一刻发号没成功（一次网络抖动 / sb_profile 没建）→ 孩子明明已登录，好友页却说「登录后才能加好友」，
 *     而且之后一直不补发（刷新页面也不补），点「去登录」只看到「已登录 / 退出登录」。
 * 真页面 spelling_pk.html + 真 SDK + 模拟云端。
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenSbProfile);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const out = (...a) => console.log(...a);

async function friendsScreen(p) {
  return p.eval(async () => {
    window.HansenFriendsUI.open();
    await new Promise((r) => setTimeout(r, 3500));
    const el = document.getElementById('hsn_friends_screen');
    const t = el ? el.innerText.replace(/\s+/g, ' ') : '';
    const goLogin = !!document.getElementById('frGoLogin');
    let authTxt = '';
    if (goLogin) {
      document.getElementById('frGoLogin').click();
      await new Promise((r) => setTimeout(r, 600));
      const au = document.getElementById('hsn_auth_ui') || document.querySelector('.au_card');
      authTxt = au ? au.innerText.replace(/\s+/g, ' ').slice(0, 120) : '(no auth ui)';
      try { window.HansenAuthUI.close(); } catch (e) {}
    }
    try { window.HansenFriendsUI.close(); } catch (e) {}
    return { signed: window.HansenAuth.isSignedIn(), cid: (window.HansenSbProfile.readProfile() || {}).cid || 0, t: t.slice(0, 200), goLogin, authTxt };
  });
}

try {
  /* 场景 A：登录时数 sb_profile 那一下网络抖了一次（count 请求被掐断一次） */
  {
    const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 40 } });
    emu.seedUser({ username: 'kid_a', password: 'pw123456' });
    const p = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
    await p.eval(() => window.HansenSbProfile.setName('小安'));
    const f = emu.fault({ action: 'database.countDocument', collection: 'sb_profile', do: 'abort', times: 1 });
    const r = await H.loginPassword(p, 'kid_a', 'pw123456');
    out(`[A] login ok=${r && r.ok}, count fault hits=${f.hits}`);
    out('[A] sb_profile docs:', JSON.stringify((emu.dump('sb_profile') || []).map((d) => ({ cid: d.cid, name: d.name }))));
    out('[A] friends screen right after login:', JSON.stringify(await friendsScreen(p)));
    /* 刷新页面，等 10 秒：有没有自动补发 */
    await p.page.reload({ waitUntil: 'domcontentloaded' });
    await p.page.waitForFunction(READY, null, { timeout: 45000 });
    await H.sleep(10000);
    out('[A] sb_profile docs after reload+10s:', JSON.stringify((emu.dump('sb_profile') || []).map((d) => ({ cid: d.cid }))));
    out('[A] friends screen after reload:', JSON.stringify(await friendsScreen(p)));
    const n = emu.log.filter((e) => e.collection === 'sb_profile' && e.t > Date.now() - 15000).length;
    out(`[A] sb_profile requests during the last 15 s (reload + wait): ${n}`);
    await p.close();
  }
  /* 场景 B：sb_profile 集合没建（老师漏建了） */
  {
    const emu = H.makeEmulator({ collections: H.defaultCollections({}), knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    emu.dropCollection('sb_profile');
    emu.seedUser({ username: 'kid_b', password: 'pw123456' });
    const p = await H.openPhone(browser, emu, srv.origin, { name: 'B', ready: READY });
    await p.eval(() => window.HansenSbProfile.setName('小贝'));
    const r = await H.loginPassword(p, 'kid_b', 'pw123456');
    out(`[B] login ok=${r && r.ok}`);
    out('[B] friends screen (sb_profile missing):', JSON.stringify(await friendsScreen(p)));
    await p.close();
  }
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
