// Pitfall experiments: CORS headers, negative control for ACL, region header, transport failures.
import { createEmulator, ACL } from './emulator.mjs';
import { startStatic, launch, newCtx, E, ENV } from './harness.mjs';

const out = {};
const srv = await startStatic();
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;
const browser = await launch();
const login = async (page, u, p) => E(page, async ({ u, p }) => { await window.__auth.signIn({ username: u, password: p }); const st = await window.__auth.getLoginState(); return st && st.user && st.user.uid; }, { u, p });

try {
  // 1) negative control: same claim by non-creator succeeds when ACL allows everyone to write
  {
    const emu = createEmulator({ collections: { hansen_pk_rooms: ACL.PUBLIC_TEST_ONLY } });
    emu.seedUser({ username: 'a1', password: 'pw123456' }); emu.seedUser({ username: 'b1', password: 'pw123456' });
    const A = await newCtx(browser, emu, ORIGIN, { tag: 'A' }); const B = await newCtx(browser, emu, ORIGIN, { tag: 'B' });
    await login(A.page, 'a1', 'pw123456'); const bu = await login(B.page, 'b1', 'pw123456');
    const id = (await E(A.page, async () => (await window.__app.database().collection('hansen_pk_rooms').add({ status: 'open', guestId: '' })).id));
    out.negativeControl = await E(B.page, async ({ id, bu }) => window.__app.database().collection('hansen_pk_rooms').where({ _id: id, status: 'open', guestId: '' }).update({ guestId: bu }), { id, bu });
    await A.ctx.close(); await B.ctx.close();
  }
  // 2) CORS: responses WITHOUT Access-Control-Allow-Origin
  {
    const emu = createEmulator({ collections: { hansen_pk_rooms: ACL.READONLY }, knobs: { noCors: true } });
    emu.seedUser({ username: 'a1', password: 'pw123456' });
    const A = await newCtx(browser, emu, ORIGIN, { tag: 'A-nocors' });
    out.noCorsSignIn = await E(A.page, async () => window.__auth.signIn({ username: 'a1', password: 'pw123456' }).then(() => 'resolved', (e) => ({ rejected: e && (e.error || e.message), desc: e && e.error_description })));
    emu.knobs.noCors = false;
    await E(A.page, async () => window.__auth.signIn({ username: 'a1', password: 'pw123456' }));
    emu.knobs.noCors = true;
    out.noCorsDb = await E(A.page, async () => window.__app.database().collection('hansen_pk_rooms').where({ a: 1 }).get().then((r) => ({ resolved: r }), (e) => ({ rejected: String(e && e.message || e) })));
    out.noCorsSignInRequestsSeen = emu.log.filter((x) => x.path === '/auth/v1/signin').length;
    await A.ctx.close();
  }
  // 3) region passed explicitly -> X-TCB-Region header on DB requests; same hosts
  {
    const emu = createEmulator({ collections: { hansen_pk_rooms: ACL.READONLY } });
    emu.seedUser({ username: 'a1', password: 'pw123456' });
    const A = await newCtx(browser, emu, ORIGIN, { tag: 'A-region', url: '/__poc__/sdk.html?region=ap-shanghai' });
    await login(A.page, 'a1', 'pw123456');
    await E(A.page, async () => window.__app.database().collection('hansen_pk_rooms').where({ a: 1 }).get());
    const q = emu.log.find((x) => x.body && x.body.action === 'database.queryDocument');
    out.regionHeader = q && { host: q.host, xTcbRegion: q.headers['x-tcb-region'] };
    await A.ctx.close();
  }
  // 4) transport failures as the app would see them
  {
    const emu = createEmulator({ collections: { hansen_pk_rooms: ACL.READONLY } });
    emu.seedUser({ username: 'a1', password: 'pw123456' });
    const A = await newCtx(browser, emu, ORIGIN, { tag: 'A-fail' });
    await login(A.page, 'a1', 'pw123456');
    const db = (fn) => E(A.page, fn);
    // a) HTTP 502 html from gateway on /web
    emu.injectFault((r, b) => b.action === 'database.queryDocument', (r) => ({ status: 502, headers: { 'access-control-allow-origin': r.headers.origin, 'content-type': 'text/html' }, body: '<html>502</html>' }));
    out.http502 = await db(async () => window.__app.database().collection('hansen_pk_rooms').where({ a: 1 }).get().then((r) => ({ resolved: r }), (e) => ({ rejected: String(e && e.message || e), type: Object.prototype.toString.call(e) })));
    // b) network abort (route.abort) on /web
    await A.ctx.route(/\/web\?env=/, (r) => r.abort('internetdisconnected'));
    out.netAbort = await db(async () => window.__app.database().collection('hansen_pk_rooms').where({ a: 1 }).get().then((r) => ({ resolved: r }), (e) => ({ rejected: String(e && e.message || e), keys: Object.keys(e || {}) })));
    await A.ctx.unroute(/\/web\?env=/);
    // c) server says access token invalid (e.g. session revoked)
    emu.injectFault((r, b) => b.action === 'database.queryDocument', (r) => ({ status: 200, headers: { 'access-control-allow-origin': r.headers.origin, 'content-type': 'application/json' }, body: JSON.stringify({ code: 'INVALID_ACCESS_TOKEN', message: 'access token invalid', requestId: 'x' }) }));
    out.invalidToken = await db(async () => window.__app.database().collection('hansen_pk_rooms').where({ a: 1 }).get().then((r) => ({ resolved: r }), (e) => ({ rejected: String(e && e.message || e) })));
    // d) not logged in at all: DB call
    const N = await newCtx(browser, emu, ORIGIN, { tag: 'N' });
    out.notLoggedInDb = await E(N.page, async () => window.__app.database().collection('hansen_pk_rooms').where({ a: 1 }).get().then((r) => ({ resolved: r }), (e) => ({ rejected: e && (e.error || e.message), desc: e && e.error_description, type: Object.prototype.toString.call(e) })));
    out.notLoggedInLoginState = await E(N.page, async () => { const st = await window.__auth.getLoginState(); return st == null ? null : Object.keys(st); });
    // e) refresh token already used (multi-instance race seen in production: invalid_grant) -> credentials deleted
    await E(A.page, async () => { const k = Object.keys(localStorage).find((x) => /^credentials_/.test(x)); const c = JSON.parse(localStorage.getItem(k)); c.expires_at = new Date(Date.now() - 1000).toISOString(); localStorage.setItem(k, JSON.stringify(c)); });
    emu.expireAllAccessTokens();
    // burn the refresh token from "another instance"
    for (const [k, v] of Object.entries({})) void k, v;
    const rtUsed = await E(A.page, async () => { const k = Object.keys(localStorage).find((x) => /^credentials_/.test(x)); return JSON.parse(localStorage.getItem(k)).refresh_token; });
    emu.handle({ method: 'POST', url: `https://${ENV}.ap-shanghai.tcb-api.tencentcloudapi.com/auth/v1/token`, headers: {}, body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: rtUsed }) });
    await A.page.reload(); await A.page.evaluate(() => window.__ready);
    out.refreshRace = await E(A.page, async () => {
      const st = await window.__auth.getLoginState();
      const r = await window.__app.database().collection('hansen_pk_rooms').where({ a: 1 }).get().then((x) => ({ resolved: x }), (e) => ({ rejected: e && (e.error || e.message), desc: e && e.error_description }));
      return { loginStateNull: st == null, db: r, credKeysLeft: Object.keys(localStorage).filter((k) => /^credentials_/.test(k)), userInfoLeft: Object.keys(localStorage).filter((k) => /^user_info_/.test(k)) };
    });
    await A.ctx.close(); await N.ctx.close();
  }
} finally {
  await browser.close(); srv.close();
  console.log(JSON.stringify(out, null, 2));
}
