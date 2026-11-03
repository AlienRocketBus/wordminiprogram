/* X10: phone wakes after hours (access token expired in the SDK's eyes, refresh token still valid).
 *  a) network still down at wake -> ensureSession result? marker kept?  then network back -> ok?
 *  b) refresh request hangs (weak signal) -> result after how long? marker kept? then released -> ok?
 *  c) very slow 4G (every request 4.5 s) + user_info cache missing -> result?  */
import * as H from './h2.mjs';
const ENV = H.cloudConfig().env;
const srv = await H.startStaticAt(H.REPO);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 20 } });
const out = {};
const expireLocal = (ph) => ph.eval((env) => { const k = 'credentials_' + env; const c = JSON.parse(localStorage.getItem(k)); c.expires_at = new Date(Date.now() - 1000).toISOString(); localStorage.setItem(k, JSON.stringify(c)); const lc = JSON.parse(localStorage.getItem('hansen_auth_v1004')); lc.signedAt = Date.now() - 6 * 3600e3; localStorage.setItem('hansen_auth_v1004', JSON.stringify(lc)); }, ENV);
const ses = (ph) => ph.eval(async () => { const t = Date.now(); const s = await HansenAuth.ensureSession(); return { ms: Date.now() - t, ok: s.ok, kind: s.kind || '', reason: String(s.reason || '').slice(0, 50), signed: HansenAuth.isSignedIn() }; });
async function freshPhone(name, num, before) {
  const ph = await H.openPhone(browser, emu, srv.origin, { name });
  await H.loginPhone(ph, num);
  await expireLocal(ph);
  const ctl = before ? before() : null;                               // network trouble starts BEFORE the page wakes
  await ph.page.reload({ waitUntil: 'domcontentloaded' });             // new page = SDK reads the (expired) creds from storage
  await ph.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom), null, { timeout: 45000 });
  await H.sleep(300);
  ph.ctl = ctl;
  return ph;
}
try {
  /* a) offline at wake */
  const a = await freshPhone('a', '13800001101', () => emu.setOffline(true));
  out.a_offline = await ses(a);
  out.a_offline2 = await ses(a);
  emu.setOffline(false);
  out.a_online = await ses(a);
  /* b) refresh hangs */
  const b = await freshPhone('b', '13800001102', () => emu.hold({ path: '/auth/v1/token' }));
  const hold = b.ctl;
  out.b_hung = await ses(b);
  out.b_hung2 = await ses(b);
  out.b_pendingRefreshes = hold.pending;
  hold.release();
  await H.sleep(800);
  out.b_released = await ses(b);
  /* c) slow 4G + no user_info cache */
  const c0 = await H.openPhone(browser, emu, srv.origin, { name: 'c' });
  await H.loginPhone(c0, '13800001103');
  await expireLocal(c0);
  await c0.eval((env) => localStorage.removeItem('user_info_' + env), ENV);
  emu.knobs.latencyMs = 4500;
  await c0.page.reload({ waitUntil: 'domcontentloaded' });
  await c0.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom), null, { timeout: 45000 });
  const c = c0;
  out.c_slow = await ses(c);
  out.c_slow2 = await ses(c);
  emu.knobs.latencyMs = 20;
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
