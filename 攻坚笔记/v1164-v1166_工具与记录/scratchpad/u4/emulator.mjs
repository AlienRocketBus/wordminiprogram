// CloudBase (Tencent TCB) HTTP emulator — mimics what @cloudbase/js-sdk 2.30.0
// (vendor_cloudbase_esm_v965.js) sends/expects. Pure function core: handle(req) -> res.
// NOT in the repo on purpose (read-only investigation phase).
//
// Hosts handled (env = ambitious-d0g1d26xm740dc3d6):
//   https://<env>.ap-shanghai.tcb-api.tencentcloudapi.com/auth/v1/...   (oauth: fetch(), JSON)
//   https://<env>.ap-shanghai.tcb-api.tencentcloudapi.com/web?env=<env> (database: XHR, JSON body {action,...})
//   https://<env>.api.tcloudbasegateway.com/v1/...                       (gateway; not used by the app paths -> 501)
import crypto from 'node:crypto';

const b64u = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const rid = () => crypto.randomBytes(8).toString('hex');
const now = () => Date.now();
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

// Collection ACL names follow CloudBase legacy "simple permission" ids.
//   READONLY    = 「读取全部数据，修改本人数据」 (all read, creator writes)
//   PRIVATE     = 「读取和修改本人数据」
//   ADMINWRITE  = 「读取全部数据，不可修改数据」
//   ADMINONLY   = 「无权限」 (client SDK: nothing)
export const ACL = { READONLY: 'READONLY', PRIVATE: 'PRIVATE', ADMINWRITE: 'ADMINWRITE', ADMINONLY: 'ADMINONLY', PUBLIC_TEST_ONLY: 'PUBLIC_TEST_ONLY' /* not a real CloudBase preset: everyone writes everything (negative control) */ };

export function createEmulator(opts = {}) {
  const env = opts.env || 'ambitious-d0g1d26xm740dc3d6';
  const region = opts.region || 'ap-shanghai';
  const knobs = Object.assign({
    latencyMs: 0,                // number | (req)=>number   (applied by the transport, see delay())
    jitterMs: 0,
    consistencyLagMs: 0,         // reads see a write only after this many ms (writes/conditional updates hit "primary")
    // How a write that the ACL forbids is answered:
    //  'legacy' -> server silently ANDs {_openid: caller} into the write query -> {updated:0}/{deleted:0} (HTTP 200, no code)
    //  'rules'  -> {code:'DATABASE_PERMISSION_DENIED', message:'Permission denied'} (HTTP 200)
    permissionMode: 'legacy',
    accessTokenTtlSec: 7200,
    verificationCode: '123456',
    autoCreateCollections: false, // real server: DATABASE_COLLECTION_NOT_EXIST
    refreshTokenRotation: true,   // a refresh_token is single-use (real server: invalid_grant "...may be has been refreshed by")
    corsAllowOrigin: null,        // null -> echo request Origin
    noCors: false,                // experiment: omit all Access-Control-* headers
    anonymousEnabled: false,      // app evidence: real env showed 「云端匿名登录未开通」 (hansen_cloud_save_v965.js:401)
  }, opts.knobs || {});

  const users = new Map();       // uid -> user
  const byLogin = new Map();     // username/email/phone -> uid
  const access = new Map();      // access_token -> {uid, exp}
  const refresh = new Map();     // refresh_token -> {uid, used}
  const verifs = new Map();      // verification_id -> {target, code, used, exp}
  const vtokens = new Map();     // verification_token -> {target, used}
  const cols = new Map();        // name -> {acl, docs: Map(id -> [{at, doc|null}])}
  const log = [];                // every request seen
  const faults = [];             // [{match(req)->bool, times, respond(req)->res}]

  for (const [name, acl] of Object.entries(opts.collections || {})) cols.set(name, { acl, docs: new Map() });

  // ───────────────────────── helpers
  function cors(req, extra = {}) {
    if (knobs.noCors) return Object.assign({}, extra);
    const origin = knobs.corsAllowOrigin || req.headers.origin || '*';
    return Object.assign({
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': req.headers['access-control-request-headers'] || '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-expose-headers': 'x-tcb-trace,x-request-id',
      'vary': 'Origin',
    }, extra);
  }
  const json = (req, status, body, extra) => ({ status, headers: cors(req, Object.assign({ 'content-type': 'application/json; charset=utf-8', 'x-request-id': req.headers['x-request-id'] || rid() }, extra)), body: JSON.stringify(body) });
  const authErr = (req, status, error, error_code, error_description) => json(req, status, { error, error_code, error_description });

  function newUid() { let s = '1'; for (let i = 0; i < 18; i++) s += Math.floor(Math.random() * 10); return s; }
  function mkJwt(uid, exp) {
    const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'emu' }));
    const p = b64u(JSON.stringify({ iss: `https://${env}.${region}.tcb-api.tencentcloudapi.com`, sub: uid, aud: env, exp: Math.floor(exp / 1000), iat: Math.floor(now() / 1000), scope: 'user', project_id: env, meta: { platform: 'Username' }, user_type: '', client_type: 'client_user', is_system_admin: false }));
    return `${h}.${p}.${b64u(crypto.randomBytes(32))}`;
  }
  function issueTokens(uid) {
    const exp = now() + knobs.accessTokenTtlSec * 1000;
    const at = mkJwt(uid, exp);
    const rt = b64u(crypto.randomBytes(24));
    access.set(at, { uid, exp });
    refresh.set(rt, { uid, used: false });
    // Shape the SDK stores verbatim (setCredentials needs expires_in, else it DELETES stored creds: offset ~140990)
    return { token_type: 'Bearer', access_token: at, refresh_token: rt, expires_in: knobs.accessTokenTtlSec, scope: 'user', sub: uid, groups: ['user'] };
  }
  function bearerUid(req) {
    const a = req.headers.authorization || '';
    const m = /^Bearer\s+(.+)$/i.exec(a);
    if (!m) return { err: 'missing' };
    const t = access.get(m[1]);
    if (!t) return { err: 'invalid' };
    if (t.exp < now()) return { err: 'expired' };
    return { uid: t.uid };
  }
  function createUser({ username, email, phone_number, password, name }) {
    const uid = newUid();
    const u = { uid, username: username || '', email: email || '', phone_number: phone_number || '', password: password || '', name: name || username || '', created_at: new Date().toISOString(), created_from: phone_number ? 'phone' : (email ? 'email' : 'username') };
    users.set(uid, u);
    for (const k of [u.username, u.email, u.phone_number]) if (k) byLogin.set(k, uid);
    return u;
  }
  function userMe(u) {
    return { sub: u.uid, name: u.name, picture: '', username: u.username, email: u.email, email_verified: !!u.email, phone_number: u.phone_number, groups: [{ id: 'user', expires_at: '' }], gender: '', birthdate: '', zoneinfo: '', locale: '', created_from: u.created_from, created_at: u.created_at, updated_at: u.created_at, status: 'ACTIVE', providers: [], password_updated_at: '' };
  }

  // ───────────────────────── auth (/auth/v1/*)
  function handleAuth(req, path, body) {
    if (path === '/v1/verification' && req.method === 'POST') {
      const target = body.phone_number || body.email;
      if (!target) return authErr(req, 400, 'invalid_argument', 3, 'phone_number or email required');
      const id = 'v_' + rid();
      verifs.set(id, { target, code: knobs.verificationCode, used: false, exp: now() + 600e3 });
      return json(req, 200, { verification_id: id, expires_in: 600, is_user: byLogin.has(target) });
    }
    if (path === '/v1/verification/verify' && req.method === 'POST') {
      const v = verifs.get(body.verification_id);
      if (!v || v.used || v.exp < now() || String(body.verification_code) !== v.code)
        return authErr(req, 400, 'invalid_verification_code', 3, 'verification code does not match');
      v.used = true;
      const tok = 'vt_' + rid();
      vtokens.set(tok, { target: v.target, used: false });
      return json(req, 200, { verification_token: tok, expires_in: 600 });
    }
    if (path === '/v1/signup' && req.method === 'POST') {
      let target = body.phone_number || body.email;
      if (body.verification_code) {
        const v = [...verifs.values()].find((x) => x.target === target && !x.used && x.code === String(body.verification_code));
        if (!v) return authErr(req, 400, 'invalid_verification_code', 3, 'verification code does not match');
        v.used = true;
      } else if (body.verification_token) {
        const vt = vtokens.get(body.verification_token);
        if (!vt || vt.used) return authErr(req, 400, 'invalid_argument', 3, 'verification token error');
        vt.used = true; target = target || vt.target;
      } else return authErr(req, 400, 'invalid_argument', 3, 'verification_token required');
      if (byLogin.has(target) || (body.username && byLogin.has(body.username))) return authErr(req, 400, 'already_exists', 6, 'user already exists');
      const u = createUser({ username: body.username, email: body.email, phone_number: body.phone_number, password: body.password, name: body.name });
      return json(req, 200, issueTokens(u.uid));
    }
    if (path === '/v1/signin' && req.method === 'POST') {
      if (body.params && body.public_key_thumbprint) return authErr(req, 400, 'invalid_argument', 3, 'emulator: encrypted signin (v2/isEncrypt) not supported');
      const uid = byLogin.get(body.username);
      if (!uid) return authErr(req, 404, 'not_found', 5, 'User not exist');
      const u = users.get(uid);
      if (body.verification_token) {
        const vt = vtokens.get(body.verification_token);
        if (!vt || vt.used || vt.target !== body.username) return authErr(req, 400, 'invalid_argument', 3, 'verification token error');
        vt.used = true;
      } else if (body.password != null) {
        if (!u.password) return authErr(req, 400, 'password_not_set', 9, 'password not set');
        if (u.password !== body.password) return authErr(req, 400, 'invalid_password', 3, 'invalid password');
      } else return authErr(req, 400, 'invalid_argument', 3, 'password or verification_token required');
      return json(req, 200, issueTokens(uid));
    }
    if (path === '/v1/signin/anonymously' && req.method === 'POST') {
      if (!knobs.anonymousEnabled) return authErr(req, 403, 'login_type_disabled', 7, 'anonymous login is not enabled');
      const u = createUser({});
      u.created_from = 'anonymous';
      const t = issueTokens(u.uid); t.scope = 'anonymous';
      return json(req, 200, t);
    }
    if (path === '/v1/token' && req.method === 'POST') {
      if (body.grant_type !== 'refresh_token') return authErr(req, 400, 'unsupported_grant_type', 3, 'unsupported grant_type');
      const r = refresh.get(body.refresh_token);
      if (!r || (knobs.refreshTokenRotation && r.used))
        return authErr(req, 400, 'invalid_grant', 3, 'invalid refresh token. for it may be has been refreshed by (emulated; real suffix unknown)');
      r.used = true;
      return json(req, 200, issueTokens(r.uid));
    }
    if (path === '/v1/user/me' && req.method === 'GET') {
      const b = bearerUid(req);
      if (b.err) return authErr(req, 401, 'unauthenticated', 16, 'credentials not found / invalid access token: ' + b.err);
      return json(req, 200, userMe(users.get(b.uid)));
    }
    if (path === '/v1/user/basic/edit' || path === '/v1/user/profile') {
      const b = bearerUid(req);
      if (b.err) return authErr(req, 401, 'unauthenticated', 16, 'unauthenticated');
      const u = users.get(b.uid);
      if (body.username) { byLogin.delete(u.username); u.username = body.username; byLogin.set(body.username, u.uid); }
      if (body.name) u.name = body.name;
      return json(req, 200, userMe(u));
    }
    if ((path === '/v1/revoke' || path === '/v1/user/signout') && req.method === 'POST') {
      if (body.token) access.delete(body.token);
      return json(req, 200, {});
    }
    return authErr(req, 404, 'not_found', 5, `emulator: no auth route ${req.method} ${path}`);
  }

  // ───────────────────────── database (/web, action=database.*)
  function col(name) {
    let c = cols.get(name);
    if (!c && knobs.autoCreateCollections) { c = { acl: ACL.READONLY, docs: new Map() }; cols.set(name, c); }
    return c;
  }
  // version list per doc: [{at, doc}] (doc null = deleted)
  const latest = (vers) => vers[vers.length - 1].doc;
  function visible(vers, t) {
    const cutoff = t - knobs.consistencyLagMs;
    for (let i = vers.length - 1; i >= 0; i--) if (vers[i].at <= cutoff) return vers[i].doc;
    return null;
  }
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  function setPath(o, p, v) { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null || typeof a[ks[i]] !== 'object') a[ks[i]] = {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; }
  function unsetPath(o, p) { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { a = a && a[ks[i]]; } if (a) delete a[ks[ks.length - 1]]; }
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function cmpVal(fieldVal, op, arg) {
    const vals = Array.isArray(fieldVal) && op !== '$size' ? [fieldVal, ...fieldVal] : [fieldVal];
    const any = (f) => vals.some(f);
    switch (op) {
      case '$eq': return any((v) => eq(v, arg));
      case '$ne': case '$neq': return !any((v) => eq(v, arg));
      case '$gt': return any((v) => v != null && v > arg);
      case '$gte': return any((v) => v != null && v >= arg);
      case '$lt': return any((v) => v != null && v < arg);
      case '$lte': return any((v) => v != null && v <= arg);
      case '$in': return any((v) => arg.some((x) => eq(v, x)));
      case '$nin': return !any((v) => arg.some((x) => eq(v, x)));
      case '$exists': return (fieldVal !== undefined) === !!arg;
      case '$size': return Array.isArray(fieldVal) && fieldVal.length === arg;
      case '$regex': return any((v) => typeof v === 'string' && new RegExp(arg.$regex || arg, arg.$options || '').test(v));
      default: throw new Error('emulator: unsupported query op ' + op);
    }
  }
  function match(doc, q) {
    if (!q) return true;
    for (const [k, v] of Object.entries(q)) {
      if (k === '$and') { if (!v.every((s) => match(doc, s))) return false; continue; }
      if (k === '$or') { if (!v.some((s) => match(doc, s))) return false; continue; }
      if (k === '$nor') { if (v.some((s) => match(doc, s))) return false; continue; }
      const fv = getPath(doc, k);
      if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).some((x) => x.startsWith('$'))) {
        for (const [op, arg] of Object.entries(v)) {
          if (op === '$not') { if (match({ x: fv }, { x: arg })) return false; continue; }
          if (op === '$options') continue;
          if (op === '$regex') { if (!cmpVal(fv, '$regex', { $regex: arg, $options: v.$options })) return false; continue; }
          if (!cmpVal(fv, op, arg)) return false;
        }
      } else if (!cmpVal(fv, '$eq', v)) return false;
    }
    return true;
  }
  function applyUpdate(doc, data, merge) {
    const d = clone(doc);
    const ops = Object.keys(data || {}).filter((k) => k.startsWith('$'));
    if (!ops.length) {
      if (!merge) { const keep = { _id: d._id, _openid: d._openid }; return Object.assign(keep, clone(data)); }
      for (const [k, v] of Object.entries(data)) setPath(d, k, clone(v));
      return d;
    }
    for (const op of ops) for (const [k, v] of Object.entries(data[op])) {
      const cur = getPath(d, k);
      switch (op) {
        case '$set': setPath(d, k, clone(v)); break;
        case '$unset': case '$remove': unsetPath(d, k); break;
        case '$inc': setPath(d, k, (Number(cur) || 0) + v); break;
        case '$mul': setPath(d, k, (Number(cur) || 0) * v); break;
        case '$min': setPath(d, k, cur == null ? v : Math.min(cur, v)); break;
        case '$max': setPath(d, k, cur == null ? v : Math.max(cur, v)); break;
        case '$push': { const arr = Array.isArray(cur) ? cur.slice() : []; const each = v && v.$each ? v.$each : [v]; if (v && v.$position === 0) arr.unshift(...each); else arr.push(...each); setPath(d, k, arr); break; }
        case '$addToSet': { const arr = Array.isArray(cur) ? cur.slice() : []; const each = v && v.$each ? v.$each : [v]; for (const x of each) if (!arr.some((y) => eq(x, y))) arr.push(x); setPath(d, k, arr); break; }
        case '$pull': { const arr = Array.isArray(cur) ? cur : []; setPath(d, k, arr.filter((x) => !(v && typeof v === 'object' && !Array.isArray(v) ? match(x, v) : eq(x, v)))); break; }
        case '$pullAll': { const arr = Array.isArray(cur) ? cur : []; setPath(d, k, arr.filter((x) => !v.some((y) => eq(x, y)))); break; }
        case '$pop': { const arr = Array.isArray(cur) ? cur.slice() : []; if (v === 1) arr.pop(); else arr.shift(); setPath(d, k, arr); break; }
        default: throw new Error('emulator: unsupported update op ' + op);
      }
    }
    return d;
  }
  const dbErr = (req, code, message) => json(req, 200, { code, message, requestId: rid() });
  function sortDocs(arr, order) {
    if (!order || !order.length) return arr;
    return arr.sort((a, b) => { for (const o of order) { const x = getPath(a, o.field), y = getPath(b, o.field); if (x === y) continue; const r = (x == null ? -Infinity : x) < (y == null ? -Infinity : y) ? -1 : 1; return o.direction === 'desc' ? -r : r; } return 0; });
  }

  function handleDb(req, body) {
    const action = body.action;
    // Auth for every non-whitelisted action: access_token in BODY (xt.request, offset ~109200)
    const tok = access.get(body.access_token);
    if (!body.access_token || !tok) return dbErr(req, 'INVALID_ACCESS_TOKEN', 'access token invalid or missing');
    if (tok.exp < now()) return dbErr(req, 'ACCESS_TOKEN_EXPIRED', 'access_token expired');
    const uid = tok.uid;
    const c = col(body.collectionName);
    if (!c) return dbErr(req, 'DATABASE_COLLECTION_NOT_EXIST', `[ResourceNotFound] Db or Table not exist. Please check your request, but if the problem cannot be solved, contact us.: ${body.collectionName}`);
    const acl = c.acl;
    const canRead = acl !== ACL.ADMINONLY;
    const canWriteOwn = acl === ACL.READONLY || acl === ACL.PRIVATE || acl === ACL.PUBLIC_TEST_ONLY;
    const owns = (d) => acl === ACL.PUBLIC_TEST_ONLY || d._openid === uid;
    const readFilter = (d) => acl !== ACL.PRIVATE || d._openid === uid;
    const t = now();
    const docsVisible = () => [...c.docs.values()].map((v) => visible(v, t)).filter(Boolean);
    const docsPrimary = () => [...c.docs.entries()].map(([id, v]) => [id, latest(v)]).filter(([, d]) => d);
    let query = body.query;
    if (typeof query === 'string') { try { query = JSON.parse(query); } catch { /* keep */ } }
    let data = body.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { /* keep */ } }

    switch (action) {
      case 'database.addDocument': {
        if (!canWriteOwn) return dbErr(req, 'DATABASE_PERMISSION_DENIED', 'Permission denied');
        const list = Array.isArray(data) ? data : [data];
        const ids = [];
        for (const raw of list) {
          const d = clone(raw);
          d._id = (Array.isArray(data) ? d._id : (body._id || d._id)) || crypto.randomBytes(16).toString('hex');
          if (c.docs.has(d._id) && latest(c.docs.get(d._id))) return dbErr(req, 'DATABASE_DUPLICATE_WRITE', 'E11000 duplicate key error: _id');
          d._openid = uid;  // server stamps creator
          c.docs.set(d._id, (c.docs.get(d._id) || []).concat([{ at: t, doc: d }]));
          ids.push(d._id);
        }
        return json(req, 200, Array.isArray(data) ? { data: { insertedIds: ids }, requestId: rid() } : { data: { _id: ids[0] }, requestId: rid() });
      }
      case 'database.queryDocument': {
        if (!canRead) return dbErr(req, 'DATABASE_PERMISSION_DENIED', 'Permission denied');
        let rows = docsVisible().filter(readFilter).filter((d) => match(d, query));
        rows = sortDocs(rows, body.order);
        const offset = body.offset || 0, limit = body.limit || 100;
        let out = rows.slice(offset, offset + limit);
        if (body.projection && Object.keys(body.projection).length) {
          const inc = Object.entries(body.projection).filter(([, v]) => v).map(([k]) => k);
          const exc = Object.entries(body.projection).filter(([, v]) => !v).map(([k]) => k);
          out = out.map((d) => { if (inc.length) { const o = { _id: d._id }; for (const k of inc) if (getPath(d, k) !== undefined) setPath(o, k, clone(getPath(d, k))); return o; } const o = clone(d); for (const k of exc) unsetPath(o, k); return o; });
        }
        return json(req, 200, { data: { list: clone(out), limit, offset }, requestId: rid() });
      }
      case 'database.countDocument': {
        if (!canRead) return dbErr(req, 'DATABASE_PERMISSION_DENIED', 'Permission denied');
        return json(req, 200, { data: { total: docsVisible().filter(readFilter).filter((d) => match(d, query)).length }, requestId: rid() });
      }
      case 'database.updateDocument': {
        if (!canWriteOwn) return dbErr(req, 'DATABASE_PERMISSION_DENIED', 'Permission denied');
        // writes evaluate against PRIMARY (latest) state — this is what makes conditional updates atomic
        const all = docsPrimary().filter(([, d]) => match(d, query));
        const own = all.filter(([, d]) => owns(d));
        if (knobs.permissionMode === 'rules' && own.length < all.length) return dbErr(req, 'DATABASE_PERMISSION_DENIED', 'Permission denied');
        const targets = body.multi ? own : own.slice(0, 1);
        let updated = 0;
        for (const [id, d] of targets) {
          const nd = applyUpdate(d, data, body.merge !== false);
          if (!eq(nd, d)) updated++;
          c.docs.get(id).push({ at: t, doc: nd });
        }
        let upserted_id;
        if (!all.length && body.upsert && query && query._id) {   // doc(id).set()
          const nd = Object.assign(clone(data) || {}, { _id: query._id, _openid: uid });
          c.docs.set(query._id, (c.docs.get(query._id) || []).concat([{ at: t, doc: nd }]));
          upserted_id = query._id;
        }
        return json(req, 200, { data: upserted_id ? { updated, upserted_id } : { updated }, requestId: rid() });
      }
      case 'database.deleteDocument': {
        if (!canWriteOwn) return dbErr(req, 'DATABASE_PERMISSION_DENIED', 'Permission denied');
        const all = docsPrimary().filter(([, d]) => match(d, query));
        const own = all.filter(([, d]) => owns(d));
        if (knobs.permissionMode === 'rules' && own.length < all.length) return dbErr(req, 'DATABASE_PERMISSION_DENIED', 'Permission denied');
        const targets = body.multi ? own : own.slice(0, 1);
        for (const [id] of targets) c.docs.get(id).push({ at: t, doc: null });
        return json(req, 200, { data: { deleted: targets.length }, requestId: rid() });
      }
      default:
        return dbErr(req, 'INVALID_ACTION', 'emulator: unsupported action ' + action);
    }
  }

  // ───────────────────────── entry
  function handle(req) {
    // req: {method, url, headers(lower-case), body(string|null)}
    const u = new URL(req.url);
    let body = {};
    if (req.body) { try { body = JSON.parse(req.body); } catch { body = { _raw: req.body }; } }
    const entry = { t: now(), method: req.method, host: u.host, path: u.pathname, search: u.search, headers: req.headers, body };
    log.push(entry);
    if (req.method === 'OPTIONS') return { status: 204, headers: cors(req), body: '' };
    for (const f of faults) if (f.times > 0 && f.match(req, body)) { f.times--; const r = f.respond(req, body); entry.res = r; return r; }
    let res;
    const authHost = `${env}.${region}.tcb-api.tencentcloudapi.com`;
    if (u.host === authHost && u.pathname.startsWith('/auth/')) res = handleAuth(req, u.pathname.slice(5), body);
    else if (u.host === authHost && u.pathname === '/web') res = handleDb(req, body);
    else res = json(req, 501, { code: 'EMULATOR_NOT_IMPLEMENTED', message: `${req.method} ${u.host}${u.pathname}` });
    entry.res = { status: res.status, body: res.body.slice(0, 2000) };
    return res;
  }

  function delay(req) {
    const base = typeof knobs.latencyMs === 'function' ? knobs.latencyMs(req) : knobs.latencyMs;
    return Math.max(0, base + (knobs.jitterMs ? Math.random() * knobs.jitterMs : 0));
  }

  // Playwright glue: await emu.attach(context)
  async function attach(context, { hostPattern = /(tencentcloudapi\.com|tcloudbase\.com|tcloudbasegateway\.com|tcloudbaseapp\.com|myqcloud\.com|qcloud\.com|cloudbase\.net)/ } = {}) {
    await context.route((url) => hostPattern.test(new URL(url).host), async (route) => {
      const r = route.request();
      const req = { method: r.method(), url: r.url(), headers: await r.allHeaders(), body: r.postData() };
      const ms = delay(req);
      if (ms) await new Promise((res) => setTimeout(res, ms));
      const res = handle(req);
      await route.fulfill({ status: res.status, headers: res.headers, body: res.body });
    });
  }

  return {
    env, knobs, handle, attach, log, faults,
    users, cols,
    // test seeding helpers
    seedUser: (o) => createUser(o),
    setAcl: (name, acl) => { const c = cols.get(name) || { docs: new Map() }; c.acl = acl; cols.set(name, c); },
    dump: (name) => { const c = cols.get(name); return c ? [...c.docs.values()].map(latest).filter(Boolean) : null; },
    expireAllAccessTokens: () => { for (const v of access.values()) v.exp = 0; },
    injectFault: (match, respond, times = 1) => faults.push({ match, respond, times }),
  };
}
