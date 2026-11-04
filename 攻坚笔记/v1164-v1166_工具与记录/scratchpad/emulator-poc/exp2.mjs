// Anonymous login, storage formats, SDK timeouts/retries.
import { createEmulator, ACL } from './emulator.mjs';
import { startStatic, launch, newCtx, E } from './harness.mjs';

const out = {};
const srv = await startStatic();
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;
const browser = await launch();
try {
  const emu = createEmulator({ collections: { hansen_pk_rooms: ACL.READONLY } });
  emu.seedUser({ username: 'a1', password: 'pw123456' });
  const A = await newCtx(browser, emu, ORIGIN, { tag: 'A' });
  out.anonDisabled = await E(A.page, async () => {
    const auth = window.__auth;
    const p = typeof auth.anonymousAuthProvider === 'function' ? auth.anonymousAuthProvider().signIn() : auth.signInAnonymously();
    return Promise.resolve(p).then((r) => ({ resolved: r && Object.keys(r), err: r && r.error && (r.error.message || r.error.code) }), (e) => ({ rejected: e && (e.error || e.message), desc: e && e.error_description }));
  });
  emu.knobs.anonymousEnabled = true;
  out.anonEnabled = await E(A.page, async () => {
    const auth = window.__auth;
    await (typeof auth.anonymousAuthProvider === 'function' ? auth.anonymousAuthProvider().signIn() : auth.signInAnonymously());
    const st = await auth.getLoginState();
    return { uid: st && st.user && st.user.uid, isAnon: st && st.isAnonymousAuth };
  });
  out.anonEndpoint = emu.log.filter((x) => /anonym/.test(x.path)).map((x) => ({ path: x.path + x.search, auth: (x.headers.authorization || '').slice(0, 12), body: x.body, status: x.res && x.res.status }));
  await E(A.page, async () => { await window.__auth.signOut(); });
  await E(A.page, async () => { await window.__auth.signIn({ username: 'a1', password: 'pw123456' }); });
  out.storage = await E(A.page, async () => Object.fromEntries(Object.keys(localStorage).map((k) => { const v = localStorage.getItem(k); let j = null; try { j = JSON.parse(v); } catch {} return [k, j && typeof j === 'object' ? Object.fromEntries(Object.entries(j).map(([kk, vv]) => [kk, typeof vv === 'string' && vv.length > 40 ? vv.slice(0, 20) + '…(' + vv.length + ')' : vv])) : v]; })));
  out.signoutEndpoints = emu.log.filter((x) => /revoke|signout/.test(x.path)).map((x) => ({ path: x.path, body: Object.keys(x.body || {}) }));

  // DB request hang: SDK XHR timeout (config timeout 15s) -> 'network request error'?
  emu.knobs.latencyMs = (req) => (/\/web/.test(req.url) ? 16500 : 0);
  const t0 = Date.now();
  out.dbHang = await E(A.page, async () => window.__app.database().collection('hansen_pk_rooms').where({ a: 1 }).get().then((r) => ({ resolved: r }), (e) => ({ rejected: String(e && e.message || e) })));
  out.dbHangMs = Date.now() - t0;
  emu.knobs.latencyMs = 0;
  // auth fetch network failure -> retries
  const n0 = emu.log.length;
  let aborted = 0;
  await A.ctx.route(/\/auth\/v1\/signin/, (r) => { aborted++; r.abort('failed'); });
  const t1 = Date.now();
  out.authNetFail = await E(A.page, async () => window.__auth.signIn({ username: 'a1', password: 'pw123456' }).then(() => 'resolved', (e) => ({ rejected: e && (e.error || e.message), desc: e && e.error_description })));
  out.authNetFailMs = Date.now() - t1; out.authNetFailAttempts = aborted; void n0;
} finally {
  await browser.close(); srv.close();
  console.log(JSON.stringify(out, null, 2));
}
