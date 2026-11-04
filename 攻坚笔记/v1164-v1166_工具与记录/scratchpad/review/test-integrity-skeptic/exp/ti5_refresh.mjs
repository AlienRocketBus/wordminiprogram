/* TI-5: the refresh endpoint rejects with a code other than invalid_grant → SDK keeps credentials → ladder?
   argv[2] = error code returned by /auth/v1/token (e.g. unauthenticated | invalid_grant), argv[3] = http status */
import { H, phone, toLadderHome, flat } from './common.mjs';
const CODE = process.argv[2] || 'unauthenticated', STATUS = Number(process.argv[3] || 401);
const srv = await H.startStatic(); const browser = await H.launchBrowser();
const live = [], names = {};
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, consistencyLagMs: 200, accessTokenTtlSec: 35 } });
const out = { CODE, STATUS, timeline: [] };
const T0 = Date.now(); const s = () => Math.round((Date.now() - T0) / 1000);
try {
  const A = await phone(browser, emu, srv, 'A', '13800000091', '小蜂A', live, names);
  /* the session dies on the server: the access token is invalid and the refresh endpoint refuses with CODE */
  let refreshCalls = 0;
  await A.ctx.route((u) => /\/auth\/v1\/token$/.test(new URL(u).pathname), async (route) => {
    refreshCalls++;
    await route.fulfill({ status: STATUS, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ error: CODE, error_code: 16, error_description: 'refresh token is no longer valid (emulated)' }) });
  });
  emu.revokeSessions(A.cloudUid);
  out.timeline.push(`${s()}s logged in; session revoked; /auth/v1/token → ${STATUS} ${CODE}`);
  await H.sleep(6000);   /* SDK-side expires_at = now + (35-30) s → next use must refresh */
  await toLadderHome(A);
  await A.tap('#ldGo');
  let last = '', retries = 0, sawLogin = false;
  const t1 = Date.now();
  while (Date.now() - t1 < 75000) {
    const sc = flat(await A.screen());
    const short = sc.slice(0, 70);
    if (short !== last) { out.timeline.push(`${s()}s ${short}`); last = short; }
    if (/重新登录|去登录|#auPhone/.test(sc) || (await A.hitTest('#auPhone', { timeout: 200 })).ok || (await A.hitTest('#ldGoLogin', { timeout: 200 })).ok) { sawLogin = true; break; }
    if (/云端还没连上/.test(sc) && retries < 3) { await A.tap('#ldRetry').catch(() => {}); retries++; out.timeline.push(`${s()}s tapped 再试一次 (#${retries})`); }
    await H.sleep(1000);
  }
  const loc = await A.local();
  out.offeredLogin = sawLogin;
  out.retriesTapped = retries;
  out.refreshCalls = refreshCalls;
  out.credentialsPresent = Object.keys(loc).some((k) => k.startsWith('credentials_'));
  out.signedLocal = await A.eval(() => !!(window.HansenAuth && HansenAuth.isSignedIn()));
  out.techLine = flat(await A.screen()).match(/技术信息[:：].{0,90}/)?.[0] || '';
  out.pageErrors = A.errors.length;
} catch (e) { out.err = String(e && e.message || e).slice(0, 400); }
console.log(JSON.stringify(out, null, 1));
for (const p of live) await p.close();
srv.close(); await browser.close();
process.exit(0);
