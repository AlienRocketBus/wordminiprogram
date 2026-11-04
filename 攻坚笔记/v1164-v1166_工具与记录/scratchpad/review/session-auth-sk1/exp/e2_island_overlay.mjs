/* E2 (AUTH-2): index.html + #islandFrame.
 * CASE=expiry : returning kid (signed in when index.html loads, login > 60 s ago, real wait),
 *               server revoked the session, access token runs out; kid enters an island and does NOTHING.
 * CASE=login  : signed-out kid enters an island -> 拼写大PK -> 🔐 注册 / 登录 -> phone + code, by real taps in the frame.
 * Records the top window's #hsnTabStale overlay.  OLD=1 -> v1163 snapshot. */
import * as L from './lib.mjs';
const { H } = L;
const CASE = process.env.CASE || 'expiry';
const srv = await L.serve(L.ROOTSEL);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
const o = { ver: L.VER, case: CASE };
const overlay = (fr) => fr.evaluate(() => { const d = document.getElementById('hsnTabStale'); if (!d) return null; const r = d.getBoundingClientRect(); return { text: d.innerText.replace(/\s+/g, ' ').slice(0, 100), z: getComputedStyle(d).zIndex, full: r.width >= innerWidth - 2 && r.height >= innerHeight - 2 }; }).catch((e) => 'ERR ' + e.message);
const T0 = Date.now(); const bc = (m) => console.error('[' + (Date.now() - T0) + 'ms] ' + m);
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'kid', path: '/index.html', ready: L.INDEX_READY });
  if (CASE === 'expiry') {
    emu.knobs.accessTokenTtlSec = 100;                 // SDK refresh needed 70 s after login
    const lg = await H.loginPhone(ph, '13800000711');
    emu.knobs.accessTokenTtlSec = 7200;
    o.login = { ok: lg.ok, uid: lg.uid };
    await H.sleep(72000);                              // > 60 s fresh window and > 70 s token life, for real
    await ph.page.reload({ waitUntil: 'domcontentloaded' });   // kid opens the game again (already signed in)
    await ph.page.waitForFunction(L.INDEX_READY, null, { timeout: 45000 });
    await H.sleep(800);
    emu.revokeSessions(lg.uid);                        // server: this login is no longer valid
    o.signedAtOpen = await ph.eval(() => HansenAuth.isSignedIn());
    o.topOverlayBefore = await overlay(ph.page);
  }
  /* the kid taps 跳过 on the home onboarding first */
  for (let i = 0; i < 3; i++) { const sk = ph.page.locator('[aria-label="跳过新手引导"]').first(); if (await sk.isVisible().catch(() => false)) { await sk.tap({ timeout: 5000 }).catch(() => {}); await H.sleep(500); } else break; }
  bc('openIsland'); await ph.eval(() => window.openIsland('island_animal.html'));
  const fr = await H.until(async () => ph.page.frames().find((f) => /island_animal\.html/.test(f.url())), { timeout: 20000 });
  await fr.waitForFunction(() => !!(window.HansenAuth && window.HansenCloudSave && window.HansenSbPK), null, { timeout: 45000 });
  const tIn = Date.now(); bc('island ready');
  if (CASE === 'login') {
    await H.sleep(1500);
    /* dismiss the island welcome if present (taps), then 拼写大PK -> 注册/登录 */
    bc('welcome'); for (let i = 0; i < 4; i++) { const c = await fr.evaluate(() => { const b = document.querySelector('#alertModal.show button'); if (b && b.offsetParent) { b.click(); return 1; } return 0; }).catch(() => 0); if (!c) break; await H.sleep(400); }
    bc('openSpellPK'); await fr.evaluate(() => window.openSpellPK());
    await H.sleep(700);
    bc('tap kReg'); await fr.locator('#kReg').tap({ timeout: 10000 });
    bc('tap auPhone'); await fr.locator('#auPhone').tap({ timeout: 10000 }); await ph.page.keyboard.type('13800000712', { delay: 10 });
    bc('tap auSend'); await fr.locator('#auSend').tap({ timeout: 10000 });
    await H.until(async () => /验证码已发送/.test(await fr.evaluate(() => (document.getElementById('auMsg') || {}).innerText || '')), { timeout: 15000 });
    bc('tap auCode'); await fr.locator('#auCode').tap({ timeout: 10000 }); await ph.page.keyboard.type('123456', { delay: 10 });
    bc('tap auGo'); await fr.locator('#auGo').tap({ timeout: 10000 });
    o.panel = await H.until(async () => { const v = await fr.evaluate(() => (document.getElementById('auMsg') || {}).innerText || '').catch(() => ''); return v && !/处理中/.test(v) ? v.trim() : null; }, { timeout: 20000 });
  }
  bc('poll overlay'); let ov = null; const tw = Date.now();
  while (Date.now() - tw < 25000) { ov = await overlay(ph.page); if (ov && typeof ov === 'object') break; await H.sleep(300); }
  o.overlayAfterEnterMs = ov && typeof ov === 'object' ? Date.now() - tIn : null;
  await H.sleep(1500);
  o.topOverlay = await overlay(ph.page);
  o.signedNow = await ph.eval(() => HansenAuth.isSignedIn());
  o.kidSees = (await ph.screen()).replace(/\s+/g, ' ').slice(0, 170);
  /* what does the island itself say under the overlay? */
  o.islandSays = (await fr.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ').match(/(登录[^。，]{0,20}过期[^。]{0,30}|别的窗口[^。]{0,20})/g);
  o.dialogs = ph.dialogs.map((d) => d.message.slice(0, 120));
  o.errors = ph.errors.slice(0, 3);
  o.elapsed = Date.now() - T0;
} catch (e) { o.thrown = String(e && e.stack || e).slice(0, 900); }
L.out(o);
await browser.close(); srv.close(); process.exit(0);
