/* X7: a returning kid (already signed in when index.html loads) is playing inside an island (#islandFrame).
 * The cloud session has died (refresh token no longer accepted). The island's own cloud code runs
 * ensureSession (here: the cloud autosync / the 拼写大PK ladder would). What does the kid see on screen?
 * OLD=1 -> v1163 snapshot. */
import * as H from './h2.mjs';
const ROOT = process.env.OLD ? H.V1163 : H.REPO;
const srv = await H.startStaticAt(ROOT);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
const out = { root: ROOT.slice(-20) };
const overlay = (pg) => pg.evaluate(() => { const d = document.getElementById('hsnTabStale'); if (!d) return null; const r = d.getBoundingClientRect(); return { text: d.innerText.replace(/\s+/g, ' ').slice(0, 90), z: getComputedStyle(d).zIndex, full: r.width >= innerWidth - 2 && r.height >= innerHeight - 2 }; });
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'kid', path: '/index.html', ready: () => !!(window.HansenAuth && window.openIsland) });
  emu.knobs.accessTokenTtlSec = 600;                 // SDK refreshes 570 s after login
  const lg = await H.loginPhone(ph, '13800000801');
  emu.knobs.accessTokenTtlSec = 7200;
  out.login = lg.ok;
  /* next day: the kid opens the game again (already signed in) */
  await ph.eval(() => { const lc = JSON.parse(localStorage.getItem('hansen_auth_v1004')); lc.signedAt = Date.now() - 86400e3; localStorage.setItem('hansen_auth_v1004', JSON.stringify(lc)); });
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(() => !!(window.HansenAuth && window.openIsland), null, { timeout: 45000 });
  await H.sleep(800);
  /* the server no longer accepts this login, and the SDK's copy of the access token has run out */
  emu.revokeSessions(lg.uid);
  await ph.eval((env) => { const k = 'credentials_' + env; const c = JSON.parse(localStorage.getItem(k)); c.expires_at = new Date(Date.now() - 1000).toISOString(); localStorage.setItem(k, JSON.stringify(c)); }, H.cloudConfig().env);
  await ph.eval(() => window.openIsland('island_animal.html'));
  const fr = await H.until(async () => ph.page.frames().find((f) => /island_animal\.html/.test(f.url())), { timeout: 20000 });
  await fr.waitForFunction(() => !!(window.HansenAuth && window.HansenCloudSave), null, { timeout: 45000 });
  await H.sleep(1500);
  out.beforeTop = await overlay(ph.page);
  /* the island's autosync runs (any cloud action in the island does the same) */
  out.islandSync = await fr.evaluate(async () => { localStorage.setItem('wordIsland_kidY', JSON.stringify({ learned: [1, 2, 3] })); const r = await HansenCloudSave.syncNow({ force: true }); return { ok: r.ok, err: String(r.error || '').slice(0, 70) }; });
  await H.sleep(2500);
  out.afterTop = await overlay(ph.page);
  out.afterIsland = await overlay(fr);
  out.signed = await ph.eval(() => HansenAuth.isSignedIn());
  out.whatKidSees = (await ph.screen()).replace(/\s+/g, ' ').slice(0, 160);
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
