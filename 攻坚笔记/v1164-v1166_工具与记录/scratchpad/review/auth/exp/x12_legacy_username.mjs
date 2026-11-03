/* X12: a kid who used 「用户名注册」 in v1058..v1163 (never created a cloud account: the SDK only sent an
 * email code) has the local marker {method:'password', username, signedAt} and local progress.
 * After upgrading to v1164: what do they see when they tap 天梯, and when they try their username again? */
import * as H from './h2.mjs';
const srv = await H.startStaticAt(H.REPO);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 25 } });
const out = {};
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'legacy' });
  await ph.eval(() => {
    localStorage.setItem('hansen_auth_v1004', JSON.stringify({ method: 'password', username: 'xiaoming88', signedAt: Date.now() - 20 * 86400e3 }));
    localStorage.setItem('wordIsland_kidL', JSON.stringify({ learned: [1, 2, 3, 4, 5, 6] }));
  });
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(() => !!(window.HansenAuth && window.HansenLadderUI), null, { timeout: 45000 });
  await H.sleep(800);
  out.signedAtStart = await ph.eval(() => HansenAuth.isSignedIn());
  await ph.tap('#pkLadder'); await H.answerNameIfAsked(ph, '小明');
  await ph.tap('#ldGo').catch((e) => { out.goErr = e.message.slice(0, 80); });
  const t0 = Date.now(); let txt = '';
  while (Date.now() - t0 < 30000) { txt = await ph.screen(); if (/过期|先登录|云端还没连上|连不上网络/.test(txt)) break; await H.sleep(400); }
  out.ladderSays = txt.replace(/\s+/g, ' ').slice(0, 200);
  /* the kid does what the screen says: 重新登录 -> 用户名登录 with the username + password they "registered" */
  await ph.tap('#ldGoLogin').catch((e) => { out.loginBtnErr = e.message.slice(0, 80); });
  await ph.tap('.au_tab[data-m="password"]');
  await ph.tap('#auUser'); await ph.type('xiaoming88');
  await ph.tap('#auPwd'); await ph.type('abc12345');
  await ph.tap('#auGo');
  out.loginSays = await H.authPanelMsg(ph);
  out.tip = await ph.eval(() => ((document.querySelector('#hsn_auth_panel .au_tip') || {}).innerText || '').replace(/\s+/g, ' '));
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
