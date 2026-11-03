/* E7 (AUTH-7): a kid who used the old 「用户名注册」 (v1058-v1163): local marker {method:'password', username, signedAt}
 * but no cloud account and no credentials; 6 learned words on the device.  Opens the new version.
 * What happens without any tap, then on 天梯, then on username login?  OLD=1 -> v1163 snapshot. */
import * as L from './lib.mjs';
const { H } = L;
const srv = await L.serve(L.ROOTSEL);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
const o = { ver: L.VER };
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'legacy', ready: L.PK_READY });
  /* what v1163's registerByPassword left behind (marker + progress), as if the kid registered 2 weeks ago */
  await ph.eval(() => {
    localStorage.setItem('hansen_auth_v1004', JSON.stringify({ method: 'password', username: 'xiaoming88', signedAt: Date.now() - 14 * 86400e3 }));
    localStorage.setItem('wordIsland_kidX', JSON.stringify({ learned: [1, 2, 3, 4, 5, 6] }));
  });
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(L.PK_READY, null, { timeout: 45000 });
  o.signedAtLoad = await ph.eval(() => HansenAuth.isSignedIn());
  await H.sleep(12000);                    // no tap at all
  o.signedAfter12s = await ph.eval(() => HansenAuth.isSignedIn());
  o.marker = await ph.eval(() => HansenAuth.readLocal());
  o.toasts = (await ph.allText()).replace(/\s+/g, ' ').match(/(过期|重新登录|登录)[^。]{0,30}/g);
  o.dialogs = ph.dialogs.map((d) => d.message.slice(0, 120));
  /* kid taps 天梯 */
  await ph.tap('#pkLadder');
  await H.answerNameIfAsked(ph, '小明');
  await ph.tap('#ldGo', { timeout: 4000 }).catch(() => {});
  await H.sleep(5000);
  o.ladder = (await ph.screen()).replace(/\s+/g, ' ').slice(0, 200);
  /* kid tries the username + password they "registered" */
  await ph.eval(() => { try { HansenLadderUI.close(); } catch (e) {} try { HansenAuthUI.close(); } catch (e) {} HansenAuthUI.open({ mode: 'password' }); });
  await H.sleep(400);
  const signedNow = await ph.eval(() => HansenAuth.isSignedIn());
  o.panelWhenOpened = await ph.eval(() => { const c = document.querySelector('#hsn_auth_panel .au_card'); return c ? c.innerText.replace(/\s+/g, ' ').slice(0, 120) : null; });
  if (!signedNow) {
    if (!(await ph.hitTest('#auUser', { timeout: 1500 })).ok) await ph.tap('.au_tab[data-m="password"]');
    await ph.tap('#auUser'); await ph.type('xiaoming88');
    await ph.tap('#auPwd'); await ph.type('abc12345');
    await ph.tap('#auGo');
    o.usernameLogin = await H.authPanelMsg(ph);
  }
  o.learnedStill = await ph.eval(() => (JSON.parse(localStorage.getItem('wordIsland_kidX') || '{}').learned || []).length);
} catch (e) { o.thrown = String(e && e.stack || e).slice(0, 900); }
L.out(o);
await browser.close(); srv.close(); process.exit(0);
