/* E5 (AUTH-5): the game open in two pages of ONE browser profile (shared localStorage, two SDK instances).
 * Real waits (no faked signedAt): access token issued with a 95 s life (SDK expiry = +65 s), both pages ask
 * for the session at the same moment at +67 s.  Presence heartbeats are kept quiet (no competition ID) so the
 * only refreshes are the two simultaneous ones.  OLD=1 -> v1163 snapshot. */
import * as L from './lib.mjs';
const { H } = L;
const srv = await L.serve(L.ROOTSEL);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
emu.setCollection('sb_profile', H.ACL.ADMINONLY);   // no cid -> friends heartbeat stays quiet
const o = { ver: L.VER };
const sess = (pg) => pg.evaluate(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind || '', reason: String(s.reason || '').slice(0, 50) }; });
const overlay = (pg) => pg.evaluate(() => { const d = document.getElementById('hsnTabStale'); return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 30) : null; });
const db = (pg) => pg.evaluate(async () => { try { const a = await HansenAuth._app(); const r = await a.database().collection('hansen_saves').limit(1).get(); return r && r.code ? 'code ' + r.code : 'ok'; } catch (e) { return 'ERR ' + String(e && (e.message || e.error_description || e.error) || e).slice(0, 50); } });
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'p1', ready: L.PK_READY });
  emu.knobs.accessTokenTtlSec = 95;
  const tLogin = Date.now();
  const lg = await H.loginPhone(A, '13800000741');
  emu.knobs.accessTokenTtlSec = 7200;
  o.login = lg.ok;
  const p2 = await A.ctx.newPage();
  await p2.goto(srv.origin + '/spelling_pk.html', { waitUntil: 'domcontentloaded' });
  await p2.waitForFunction(L.PK_READY, null, { timeout: 45000 });
  await H.sleep(800);
  o.p2first = await sess(p2);
  const wait = 67000 - (Date.now() - tLogin);
  if (wait > 0) await H.sleep(wait);
  o.tokensBefore = emu.log.filter((e) => /\/v1\/token/.test(e.path)).length;
  const [r1, r2] = await Promise.all([sess(A.page), sess(p2)]);
  o.simultaneous = { p1: r1, p2: r2 };
  await H.sleep(4000);
  o.after = { signed: await A.eval(() => HansenAuth.isSignedIn()), p1overlay: await overlay(A.page), p2overlay: await overlay(p2),
    p1again: await sess(A.page), p2again: await sess(p2), p1db: await db(A.page), p2db: await db(p2),
    credsLen: await A.eval((env) => (localStorage.getItem('credentials_' + env) || '').length, H.cloudConfig().env) };
  o.tokens = emu.log.filter((e) => /\/v1\/token/.test(e.path)).map((e) => `${e.status}${e.code ? ' ' + e.code : ''}`);
} catch (e) { o.thrown = String(e && e.stack || e).slice(0, 900); }
L.out(o);
await browser.close(); srv.close(); process.exit(0);
