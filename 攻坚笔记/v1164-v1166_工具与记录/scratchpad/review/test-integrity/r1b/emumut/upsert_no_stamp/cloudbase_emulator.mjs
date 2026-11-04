/* cloudbase_emulator.mjs —— 本地模拟腾讯云开发（CloudBase）服务端，给真 SDK 端到端测试用
 *
 * 为什么要有它（v1164）：
 *   天梯在真机上从来没成功过一次，而 180 个测试全绿 —— 因为测试把云端整段换成了假传输层，
 *   假的什么都让写（客人改房主的文档、两个人 add 同一个 _id 都成功）。
 *   这里反过来：**页面、账号模块、房间模块、vendor SDK 全是真的，只有网络由本文件应答**，
 *   并且照真数据库的规矩办事：谁建的文档只有谁能改、_id 唯一、读有主从延迟、令牌会轮换。
 *
 * 线上协议出处：SDK 2.30.0（vendor_cloudbase_esm_v965.js）源码 + 本地 Chromium 抓包。
 *   数据库：POST https://<env>.<region>.tcb-api.tencentcloudapi.com/web?env=<env>
 *           body {action:'database.*', collectionName, query, data, access_token, ...}
 *           业务错误 = HTTP 200 + {code, message}（SDK resolve 它，不 reject）
 *           HTTP 非 200 / 空 body → SDK reject 'network request error'
 *   登录：  https://<env>.<region>.tcb-api.tencentcloudapi.com/auth/v1/...（fetch，JSON）
 *
 * 重复 _id 的 add 回什么（真机没人见过原文，这里是推断，**所以 App 不许只信这个结果**）：
 *   默认 duplicateStyle:'request_failed' →
 *     {code:'DATABASE_REQUEST_FAILED', message:'[FailedOperation] multiple write errors: ... E11000 duplicate key error ...'}
 *   理由：① SDK 里唯一的通用数据库错误码就是 DATABASE_REQUEST_FAILED；
 *        ② 社区报的真实文本是 MongoDB 的 E11000 包在 [FailedOperation] 里；
 *        ③ 码名里没有 "DUPLICATE" —— 逼着 App 按 _id 读回来判断「是不是我的」，而不是猜报错文本。
 *   另有 'duplicate_write'（码 DATABASE_DUPLICATE_WRITE）和 'http500'（SDK 只会看到 network request error）
 *   两种，测试可以换着跑，App 必须三种都对。
 *
 * 不是仓库运行时文件：.mjs 不进部署包（package_release.py 白名单），也不叫 test_*（不会被当成测试跑）。
 */
import crypto from 'node:crypto';

const b64u = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const rid = () => crypto.randomBytes(8).toString('hex');
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 集合权限（对应控制台「基础权限」四档 + 两个测试用的状态）
 *   READONLY   「读取全部数据，修改本人数据」—— 对战房间/好友用的就是这一档
 *   PRIVATE    「读取和修改本人数据」
 *   ADMINWRITE 「读取全部数据，不可修改数据」
 *   ADMINONLY  「无权限」（客户端什么都不能做）
 *   PUBLIC_TEST_ONLY 谁都能改谁的 —— 真云端没有这一档，只当反例用 */
export const ACL = { READONLY: 'READONLY', PRIVATE: 'PRIVATE', ADMINWRITE: 'ADMINWRITE', ADMINONLY: 'ADMINONLY', PUBLIC_TEST_ONLY: 'PUBLIC_TEST_ONLY' };

/* 越权写怎么回：
 *   legacy 老的「基础权限」：服务端悄悄把 {_openid: 调用者} 并进写条件 → {updated:0}/{deleted:0}，不报错
 *   rules  安全规则：直接回 {code:'DATABASE_PERMISSION_DENIED'}；where().update/remove 的条件里
 *          没带 _openid==自己 也一律拒（规则要求查询条件是规则的子集） */
export const MODES = ['legacy', 'rules'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createEmulator(opts = {}) {
  const env = opts.env || 'ambitious-d0g1d26xm740dc3d6';
  const region = opts.region || 'ap-shanghai';
  const knobs = Object.assign({
    latencyMs: 0,              // 数字或 (req)=>数字：每个请求在路上花的时间
    jitterMs: 0,               // 额外随机延迟（用固定种子，跑两次一样）
    seed: 1164,
    consistencyLagMs: 0,       // 读（get/where/count）只看得到这么多毫秒以前的写；写永远落在最新状态上
    permissionMode: 'legacy',  // 默认的越权写回法；单个集合可以覆盖
    legacyMulti: 'own',        // legacy 下 where().update/remove：'own' 只动自己的 | 'deny' 整个拒
    duplicateStyle: 'request_failed',   // 'request_failed' | 'duplicate_write' | 'http500'
    accessTokenTtlSec: 7200,   // SDK 把 expires_at 记成 now + (ttl-30) 秒，过了就去刷新
    verificationCode: '123456',
    refreshTokenRotation: true,// refresh_token 只能用一次（真云端：invalid_grant "...may be has been refreshed by"）
    omitExpiresIn: false,      // 模拟「登录响应缺 expires_in」：SDK 会删凭证却照样 resolve
    anonymousEnabled: false,   // 真环境匿名登录没开（hansen_cloud_save_v965.js 的「匿名登录未开通」）
  }, opts.knobs || {});
  const rnd = mulberry32(knobs.seed || 1);

  const users = new Map();     // uid → user
  const byLogin = new Map();   // 用户名/手机号/邮箱 → uid
  const access = new Map();    // access_token → {uid, exp}
  const refresh = new Map();   // refresh_token → {uid, used}
  const verifs = new Map();
  const vtokens = new Map();
  const cols = new Map();      // 集合名 → {acl, mode, docs: Map(id → [{at, doc|null}])}
  const log = [];              // 每个请求
  const writes = [];           // 成功落库的写
  const foreign = [];          // 想改别人文档的写（不管成没成）—— 新协议下必须一条都没有
  const faults = [];
  const holds = [];
  let offline = false;

  for (const [name, spec] of Object.entries(opts.collections || {})) setCollection(name, spec);

  function setCollection(name, spec) {
    const s = typeof spec === 'string' ? { acl: spec } : Object.assign({}, spec || {});
    const c = cols.get(name) || { docs: new Map() };
    c.acl = s.acl || ACL.READONLY;
    c.mode = s.mode || null;
    cols.set(name, c);
    return c;
  }

  // ─── 小工具 ─────────────────────────────────────────────
  const nowMs = () => Date.now();
  function cors(req, extra = {}) {
    const origin = req.headers.origin || '*';
    return Object.assign({
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': req.headers['access-control-request-headers'] || '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-expose-headers': 'x-request-id',
      'vary': 'Origin',
    }, extra);
  }
  const json = (req, status, body) => ({ status, headers: cors(req, { 'content-type': 'application/json; charset=utf-8', 'x-request-id': req.headers['x-request-id'] || rid() }), body: JSON.stringify(body) });
  const authErr = (req, status, error, error_code, error_description) => json(req, status, { error, error_code, error_description });
  const dbErr = (req, code, message) => json(req, 200, { code, message, requestId: rid() });

  function newUid() { let s = '1'; for (let i = 0; i < 18; i++) s += Math.floor(rnd() * 10); return users.has(s) ? newUid() : s; }
  function mkJwt(uid, exp) {
    const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'emu' }));
    const p = b64u(JSON.stringify({ iss: `https://${env}.${region}.tcb-api.tencentcloudapi.com`, sub: uid, aud: env, exp: Math.floor(exp / 1000), iat: Math.floor(nowMs() / 1000), scope: 'user', project_id: env, user_type: '', client_type: 'client_user', is_system_admin: false }));
    return `${h}.${p}.${b64u(crypto.randomBytes(32))}`;
  }
  function issueTokens(uid) {
    const exp = nowMs() + knobs.accessTokenTtlSec * 1000;
    const at = mkJwt(uid, exp);
    const rt = b64u(crypto.randomBytes(24));
    access.set(at, { uid, exp });
    refresh.set(rt, { uid, used: false });
    const t = { token_type: 'Bearer', access_token: at, refresh_token: rt, expires_in: knobs.accessTokenTtlSec, scope: 'user', sub: uid, groups: ['user'] };
    if (knobs.omitExpiresIn) delete t.expires_in;
    return t;
  }
  function bearerUid(req) {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    if (!m) return { err: 'missing' };
    const t = access.get(m[1]);
    if (!t) return { err: 'invalid' };
    if (t.exp < nowMs()) return { err: 'expired' };
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

  // ─── 登录（/auth/v1/*） ─────────────────────────────────
  function handleAuth(req, path, body) {
    if (path === '/v1/verification' && req.method === 'POST') {
      const target = body.phone_number || body.email;
      if (!target) return authErr(req, 400, 'invalid_argument', 3, 'phone_number or email required');
      const id = 'v_' + rid();
      verifs.set(id, { target, code: knobs.verificationCode, used: false, exp: nowMs() + 600e3 });
      return json(req, 200, { verification_id: id, expires_in: 600, is_user: byLogin.has(target) });
    }
    if (path === '/v1/verification/verify' && req.method === 'POST') {
      const v = verifs.get(body.verification_id);
      if (!v || v.used || v.exp < nowMs() || String(body.verification_code) !== v.code)
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
      if (body.params && body.public_key_thumbprint) return authErr(req, 400, 'invalid_argument', 3, 'emulator: encrypted signin not supported');
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
      const u = createUser({}); u.created_from = 'anonymous';
      const t = issueTokens(u.uid); t.scope = 'anonymous';
      return json(req, 200, t);
    }
    if (path === '/v1/token' && req.method === 'POST') {
      if (body.grant_type !== 'refresh_token') return authErr(req, 400, 'unsupported_grant_type', 3, 'unsupported grant_type');
      const r = refresh.get(body.refresh_token);
      if (!r || r.revoked || (knobs.refreshTokenRotation && r.used))
        return authErr(req, 400, 'invalid_grant', 3, 'invalid refresh token. for it may be has been refreshed by (emulated)');
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
      if (body.name) u.name = body.name;
      return json(req, 200, userMe(u));
    }
    if ((path === '/v1/revoke' || path === '/v1/user/signout') && req.method === 'POST') {
      if (body.token) access.delete(body.token);
      return json(req, 200, {});
    }
    return authErr(req, 404, 'not_found', 5, `emulator: no auth route ${req.method} ${path}`);
  }

  // ─── 数据库（/web，action=database.*） ──────────────────
  const latest = (vers) => vers[vers.length - 1].doc;
  function visible(vers, t) {
    const lag = typeof knobs.consistencyLagMs === 'function' ? knobs.consistencyLagMs() : knobs.consistencyLagMs;
    const cutoff = t - (lag || 0);
    for (let i = vers.length - 1; i >= 0; i--) if (vers[i].at <= cutoff) return vers[i].doc;
    return null;
  }
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  function setPath(o, p, v) { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null || typeof a[ks[i]] !== 'object') a[ks[i]] = {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; }
  function unsetPath(o, p) { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) a = a && a[ks[i]]; if (a) delete a[ks[ks.length - 1]]; }
  /* SDK 把 Date 写成 {$date: 毫秒}、serverDate() 写成 {$date:{offset}} —— 服务端当场换成真时间 */
  function serverize(v, t) {
    if (Array.isArray(v)) return v.map((x) => serverize(x, t));
    if (v && typeof v === 'object') {
      if (v.$date && typeof v.$date === 'object' && 'offset' in v.$date) return { $date: t + (Number(v.$date.offset) || 0) };
      const o = {}; for (const [k, x] of Object.entries(v)) o[k] = serverize(x, t); return o;
    }
    return v;
  }
  const norm = (v) => (v && typeof v === 'object' && !Array.isArray(v) && typeof v.$date === 'number') ? v.$date : v;
  const eq = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
  function cmpVal(fieldVal, op, arg) {
    const vals = Array.isArray(fieldVal) && op !== '$size' ? [fieldVal, ...fieldVal] : [fieldVal];
    const a = norm(arg);
    const any = (f) => vals.some((v) => f(norm(v)));
    switch (op) {
      case '$eq': return any((v) => eq(v, a));
      case '$ne': case '$neq': return !any((v) => eq(v, a));
      case '$gt': return any((v) => v != null && v > a);
      case '$gte': return any((v) => v != null && v >= a);
      case '$lt': return any((v) => v != null && v < a);
      case '$lte': return any((v) => v != null && v <= a);
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
      if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).some((x) => x.startsWith('$')) && typeof v.$date !== 'number') {
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
  /* 查询条件里有没有锁定「只碰自己的」（安全规则要求查询条件是规则的子集） */
  function queryPinsOwner(q, uid) {
    if (!q || typeof q !== 'object') return false;
    if (q._openid === uid || (q._openid && q._openid.$eq === uid)) return true;
    if (Array.isArray(q.$and)) return q.$and.some((s) => queryPinsOwner(s, uid));
    return false;
  }
  function applyUpdate(doc, data, merge) {
    const d = clone(doc);
    const ops = Object.keys(data || {}).filter((k) => k.startsWith('$'));
    if (!ops.length) {
      if (!merge) { const keep = { _id: d._id, _openid: d._openid }; return Object.assign(clone(data), keep); }
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
  function sortDocs(arr, order) {
    if (!order || !order.length) return arr;
    return arr.sort((a, b) => {
      for (const o of order) {
        const x = norm(getPath(a, o.field)), y = norm(getPath(b, o.field));
        if (x === y) continue;
        const r = (x == null ? -Infinity : x) < (y == null ? -Infinity : y) ? -1 : 1;
        return o.direction === 'desc' ? -r : r;
      }
      return 0;
    });
  }
  function duplicateRes(req, colName, id) {
    if (knobs.duplicateStyle === 'duplicate_write')
      return dbErr(req, 'DATABASE_DUPLICATE_WRITE', `duplicate key: _id ${id}`);
    if (knobs.duplicateStyle === 'http500')
      return { status: 500, headers: cors(req, { 'content-type': 'text/plain' }), body: 'E11000 duplicate key error' };
    return dbErr(req, 'DATABASE_REQUEST_FAILED',
      `[FailedOperation] multiple write errors: [{write errors: [{E11000 duplicate key error collection: ${env}.${colName} index: _id_ dup key: { _id: "${id}" }}]}, {<nil>}]; `);
  }

  function handleDb(req, body, ctx) {
    const action = body.action;
    const tok = access.get(body.access_token);
    if (!body.access_token || !tok) return dbErr(req, 'INVALID_ACCESS_TOKEN', 'access token invalid or missing');
    if (tok.exp < nowMs()) return dbErr(req, 'ACCESS_TOKEN_EXPIRED', 'access_token expired');
    const uid = tok.uid;
    const colName = body.collectionName;
    const c = cols.get(colName);
    if (!c) return dbErr(req, 'DATABASE_COLLECTION_NOT_EXIST', `[ResourceNotFound] Db or Table not exist. Please check your request, but if the problem cannot be solved, contact us.: ${colName}`);
    const acl = c.acl;
    const mode = c.mode || knobs.permissionMode;
    const canRead = acl !== ACL.ADMINONLY;
    const canWriteOwn = acl === ACL.READONLY || acl === ACL.PRIVATE || acl === ACL.PUBLIC_TEST_ONLY;
    const owns = (d) => acl === ACL.PUBLIC_TEST_ONLY || d._openid === uid;
    const t = nowMs();
    let query = body.query; if (typeof query === 'string') { try { query = JSON.parse(query); } catch (e) { /* 原样 */ } }
    let data = body.data; if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { /* 原样 */ } }
    data = serverize(data, t);
    query = serverize(query, t);
    const readFilter = (d) => acl !== ACL.PRIVATE || d._openid === uid;
    const docsVisible = () => [...c.docs.values()].map((v) => visible(v, t)).filter(Boolean);
    const docsPrimary = () => [...c.docs.entries()].map(([id, v]) => [id, latest(v)]).filter(([, d]) => d);
    const denied = () => dbErr(req, 'DATABASE_PERMISSION_DENIED', 'Permission denied');

    switch (action) {
      case 'database.addDocument': {
        if (!canWriteOwn) return denied();
        const list = Array.isArray(data) ? data : [data];
        const ids = [];
        for (const raw of list) {
          const d = clone(raw) || {};
          d._id = (Array.isArray(data) ? d._id : (body._id || d._id)) || crypto.randomBytes(16).toString('hex');
          if (c.docs.has(d._id) && latest(c.docs.get(d._id))) { ctx.dup = d._id; return duplicateRes(req, colName, d._id); }
          d._openid = uid;   // 服务端盖创建者章，客户端伪造不了
          c.docs.set(d._id, (c.docs.get(d._id) || []).concat([{ at: t, doc: d }]));
          writes.push({ t, uid, op: 'add', collection: colName, id: d._id });
          ids.push(d._id);
        }
        ctx.docId = ids[0];
        return json(req, 200, Array.isArray(data) ? { data: { insertedIds: ids }, requestId: rid() } : { data: { _id: ids[0] }, requestId: rid() });
      }
      case 'database.queryDocument': {
        if (!canRead) return denied();
        if (acl === ACL.PRIVATE && mode === 'rules' && !queryPinsOwner(query, uid)) return denied();
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
        if (!canRead) return denied();
        return json(req, 200, { data: { total: docsVisible().filter(readFilter).filter((d) => match(d, query)).length }, requestId: rid() });
      }
      case 'database.updateDocument':
      case 'database.deleteDocument': {
        const isDel = action === 'database.deleteDocument';
        if (!canWriteOwn) return denied();
        const multi = !!body.multi;
        const all = docsPrimary().filter(([, d]) => match(d, query));
        const own = all.filter(([, d]) => owns(d));
        const theirs = all.filter(([, d]) => !owns(d));
        if (theirs.length) foreign.push({ t, uid, action, collection: colName, multi, mode, ids: theirs.map(([id]) => id), owners: theirs.map(([, d]) => d._openid), query: clone(query), data: clone(data) });
        if (mode === 'rules') {
          if (theirs.length) return denied();
          if (multi && acl !== ACL.PUBLIC_TEST_ONLY && !queryPinsOwner(query, uid)) return denied();
        } else if (multi && knobs.legacyMulti === 'deny' && acl !== ACL.PUBLIC_TEST_ONLY) return denied();
        const targets = multi ? own : own.slice(0, 1);
        if (isDel) {
          for (const [id] of targets) { c.docs.get(id).push({ at: t, doc: null }); writes.push({ t, uid, op: 'remove', collection: colName, id }); }
          ctx.docId = targets[0] && targets[0][0];
          return json(req, 200, { data: { deleted: targets.length }, requestId: rid() });
        }
        let updated = 0;
        for (const [id, d] of targets) {
          const nd = applyUpdate(d, data, body.merge !== false);
          if (!eq(nd, d)) updated++;
          c.docs.get(id).push({ at: t, doc: nd });
          writes.push({ t, uid, op: body.merge === false ? 'set' : 'update', collection: colName, id });
        }
        let upserted_id;
        if (!all.length && body.upsert && query && query._id) {   // doc(id).set() 建新文档
          const nd = Object.assign(clone(data) || {}, { _id: query._id });
          c.docs.set(query._id, (c.docs.get(query._id) || []).concat([{ at: t, doc: nd }]));
          writes.push({ t, uid, op: 'upsert', collection: colName, id: query._id });
          upserted_id = query._id;
        }
        ctx.docId = (targets[0] && targets[0][0]) || upserted_id;
        return json(req, 200, { data: upserted_id ? { updated, upserted_id } : { updated }, requestId: rid() });
      }
      default:
        return dbErr(req, 'INVALID_ACTION', 'emulator: unsupported action ' + action);
    }
  }

  // ─── 请求入口 ──────────────────────────────────────────
  const authHost = `${env}.${region}.tcb-api.tencentcloudapi.com`;
  function describe(req, body) {
    const u = new URL(req.url);
    const ctx = { host: u.host, path: u.pathname, method: req.method, action: body.action || '', collection: body.collectionName || '', uid: '' };
    if (body.access_token && access.get(body.access_token)) ctx.uid = access.get(body.access_token).uid;
    const b = bearerUid(req); if (b.uid) ctx.uid = b.uid;
    if (body.refresh_token && refresh.get(body.refresh_token)) ctx.uid = refresh.get(body.refresh_token).uid;
    if (!ctx.uid && body.username && byLogin.get(body.username)) ctx.uid = byLogin.get(body.username);
    return ctx;
  }
  function faultMatches(f, ctx) {
    if (f.uid && f.uid !== ctx.uid) return false;
    if (f.action && f.action !== ctx.action) return false;
    if (f.collection && f.collection !== ctx.collection) return false;
    if (f.db === true && ctx.path !== '/web') return false;
    if (f.auth === true && !ctx.path.startsWith('/auth/')) return false;
    if (f.path && !(f.path instanceof RegExp ? f.path.test(ctx.path) : ctx.path === f.path)) return false;
    if (f.test && !f.test(ctx)) return false;
    return true;
  }
  function route(req, body, ctx) {
    const u = new URL(req.url);
    if (u.host === authHost && u.pathname.startsWith('/auth/')) return handleAuth(req, u.pathname.slice(5), body);
    if (u.host === authHost && u.pathname === '/web') return handleDb(req, body, ctx);
    return json(req, 501, { code: 'EMULATOR_NOT_IMPLEMENTED', message: `${req.method} ${u.host}${u.pathname}` });
  }
  function finish(entry, res) {
    entry.status = res.status;
    const m = /"code":"([A-Z_]+)"/.exec(res.body || '') || /"error":"([a-z_]+)"/.exec(res.body || '');
    if (m) entry.code = m[1];
    entry.ms = nowMs() - entry.t;
    return res;
  }

  /* 处理一个请求，返回「怎么回」：{respond:res} | {abort:'failed'|'timedout'|...} */
  async function process(req) {
    let body = {};
    if (req.body) { try { body = JSON.parse(req.body); } catch (e) { body = { _raw: req.body }; } }
    const ctx = describe(req, body);
    const entry = Object.assign({ t: nowMs() }, ctx, { docId: (body.query && body.query._id) || (body.data && body.data._id) || '' });
    log.push(entry);
    if (req.method === 'OPTIONS') return { respond: { status: 204, headers: cors(req), body: '' } };
    if (offline) { entry.fault = 'offline'; return { abort: 'internetdisconnected' }; }
    for (const h of holds) if (h.active && faultMatches(h, ctx)) {
      entry.fault = 'hold';
      await new Promise((r) => h.waiters.push(r));
      if (h.abortOnRelease) return { abort: 'timedout' };
    }
    const f = faults.find((x) => x.times > 0 && faultMatches(x, ctx));
    let commitThenAbort = false;
    if (f) {
      f.times--; f.hits++; entry.fault = f.do;
      switch (f.do) {
        case 'abort': return { abort: f.reason || 'failed' };
        case 'http500': return { respond: finish(entry, { status: f.status || 500, headers: cors(req, { 'content-type': 'text/plain' }), body: 'Internal Server Error' }) };
        case 'emptyBody': return { respond: finish(entry, { status: 200, headers: cors(req), body: '' }) };
        case 'code': return { respond: finish(entry, dbErr(req, f.code || 'DATABASE_REQUEST_FAILED', f.message || 'emulated error')) };
        case 'hang': await sleep(f.ms || 20000); return { abort: 'timedout' };
        case 'delay': await sleep(f.ms || 1000); break;
        case 'commitThenAbort': commitThenAbort = true; break;
        default: throw new Error('emulator: unknown fault ' + f.do);
      }
    }
    const res = finish(entry, route(req, body, entry));
    if (commitThenAbort) return { abort: 'connectionreset' };
    return { respond: res };
  }

  function delay(req) {
    const base = typeof knobs.latencyMs === 'function' ? knobs.latencyMs(req) : knobs.latencyMs;
    return Math.max(0, (base || 0) + (knobs.jitterMs ? rnd() * knobs.jitterMs : 0));
  }

  const HOSTS = /(tencentcloudapi\.com|tcloudbase\.com|tcloudbasegateway\.com|tcloudbaseapp\.com|myqcloud\.com|qcloud\.com|cloudbase\.net)$/;
  /* Playwright：await emu.attach(context) —— 必须挂在 context 上（iframe、弹窗也走这里） */
  async function attach(context) {
    await context.route((url) => HOSTS.test(new URL(url).hostname), async (r) => {
      /* 页面随时可能被关掉（测试里「手机没电」）：这里任何一步抛错都不能把测试进程带崩 */
      let req;
      try {
        const q = r.request();
        req = { method: q.method(), url: q.url(), headers: await q.allHeaders(), body: q.postData() };
      } catch (e) { return; }
      const ms = delay(req);
      if (ms) await sleep(ms);
      let plan;
      try { plan = await process(req); } catch (e) { plan = { respond: { status: 500, headers: {}, body: 'emulator crash: ' + e.message } }; console.log('  [模拟云端] 内部错误', e); }
      try {
        if (plan.abort) await r.abort(plan.abort);
        else await r.fulfill({ status: plan.respond.status, headers: plan.respond.headers, body: plan.respond.body });
      } catch (e) { /* 页面已经关了：写已经落库，回包送不到 —— 和真机关 App 一样 */ }
    });
  }

  function dump(name) {
    const c = cols.get(name);
    return c ? [...c.docs.values()].map(latest).filter(Boolean).map(clone) : null;
  }

  return {
    env, region, knobs, users, cols, log, writes, foreign,
    attach, process, dump,
    snapshot: () => Object.fromEntries([...cols.keys()].map((k) => [k, dump(k)])),
    setCollection,
    dropCollection: (name) => cols.delete(name),
    seedUser: (o) => createUser(o || {}),
    /* 直接在「服务端」放一条文档（比如某人上次没收干净的旧房间）；_openid = 它的创建者 */
    seedDoc: (collection, doc, ownerUid, ageMs = 0) => {
      const c = cols.get(collection);
      if (!c) throw new Error('emulator: no collection ' + collection);
      const d = Object.assign(clone(doc), { _openid: ownerUid });
      c.docs.set(d._id, (c.docs.get(d._id) || []).concat([{ at: nowMs() - ageMs, doc: d }]));
      return d;
    },
    uidOfLogin: (login) => byLogin.get(login) || '',
    setOffline: (v) => { offline = !!v; },
    isOffline: () => offline,
    /* 故障注入：{uid?, db?, auth?, path?, action?, collection?, test?, do, times?, ms?, code?, message?} */
    fault: (spec) => { const f = Object.assign({ times: Infinity, hits: 0 }, spec); faults.push(f); return { f, remove: () => { const i = faults.indexOf(f); if (i >= 0) faults.splice(i, 1); }, get hits() { return f.hits; } }; },
    clearFaults: () => { faults.length = 0; },
    /* 扣住匹配的请求（手机卡住）；release() 后按原样处理（abortOnRelease 则回超时） */
    hold: (spec) => {
      const h = Object.assign({ active: true, waiters: [], abortOnRelease: false }, spec);
      holds.push(h);
      return { release: () => { h.active = false; const w = h.waiters.splice(0); w.forEach((f) => f()); const i = holds.indexOf(h); if (i >= 0) holds.splice(i, 1); return w.length; }, get pending() { return h.waiters.length; } };
    },
    /* 会话过期：这个人的 access_token 立刻作废、refresh_token 再也换不到新的 */
    revokeSessions: (uid) => {
      for (const v of access.values()) if (!uid || v.uid === uid) v.exp = 0;
      for (const v of refresh.values()) if (!uid || v.uid === uid) v.revoked = true;
    },
    expireAccessTokens: (uid) => { for (const v of access.values()) if (!uid || v.uid === uid) v.exp = 0; },
  };
}
