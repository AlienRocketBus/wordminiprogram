// PoC: real vendored @cloudbase/js-sdk 2.30.0 in Chromium, every Tencent request answered by emulator.mjs.
// Run: node /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/emulator-poc/poc.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createEmulator, ACL } from './emulator.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.REPO || '/home/claude/work/repo';
const ENV = 'ambitious-d0g1d26xm740dc3d6';
const REGION = process.env.POC_REGION || '';   // hansen_cloud_config_v965.js has region:'' -> app() calls init({env}) only

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

const SDK_PAGE = `<!doctype html><meta charset="utf-8"><title>emu-poc</title><body>poc
<script type="module">
window.__ready = (async () => {
  const q = new URLSearchParams(location.search);
  const mod = await import('/vendor_cloudbase_esm_v965.js');          // same import as hansen_auth_v1004.js app()
  const cb = mod && (mod.default || mod);
  const init = cb && (cb.init || (cb.default && cb.default.init));
  const region = q.get('region') || '';
  const app = init.call(cb, region ? { env: '${ENV}', region } : { env: '${ENV}' });
  const auth = app.auth ? app.auth({ persistence: 'local' }) : null;    // same as app()
  window.__app = app; window.__auth = auth;
  return { version: cb.version || (app && app.version) || null };
})();
</script>`;

function startStatic() {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/__poc__/sdk.html') { res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' }); return res.end(SDK_PAGE); }
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const fp = path.join(REPO, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!fp.startsWith(path.resolve(REPO))) { res.writeHead(403); return res.end(); }
    fs.stat(fp, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('404'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-store' });
      fs.createReadStream(fp).pipe(res);
    });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail).slice(0, 400) : '')); }

const emu = createEmulator({
  env: ENV,
  collections: { hansen_pk_rooms: ACL.READONLY, hansen_saves: ACL.READONLY, sb_profile: ACL.READONLY, counters: ACL.ADMINONLY, hansen_friends: ACL.READONLY },
});
emu.seedUser({ username: 'alice_poc', password: 'pw123456', name: 'Alice' });

const srv = await startStatic();
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ headless: true });
const unrouted = [];
async function newCtx(tag) {
  const ctx = await browser.newContext();
  await emu.attach(ctx);
  // anything else leaving localhost is a test bug: abort and record
  await ctx.route((url) => { const h = new URL(url).hostname; return h !== '127.0.0.1' && !/(tencentcloudapi|tcloudbase|myqcloud|qcloud|cloudbase\.net)/.test(h); }, (r) => { unrouted.push(r.request().url()); r.abort(); });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (process.env.POC_VERBOSE || m.type() === 'error') console.log(`  [${tag} console.${m.type()}] ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => console.log(`  [${tag} pageerror] ${e.message}`));
  page.on('requestfailed', (r) => console.log(`  [${tag} requestfailed] ${r.method()} ${r.url()} ${r.failure() && r.failure().errorText}`));
  await page.goto(`${ORIGIN}/__poc__/sdk.html${REGION ? '?region=' + REGION : ''}`);
  const info = await page.evaluate(() => window.__ready);
  return { ctx, page, info };
}
const E = (page, fn, arg) => page.evaluate(fn, arg).catch((e) => ({ __thrown: String(e && e.message || e) }));

try {
  // ── User A (alice): username + password signIn — the app's loginByPassword() path
  const A = await newCtx('A');
  check('SDK loaded via dynamic import, init + auth() ok', A.info, A.info);
  const a1 = await E(A.page, async () => {
    const auth = window.__auth;
    const r = await auth.signIn({ username: 'alice_poc', password: 'pw123456' });
    const st = await auth.getLoginState();
    const cur = await auth.getCurrentUser();
    const keys = Object.keys(localStorage).map((k) => [k, (localStorage.getItem(k) || '').length]);
    return { signInType: r && r.constructor && r.constructor.name, stNull: st == null, stKeys: st ? Object.keys(st) : null, uid: st && st.user && st.user.uid, curUid: cur && cur.uid, keys };
  });
  check('A signIn -> getLoginState() non-null with .user.uid', a1 && !a1.__thrown && !a1.stNull && /^\d{19}$/.test(a1.uid || ''), a1);
  const aliceUid = a1.uid;

  const a2 = await E(A.page, async () => {
    const db = window.__app.database();
    const doc = { status: 'open', isPrivate: false, hostId: 'H1', guestId: '', createdAt: Date.now(), heartbeatAt: Date.now(), when: new Date(1700000000000) };
    const add = await db.collection('hansen_pk_rooms').add(doc);
    const q = await db.collection('hansen_pk_rooms').where({ status: 'open' }).get();
    const q2 = await db.collection('hansen_pk_rooms').where({ status: 'open', isPrivate: false }).orderBy('createdAt', 'desc').limit(40).get();
    const cnt = await db.collection('hansen_pk_rooms').where({ status: 'open' }).count();
    const one = await db.collection('hansen_pk_rooms').doc(add.id).get();
    const _ = db.command;
    const cmd = await db.collection('hansen_pk_rooms').where({ createdAt: _.gt(0), status: _.in(['open', 'x']) }).skip(0).limit(5).get();
    return { add, qLen: q.data.length, q0: q.data[0], whenIsDate: q.data[0] && q.data[0].when instanceof Date, q2Len: q2.data.length, cnt, oneLen: one.data.length, cmdLen: cmd.data.length };
  });
  check('A add() returns {id}', a2 && a2.add && typeof a2.add.id === 'string' && a2.add.id.length > 0, a2 && a2.add);
  check('A where({status:open}).get() returns the doc with _openid=aliceUid', a2 && a2.qLen === 1 && a2.q0 && a2.q0._openid === aliceUid, a2 && a2.q0);
  check('A orderBy/limit, count, doc().get, command gt/in all work', a2 && a2.q2Len === 1 && a2.cnt && a2.cnt.total === 1 && a2.oneLen === 1 && a2.cmdLen === 1 && a2.whenIsDate, a2);
  const roomId = a2.add.id;

  // ── User B (bob): phone verification-code signup (the app's loginByPhoneCode() new-user path), second context
  const B = await newCtx('B');
  const b1 = await E(B.page, async () => {
    const auth = window.__auth;
    const v = await auth.getVerification({ phone_number: '+86 13800000001' });
    const su = await auth.signUp({ phone_number: '+86 13800000001', verification_code: '123456' });
    const st = await auth.getLoginState();
    return { v, suType: su && su.constructor && su.constructor.name, uid: st && st.user && st.user.uid };
  });
  check('B getVerification -> {verification_id,is_user:false}; signUp(phone,code) -> login state', b1 && b1.v && b1.v.verification_id && b1.v.is_user === false && /^\d{19}$/.test(b1.uid || ''), b1);
  const bobUid = b1.uid;

  // B tries to claim A's room exactly like hansen_pk_room realTransport.claim()
  const claimFn = async ({ roomId, bobUid }) => {
    const db = window.__app.database();
    const w = { _id: roomId, status: 'open', guestId: '' };
    const r = await db.collection('hansen_pk_rooms').where(w).update({ guestId: bobUid, status: 'playing' });
    const r2 = await db.collection('hansen_pk_rooms').doc(roomId).update({ heartbeatAt: 1 });
    const r3 = await db.collection('hansen_pk_rooms').doc(roomId).remove();
    return { whereUpdate: r, docUpdate: r2, docRemove: r3, appClaimSees: { updated: (r && (r.updated != null ? r.updated : r.stats && r.stats.updated)) || 0 } };
  };
  emu.knobs.permissionMode = 'legacy';
  const b2 = await E(B.page, claimFn, { roomId, bobUid });
  check('[legacy] B (non-creator) where().update() on READONLY -> resolves {updated:0}, no error', b2 && b2.whereUpdate && b2.whereUpdate.updated === 0 && !b2.whereUpdate.code, b2);
  check('[legacy] B doc().update -> updated:0 ; doc().remove -> deleted:0', b2 && b2.docUpdate.updated === 0 && b2.docRemove.deleted === 0, b2);
  emu.knobs.permissionMode = 'rules';
  const b3 = await E(B.page, claimFn, { roomId, bobUid });
  check('[rules] B where().update() -> RESOLVES (not rejects) with {code:DATABASE_PERMISSION_DENIED}', b3 && b3.whereUpdate && b3.whereUpdate.code === 'DATABASE_PERMISSION_DENIED', b3);
  check('[rules] app claim() would read that as updated:0 (silently)', b3 && b3.appClaimSees.updated === 0, b3 && b3.appClaimSees);
  emu.knobs.permissionMode = 'legacy';
  const roomAfter = emu.dump('hansen_pk_rooms').find((d) => d._id === roomId);
  check('room unchanged after B attempts', roomAfter && roomAfter.guestId === '' && roomAfter.status === 'open', roomAfter);

  // owner can do the same conditional update
  const a3 = await E(A.page, async ({ roomId }) => {
    const db = window.__app.database();
    const r = await db.collection('hansen_pk_rooms').where({ _id: roomId, status: 'open', guestId: '' }).update({ guestId: 'G', status: 'playing' });
    const again = await db.collection('hansen_pk_rooms').where({ _id: roomId, status: 'open', guestId: '' }).update({ guestId: 'G2' });
    return { r, again };
  }, { roomId });
  check('A (creator) conditional update -> updated:1, second identical guard -> updated:0 (atomic claim)', a3 && a3.r.updated === 1 && a3.again.updated === 0, a3);

  // collection that does not exist / ADMINONLY
  const a4 = await E(A.page, async () => {
    const db = window.__app.database();
    const r1 = await db.collection('hansen_friend_msgs').where({ to: 'x' }).get().then((x) => ({ resolved: x }), (e) => ({ rejected: String(e && (e.message || e.code) || e) }));
    const r2 = await db.collection('counters').doc('c').get().then((x) => ({ resolved: x }), (e) => ({ rejected: String(e && (e.message || e.code) || e) }));
    const r3 = await db.collection('hansen_friend_msgs').add({ a: 1 }).then((x) => ({ resolved: x }), (e) => ({ rejected: String(e) }));
    return { r1, r2, r3 };
  });
  check('missing collection: get() RESOLVES with {code:DATABASE_COLLECTION_NOT_EXIST}', a4 && a4.r1.resolved && a4.r1.resolved.code === 'DATABASE_COLLECTION_NOT_EXIST', a4 && a4.r1);
  check('ADMINONLY: get() resolves with {code:DATABASE_PERMISSION_DENIED}', a4 && a4.r2.resolved && a4.r2.resolved.code === 'DATABASE_PERMISSION_DENIED', a4 && a4.r2);
  check('missing collection: add() resolves {code} (app realTransport.add would return {id:doc._id||""})', a4 && a4.r3.resolved && a4.r3.resolved.code, a4 && a4.r3);

  // token refresh: expire every access token server-side AND client-side clock -> SDK must call /auth/v1/token
  const nTokenBefore = emu.log.filter((x) => x.path === '/auth/v1/token').length;
  const a5 = await E(A.page, async () => {
    const k = Object.keys(localStorage).find((x) => /^credentials_/.test(x));
    const c = JSON.parse(localStorage.getItem(k)); c.expires_at = new Date(Date.now() - 1000).toISOString(); localStorage.setItem(k, JSON.stringify(c));
    // the SDK caches credentials in memory too; reload page to force storage path
    return k;
  });
  emu.expireAllAccessTokens();
  await A.page.reload(); await A.page.evaluate(() => window.__ready);
  const a6 = await E(A.page, async () => {
    const st = await window.__auth.getLoginState();
    const r = await window.__app.database().collection('hansen_pk_rooms').where({ status: 'playing' }).get();
    return { uid: st && st.user && st.user.uid, n: r.data && r.data.length, code: r.code };
  });
  const nTokenAfter = emu.log.filter((x) => x.path === '/auth/v1/token').length;
  check('expired access token -> SDK refreshes via POST /auth/v1/token and the call succeeds', a5 && a6 && a6.uid === aliceUid && a6.n === 1 && nTokenAfter === nTokenBefore + 1, { a5, a6, refreshCalls: nTokenAfter - nTokenBefore });

  // existing-user phone login: verify -> signIn({username:phone, verification_token})  (loginByPhoneCode old-user path)
  const C = await newCtx('C');
  const c1 = await E(C.page, async () => {
    const auth = window.__auth;
    const v = await auth.getVerification({ phone_number: '+86 13800000001' });
    const vv = await auth.verify({ verification_id: v.verification_id, verification_code: '123456' });
    await auth.signIn({ username: '+86 13800000001', verification_token: vv.verification_token });
    const st = await auth.getLoginState();
    return { isUser: v.is_user, uid: st && st.user && st.user.uid };
  });
  check('C (bob on another device) verify + signIn(verification_token) -> same uid', c1 && c1.isUser === true && c1.uid === bobUid, c1);

  // wrong password -> how the SDK rejects
  const c2 = await E(C.page, async () => window.__auth.signIn({ username: 'alice_poc', password: 'nope' }).then((x) => ({ resolved: true }), (e) => ({ rejected: true, type: Object.prototype.toString.call(e), keys: Object.keys(e || {}), error: e && e.error, desc: e && e.error_description, msg: e && e.message })));
  check('wrong password -> signIn rejects with plain object {error:"invalid_password",error_description,...}', c2 && c2.rejected && c2.error === 'invalid_password', c2);

  // app's registerByPassword() path: signUpWithEmailAndPassword(mail,pw) on the v2 SDK
  const D = await newCtx('D');
  const d1 = await E(D.page, async () => {
    const auth = window.__auth;
    const has = typeof auth.signUpWithEmailAndPassword;
    let r = null, err = null;
    try { r = await auth.signUpWithEmailAndPassword('x_1@u.wordadventure.local', 'pw123456'); } catch (e) { err = String(e && (e.message || e.error_description || e.error) || e); }
    const st = await auth.getLoginState();
    return { has, resultKeys: r && Object.keys(r), dataKeys: r && r.data && Object.keys(r.data), err, stNull: st == null, credKeys: Object.keys(localStorage).filter((k) => /^credentials_/.test(k)) };
  });
  const verifReqs = emu.log.filter((x) => x.path === '/auth/v1/verification' && x.body && x.body.email);
  const signupReqs = emu.log.filter((x) => x.path === '/auth/v1/signup' && x.body && x.body.email);
  check('signUpWithEmailAndPassword exists but only SENDS AN EMAIL CODE (returns {data:{verifyOtp}}), creates NO session', d1 && d1.has === 'function' && d1.stNull && verifReqs.length >= 1 && signupReqs.length === 0, { d1, verificationRequests: verifReqs.length, signupRequests: signupReqs.length });

  // eventual-consistency + latency knobs
  emu.knobs.consistencyLagMs = 1500; emu.knobs.latencyMs = 200;
  const a7 = await E(A.page, async () => {
    const db = window.__app.database();
    const t0 = performance.now();
    const add = await db.collection('hansen_pk_rooms').add({ status: 'lagtest' });
    const tAdd = performance.now() - t0;
    const r1 = await db.collection('hansen_pk_rooms').where({ status: 'lagtest' }).get();
    await new Promise((r) => setTimeout(r, 1700));
    const r2 = await db.collection('hansen_pk_rooms').where({ status: 'lagtest' }).get();
    return { tAdd, immediate: r1.data.length, later: r2.data.length };
  });
  emu.knobs.consistencyLagMs = 0; emu.knobs.latencyMs = 0;
  check('knobs: latency 200ms observed, consistency lag hides fresh write then shows it', a7 && a7.tAdd >= 190 && a7.immediate === 0 && a7.later === 1, a7);

  // inspect what was on the wire
  const sample = (pred) => { const x = emu.log.find(pred); return x && { method: x.method, host: x.host, path: x.path, search: x.search, headers: x.headers, body: x.body, res: x.res }; };
  const wire = {
    signin: sample((x) => x.path === '/auth/v1/signin'),
    userMe: sample((x) => x.path === '/auth/v1/user/me'),
    token: sample((x) => x.path === '/auth/v1/token'),
    verification: sample((x) => x.path === '/auth/v1/verification'),
    verify: sample((x) => x.path === '/auth/v1/verification/verify'),
    signup: sample((x) => x.path === '/auth/v1/signup'),
    add: sample((x) => x.body && x.body.action === 'database.addDocument'),
    query: sample((x) => x.body && x.body.action === 'database.queryDocument' && x.body.order),
    queryCmd: sample((x) => x.body && x.body.action === 'database.queryDocument' && x.body.query && x.body.query.createdAt),
    count: sample((x) => x.body && x.body.action === 'database.countDocument'),
    updWhere: sample((x) => x.body && x.body.action === 'database.updateDocument' && x.body.multi),
    updDoc: sample((x) => x.body && x.body.action === 'database.updateDocument' && !x.body.multi),
    del: sample((x) => x.body && x.body.action === 'database.deleteDocument'),
    options: emu.log.filter((x) => x.method === 'OPTIONS').map((x) => x.host + x.path).slice(0, 5),
    allPaths: [...new Set(emu.log.map((x) => `${x.method} ${x.host}${x.path}${x.body && x.body.action ? ' ' + x.body.action : ''}`))],
  };
  fs.writeFileSync(path.join(HERE, 'wire_log.json'), JSON.stringify(wire, null, 2));
  fs.writeFileSync(path.join(HERE, 'full_log.json'), JSON.stringify(emu.log, null, 1));
  check('no request escaped to an unrouted external host', unrouted.length === 0, unrouted.slice(0, 5));
  console.log('OPTIONS preflights that reached the route handler:', wire.options.length, wire.options);
  console.log('distinct endpoints:', wire.allPaths);
} finally {
  await browser.close();
  srv.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(HERE, 'results.json'), JSON.stringify(results, null, 2));
  process.exitCode = failed.length ? 1 : 0;
}
