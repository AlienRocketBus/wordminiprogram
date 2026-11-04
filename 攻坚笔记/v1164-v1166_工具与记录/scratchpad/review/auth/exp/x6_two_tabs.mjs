/* X6: one phone, the game open in TWO pages (two WeChat webviews / two tabs) = shared localStorage,
 * two SDK instances. Both need a token refresh at the same moment (e.g. both woke up).
 * Refresh tokens rotate (single use). What does each page end up with?  OLD=1 -> v1163 snapshot. */
import * as H from './h2.mjs';
const ROOT = process.env.OLD ? H.V1163 : H.REPO;
const srv = await H.startStaticAt(ROOT);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
const out = { root: ROOT.slice(-20) };
const overlay = (pg) => pg.evaluate(() => { const d = document.getElementById('hsnTabStale'); return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 40) : null; });
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'tab1' });
  emu.knobs.accessTokenTtlSec = 35;
  const lg = await H.loginPhone(A, '13800000701');
  emu.knobs.accessTokenTtlSec = 7200;
  out.login = lg.ok;
  const p2 = await A.ctx.newPage();
  await p2.goto(srv.origin + '/spelling_pk.html', { waitUntil: 'domcontentloaded' });
  await p2.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom), null, { timeout: 45000 });
  await H.sleep(800);
  out.tab2first = await p2.evaluate(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind || '' }; });
  await A.eval(() => { const lc = JSON.parse(localStorage.getItem('hansen_auth_v1004')); lc.signedAt = Date.now() - 3600e3; localStorage.setItem('hansen_auth_v1004', JSON.stringify(lc)); });
  await H.sleep(6500);                                    // both SDKs now consider the access token expired
  const [r1, r2] = await Promise.all([
    A.eval(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind || '', reason: String(s.reason || '').slice(0, 60) }; }),
    p2.evaluate(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind || '', reason: String(s.reason || '').slice(0, 60) }; }),
  ]);
  out.simultaneous = { tab1: r1, tab2: r2 };
  await H.sleep(4000);
  out.after = {
    signed: await A.eval(() => HansenAuth.isSignedIn()),
    tab1overlay: await overlay(A.page), tab2overlay: await overlay(p2),
    tab1again: await A.eval(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind || '' }; }),
    tab2again: await p2.evaluate(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind || '' }; }),
    creds: await A.eval((env) => (localStorage.getItem('credentials_' + env) || '').length, H.cloudConfig().env),
  };
  /* can tab1 (whose SDK holds the newest refresh token in memory) still read the cloud? */
  out.tab1db = await A.eval(async () => { try { const a = await HansenAuth._app(); const r = await a.database().collection('sb_profile').limit(1).get(); return r && r.code ? 'code ' + r.code : 'ok rows=' + ((r && r.data) || []).length; } catch (e) { return 'ERR ' + String(e && (e.message || e.error_description || e.error) || e).slice(0, 60); } });
  out.tokenLog = emu.log.filter((e) => /token/.test(e.path)).map((e) => `${e.status}${e.code ? ' ' + e.code : ''}`);
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
