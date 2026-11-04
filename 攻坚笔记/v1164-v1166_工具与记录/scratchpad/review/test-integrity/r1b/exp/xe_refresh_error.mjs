/* XE: emulator assumption "a dead refresh token is answered with error=invalid_grant" flipped.
 * SDK 2.30.0 only deletes credentials on invalid_grant (@151398); any other refresh error keeps them.
 * Kid logs in (token TTL 35 s => SDK refreshes after 5 s), the session dies server-side; the server answers the
 * refresh with ERR (HTTP 401) instead of invalid_grant. What does the ladder say over 70 s? Usage: node xe_refresh_error.mjs <err> */
import * as H from '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/test-integrity/r1b/cur/cloudbase_e2e_harness.mjs';
const ERR = process.argv[2] || 'unauthenticated';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, accessTokenTtlSec: 35 } });
const out = { ERR, timeline: [] };
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' });
  out.login = (await H.loginPhone(A, '13800000951')).ok;
  const loginAt = Date.now();
  emu.revokeSessions(A.cloudUid);
  if (ERR !== 'invalid_grant') {
    await A.ctx.route((u) => /tencentcloudapi\.com$/.test(new URL(u).hostname) && new URL(u).pathname === '/auth/v1/token', (r) =>
      r.fulfill({ status: 401, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ error: ERR, error_code: 16, error_description: 'refresh token expired (emulated ' + ERR + ')' }) }));
  }
  const wait = 62000 - (Date.now() - loginAt); if (wait > 0) await H.sleep(wait);   /* past the 60 s fresh-login window */
  await A.tap('#pkLadder'); await H.answerNameIfAsked(A, '小甲'); await A.waitScreen(/开始排位/, { timeout: 8000 });
  await A.tap('#ldGo');
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < 70000) {
    const s = (await A.screen()).replace(/\s+/g, ' ');
    const authUp = (await A.hitTest('#auPhone', { timeout: 200 })).ok;
    const k = authUp ? '登录面板' : (['云端登录过期', '重新登录', '云端还没连上', '正在连接云端', '连不上网络', '云端设置还差一步', '正在找对手'].find((x) => s.includes(x)) || '?');
    if (!out.timeline.length || out.timeline[out.timeline.length - 1].split(' ')[1] !== k) out.timeline.push(Math.round((Date.now() - t0) / 1000) + 's ' + k);
    last = s;
    if (authUp) break;
    if ((await A.hitTest('#ldGoLogin', { timeout: 200 })).ok) await A.tap('#ldGoLogin').catch(() => {});
    if (/云端还没连上/.test(s) && Date.now() - t0 > 30000) { await A.tap('#ldRetry').catch(() => {}); }
    await H.sleep(700);
  }
  out.final = last.slice(0, 220);
  out.local = await A.eval((env) => ({ signed: window.HansenAuth.isSignedIn(), cred: !!localStorage.getItem('credentials_' + env) }), emu.env);
  out.refreshCalls = emu.log.filter((e) => e.path === '/auth/v1/token').length;
  await A.close();
} catch (e) { out.err = String(e && e.stack || e).slice(0, 400); }
console.log(JSON.stringify(out));
await browser.close(); srv.close(); process.exit(0);
