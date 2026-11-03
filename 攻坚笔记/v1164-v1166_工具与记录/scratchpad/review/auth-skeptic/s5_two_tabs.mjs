/* S5 (AUTH-5): two pages, same browser profile (shared localStorage). After >60 s, the access token has expired in
 * both SDKs; both pages make a cloud call at the same moment. Refresh tokens are single-use.
 * GAP=<ms> staggers the second call. OLD=1 → v1163. */
import * as H from './lib.mjs';
const ROOT = H.ROOTSEL();
const GAP = Number(process.env.GAP || 0);
const srv = await H.serve(ROOT);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 40, accessTokenTtlSec: 100 } });
const out = { ver: process.env.OLD ? 'v1163' : 'v1164', gap: GAP };
const t0 = Date.now();
try {
  const p1 = await H.openPhone(browser, emu, srv.origin, { name: 'tab1' });
  const lg = await H.loginPhone(p1, '13800009941');
  out.login = { ok: lg.ok };
  // second tab in the SAME context = same localStorage (like a second tab / second webview)
  const page2 = await p1.ctx.newPage();
  page2.on('dialog', (d) => d.accept().catch(() => {}));
  await page2.goto(srv.origin + '/spelling_pk.html', { waitUntil: 'domcontentloaded' });
  await page2.waitForFunction(() => !!(window.HansenAuth && window.HansenLadderUI), null, { timeout: 45000 });
  const p2 = new H.Phone('tab2', p1.ctx, page2, emu);
  await H.sleep(2000);
  out.warm = [await p1.eval(async () => (await HansenAuth.ensureSession()).ok), await p2.eval(async () => (await HansenAuth.ensureSession()).ok)];
  while (Date.now() - t0 < 75000) await H.sleep(1000);       // tokens now expired in both SDKs, past the fresh window
  const call = (ph) => ph.eval(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind || '', tries: s.tries || 0 }; });
  const a = call(p1);
  if (GAP) await H.sleep(GAP);
  const b = call(p2);
  out.simultaneous = await Promise.all([a, b]);
  await H.sleep(3500);
  out.after = await p1.eval(() => ({ signed: HansenAuth.isSignedIn(), creds: Object.keys(localStorage).filter((k) => /^credentials/.test(k)).length,
    shadow: (() => { try { return JSON.parse(localStorage.getItem('hansen_cred_shadow') || 'null') ? 'yes' : 'no'; } catch (e) { return '?'; } })() }));
  out.again = [await call(p1), await call(p2)];
  // can tab1's SDK (memory) still read the database without asking ensureSession?
  out.tab1db = await p1.eval(async () => {
    try { const app = await HansenAuth._app(); const r = await app.database().collection('sb_profile').limit(1).get(); return r && r.code ? 'code ' + r.code : 'ok rows=' + ((r && r.data) || []).length; }
    catch (e) { return 'threw ' + String((e && (e.message || e.error)) || e).slice(0, 80); }
  });
  out.tokens = emu.log.filter((e) => e.path === '/auth/v1/token').map((e) => `${e.status}${e.code ? ' ' + e.code : ''}`);
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 700); }
console.log(JSON.stringify(out));
await browser.close(); srv.close(); process.exit(0);
