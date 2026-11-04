/* world.mjs — discrete-event simulator for the online-battle protocol.
 *
 *  - ONE virtual clock for everything; every phone gets its own vm context with its own copy of the REAL module
 *    (hansen_pk_room_v1065.js), its own Date.now() (= virtual time + that phone's clock skew), its own
 *    setTimeout/setInterval (events on the shared queue, owned by that page instance), its own Math.random stream.
 *  - ONE fake CloudBase collection with the real permission model 「读取全部数据，修改本人数据」: _openid is stamped
 *    by the server from the writer's uid, only the creator may update/remove (legacy → updated:0, rules →
 *    {code:'DATABASE_PERMISSION_DENIED'}), _id is unique (duplicate add → resolved {code}, or a transport error, or —
 *    hypothetical — silently ignored), reads are eventually consistent (every read sees the state as of a randomly
 *    lagged instant; queries lag more), plus latency, faults, partitions, outages.
 *  - The module is driven ONLY through the fake SDK (HansenAuth._app().database()) — no test hooks — so the real
 *    realTransport (r.code checks, orderBy fallback, timeouts, retries) runs exactly as on a phone.
 *  - Microtasks are drained after every event (setImmediate), so promise chains behave like a browser task loop.
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { stream } from './prng.mjs';

export const T0 = Date.UTC(2026, 0, 5, 1, 0, 0);   /* fixed virtual epoch → deterministic */
export const SDK_TIMEOUT_MS = 15000;
const MODULE_FILE = 'hansen_pk_room_v1065.js';

/* ── binary heap ordered by (t, seq) ── */
class Heap {
  constructor() { this.a = []; }
  size() { return this.a.length; }
  lt(x, y) { return x.t < y.t || (x.t === y.t && x.seq < y.seq); }
  push(e) {
    const a = this.a; a.push(e); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (!this.lt(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; }
  }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && this.lt(a[l], a[m])) m = l;
        if (r < a.length && this.lt(a[r], a[m])) m = r;
        if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return top;
  }
}

const drain = () => new Promise(r => setImmediate(r));
const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

/* vocabulary: letter-only words + two phrases the module must skip (as in the real vocab) */
const WORDS = ('apple banana cherry grape lemon mango melon peach pear plum tiger lion zebra horse sheep goat '
  + 'mouse rabbit panda koala river ocean beach cloud storm rain snow wind green yellow purple orange '
  + 'school teacher pencil eraser ruler window table chair sofa clock bread butter cheese pizza salad '
  + 'soup juice water milk honey doctor nurse farmer pilot driver').split(' ');
export const VOCAB = {
  wordIslandFruit: WORDS.slice(0, 30).map((en, i) => ({ en, cn: '词' + i })).concat([{ en: 'ice cream', cn: '冰淇淋' }]),
  wordIslandLife: WORDS.slice(30).map((en, i) => ({ en, cn: '活' + i })).concat([{ en: 'T-shirt', cn: 'T恤' }])
};

/* ── compiled module (one compile per source text; instrumentation optional) ── */
const _scripts = new Map();
export function loadModule(repoDir, opts = {}) {
  const file = path.resolve(repoDir, MODULE_FILE);
  let src = fs.readFileSync(file, 'utf8');
  let probed = false;
  if (opts.probe) {
    /* diagnostics only: remember the JS stack of every transport call (behaviour-preserving) so a cross-owner
       write can be traced to a file:line. If the anchor is not found the probe is simply off. */
    const re = /out\[k\]\s*=\s*function\s*\(\)\s*\{/;
    if (re.test(src)) {
      src = src.replace(re, (m) => m + ' try { if (typeof __hsnProbe === "function") __hsnProbe(k, arguments); } catch (e$) {}');
      probed = true;
    }
  }
  const key = file + '|' + (probed ? 'p' : '') + '|' + src.length + '|' + src.slice(0, 64);
  let s = _scripts.get(key);
  if (!s) { s = new vm.Script(src, { filename: file }); _scripts.set(key, s); }
  return { script: s, file, probed };
}


/* ── query conditions: plain equality or the db.command operators the module uses ($in, $gt/$lt … , $and/$or).
   Comparisons only match values of the same type (MongoDB: a number never compares to a string / missing field). */
function sameT(a, b) { return a != null && b != null && typeof a === typeof b; }
function eqv(a, b) { return a === b || (a == null && b == null) || (typeof a === 'object' && a && b && JSON.stringify(a) === JSON.stringify(b)); }
function isOpObj(c) { return !!(c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length && Object.keys(c).every((k) => k[0] === '$')); }
function fieldMatch(val, c) {
  if (!isOpObj(c)) return eqv(val, c);
  for (const op of Object.keys(c)) {
    const a = c[op];
    switch (op) {
      case '$and': if (!a.every((x) => fieldMatch(val, x))) return false; break;
      case '$or': if (!a.some((x) => fieldMatch(val, x))) return false; break;
      case '$eq': if (!eqv(val, a)) return false; break;
      case '$ne': case '$neq': if (eqv(val, a)) return false; break;
      case '$in': if (!a.some((x) => eqv(val, x))) return false; break;
      case '$nin': if (a.some((x) => eqv(val, x))) return false; break;
      case '$gt': if (!(sameT(val, a) && val > a)) return false; break;
      case '$gte': if (!(sameT(val, a) && val >= a)) return false; break;
      case '$lt': if (!(sameT(val, a) && val < a)) return false; break;
      case '$lte': if (!(sameT(val, a) && val <= a)) return false; break;
      case '$exists': if ((val !== undefined) !== !!a) return false; break;
      default: throw new Error('fake db: unsupported query operator ' + op);
    }
  }
  return true;
}
export function condMatch(doc, cond) {
  for (const k of Object.keys(cond || {})) {
    if (k === '$and') { if (!cond[k].every((x) => condMatch(doc, x))) return false; continue; }
    if (k === '$or') { if (!cond[k].some((x) => condMatch(doc, x))) return false; continue; }
    if (!fieldMatch(doc[k], cond[k])) return false;
  }
  return true;
}
/* db.command: plain-data operator objects (they survive the JSON clone of where()); .and/.or chain like the SDK */
function mkCmd(o) {
  Object.defineProperty(o, 'and', { value: (x) => mkCmd({ $and: [plainCmd(o), plainCmd(x)] }), enumerable: false });
  Object.defineProperty(o, 'or', { value: (x) => mkCmd({ $or: [plainCmd(o), plainCmd(x)] }), enumerable: false });
  return o;
}
function plainCmd(o) { return JSON.parse(JSON.stringify(o)); }
export const COMMAND = {
  in: (a) => mkCmd({ $in: plainCmd(a || []) }), nin: (a) => mkCmd({ $nin: plainCmd(a || []) }),
  eq: (v) => mkCmd({ $eq: v }), neq: (v) => mkCmd({ $neq: v }),
  gt: (v) => mkCmd({ $gt: v }), gte: (v) => mkCmd({ $gte: v }), lt: (v) => mkCmd({ $lt: v }), lte: (v) => mkCmd({ $lte: v }),
  exists: (v) => mkCmd({ $exists: !!v }),
  and: (...xs) => mkCmd({ $and: xs.flat().map(plainCmd) }), or: (...xs) => mkCmd({ $or: xs.flat().map(plainCmd) })
};

/* ── which UI behaviour to port: the harness drives a DOM-free PORT of the real UI (lib/ui_r1.mjs, written against
   3b6bbd7). Where a reviewed fix changes the UI, the port switches to the fixed behaviour when the repo's UI no longer
   contains the 3b6bbd7 code (exact fragments below). Every ported function is also fingerprinted: if the repo's UI
   differs from 3b6bbd7 in a ported function, the run prints a warning — the port must be re-checked against it. */
const UI_FILES = { room: 'hansen_pk_room_ui_v1065.js', ladder: 'hansen_ladder_ui_v1108.js' };
export const UI_PORTED = {
  room: ['close', 'cancelJoin', 'lobby', 'refresh', 'joinByCode', 'doCreate', 'ladderFail', 'ladderBack', 'waiting', 'clearWait', 'endWait',
    'switchRoom', 'doJoin', 'startMatch', 'stopPoll', 'checkOpponentAlive', 'pollOpponent', 'settlePending', 'stillLive', 'submitRound',
    'nextWord', 'oppPtsShow', 'finish', 'pollResult', 'checkStillThere', 'resultFailed', '_createForLadder', '_joinForLadder', 'bindUnloadCleanup',
    'cancelCreating', 'retryPending', 'resolvePending', 'pendGain', 'bgSettle', 'claimAbandonSure', 'neverCame'],
  ladder: ['stopRun', 'later', 'startMatching', 'tick', 'tryRooms', 'selfHost', 'onFail', 'roomProblem', 'fromRoom']
};
/* normalized-body fingerprints of the ported functions in the version the port was last checked against: 56b8146 + the 联机压力测试 fixes (R1–R12) */
export const UI_FP_BASE = {"room.close":"1jebhvk:717","room.cancelJoin":"yby1wh:132","room.lobby":"jm00kh:2767","room.refresh":"1f129bu:1905","room.joinByCode":"ftmxth:1589","room.doCreate":"wem1yh:1957","room.ladderFail":"xj3m9i:348","room.ladderBack":"q4257j:217","room.waiting":"1xu2yj0:5027","room.clearWait":"129765a:205","room.endWait":"k4i8c0:203","room.switchRoom":"am20bp:768","room.doJoin":"wlep0b:2670","room.startMatch":"fvpz4:1381","room.stopPoll":"8vzfgl:170","room.checkOpponentAlive":"a2gvkb:2144","room.pollOpponent":"1vnh9r0:3994","room.settlePending":"1ew5xa1:614","room.stillLive":"14muajr:157","room.submitRound":"39zdci:3334","room.nextWord":"e590l2:1573","room.oppPtsShow":"l9ldqe:188","room.finish":"ukpmld:1719","room.pollResult":"1ud0u4s:1018","room.checkStillThere":"k8d74s:818","room.resultFailed":"fobbyg:532","room._createForLadder":"kf6ddw:758","room._joinForLadder":"jrvhlv:414","room.bindUnloadCleanup":"1v6dti3:1477","room.cancelCreating":"of5mp7:225","room.retryPending":"1tjda52:682","room.resolvePending":"1xkicb5:884","room.pendGain":"lbpfou:244","room.bgSettle":"1gtptqa:1664","room.claimAbandonSure":"uahcsz:840","room.neverCame":"104gk5s:287","ladder.stopRun":"6b6wqe:224","ladder.later":"x0e4sh:163","ladder.startMatching":"y1ipil:1004","ladder.tick":"dk6zvn:1631","ladder.tryRooms":"1xg8vjz:769","ladder.selfHost":"1t6d4ib:916","ladder.onFail":"vfpafn:1295","ladder.roomProblem":"19jg30h:117","ladder.fromRoom":"26dhxf:361"};
function fnBody(src, name) {
  const re = new RegExp('\\n  function ' + name.replace(/\$/g, '\\$') + '\\s*\\(');
  const m = re.exec(src);
  if (!m) return null;
  const rest = src.slice(m.index + 1);
  const end = rest.slice(1).search(/\n  (function |var |window\.|\/\* ──)/);
  return (end < 0 ? rest : rest.slice(0, end + 1)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}
function fp(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ':' + s.length; }
export function uiFingerprints(repoDir) {
  const out = {};
  for (const [k, file] of Object.entries(UI_FILES)) {
    let src = '';
    try { src = fs.readFileSync(path.resolve(repoDir, file), 'utf8'); } catch (e) { continue; }
    for (const n of UI_PORTED[k]) { const b = fnBody(src, n); out[k + '.' + n] = b == null ? 'missing' : fp(b); }
  }
  return out;
}
const _uiFlags = new Map();
const NEVER_CAME = /_oppSeen|oppSeen|neverCame|oppReady|hostReady|guestReady/;
export function loadUiFlags(repoDir) {
  const f = path.resolve(repoDir, UI_FILES.room);
  if (_uiFlags.has(f)) return _uiFlags.get(f);
  let src = '';
  try { src = fs.readFileSync(f, 'utf8'); } catch (e) {}
  const body = (n) => (src && fnBody(src, n)) || '';
  const flags = {
    present: !!src,
    /* The port follows the 56b8146 UI (before the 联机压力测试 fixes). These switch on the reviewed fixes when the repo's UI shows them (a model, not the page:
       the real-page regression test test_room_fuzz_regress_cloud_v1164.mjs checks the UI bugs on the real page). */
    /* R3: 56b8146 still shows 「你赢了」 when claimAbandonWin failed (checkOpponentAlive, checkStillThere, bgSettle: `? w.result : 'win'`) */
    abandonSure: !!src && !/w && w\.ok && \(w\.result === 'void' \|\| w\.result === 'lose'\)\) \? w\.result : 'win'/.test(src),
    /* R4: finish() settles the pending words first (56b8146: resolvePending) */
    finishSettles: /resolvePending|settleRound|settlePending|pendingR/.test(body('finish')),
    /* R4 (offline at the end): finish() keeps settling while the network is down */
    settleWhileOffline: /_settleOffline/.test(body('finish')),
    /* R5: the failed branch of submitRound keeps the word pending */
    failedPending: /!r \|\| !r\.ok\) \{[^}]*(pendingR|settle)/.test(body('submitRound')),
    /* R10: the result-wait abandon paths look at whether the opponent ever came in (separately per path) */
    neverCameGuard: NEVER_CAME.test(body('checkStillThere')),
    neverCameGuardPoll: NEVER_CAME.test(body('pollResult')),
    /* R12: settlePending no longer drops a pending word after 60 s (finish() re-claims it once more) */
    pendingKept: ((b) => !!b && !/> 60000\) delete pend\[k\]/.test(b))(body('settlePending')),
    /* D2: the result wait is capped by time, not by a poll count (56b8146: `_waitResult < 150`) */
    timeCap: ((b) => !!b && !/_waitResult < 150/.test(b))(body('checkStillThere')),
    /* R3 (cont.): the result-wait / background abandon claim asks the data layer to hold off when the opponent came back (allowBack) */
    claimBack: /allowBack/.test(body('claimAbandonSure')),
    /* D5: back in the foreground during a battle → ask about the opponent at once */
    resumeCheck: /checkOpponentAlive/.test(body('bindUnloadCleanup'))
  };
  const now = uiFingerprints(repoDir), changed = [];
  for (const [k, v] of Object.entries(UI_FP_BASE)) if (now[k] !== undefined && now[k] !== v) changed.push(k);
  flags.changed = changed;
  _uiFlags.set(f, flags);
  return flags;
}

/* ═════════════════════ fake CloudBase collection ═════════════════════ */
class Server {
  constructor(world, cfg) {
    this.w = world;
    this.cfg = Object.assign({ lagMax: 0, lagShape: 2, queryLagMul: 1.5, queryLagExtra: 0, lagMode: 'random',
      ryw: false, dupMode: 'request_failed', permMode: 'legacy', orderByFail: false }, cfg || {});
    this.docs = new Map();          /* id → [{t, v, by}]  (v === null ⇒ removed) */
    this.rng = stream(world.seedKey, 'dblag');
    this.auto = 0; this.req = 0;
  }
  latest(id) { const h = this.docs.get(id); return h ? h[h.length - 1].v : null; }
  stateAt(id, t) {
    const h = this.docs.get(id); if (!h) return null;
    for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= t) return h[i].v;
    return null;
  }
  history(id) { return this.docs.get(id) || []; }
  write(id, v, by) {
    const h = this.docs.get(id) || [];
    h.push({ t: this.w.now, v, by });
    this.docs.set(id, h);
    return h;
  }
  /* the instant a read by player P observes (eventual consistency) */
  visT(P, isQuery) {
    const c = this.cfg, u = (P.lagRng || this.rng).float();
    let lag = c.lagMax * Math.pow(u, c.lagShape || 1);
    if (isQuery) lag = lag * (c.queryLagMul || 1) + (c.queryLagExtra || 0) * (P.lagRng || this.rng).float();
    let tv = this.w.now - lag;
    if (c.lagMode === 'monotonic') { tv = Math.max(tv, P.visT || -Infinity); P.visT = tv; }
    return tv;
  }
  seen(P, id, tv) {
    let v = this.stateAt(id, tv);
    if (this.cfg.ryw) {   /* read-your-writes: my own last write is always visible to me */
      const h = this.docs.get(id);
      if (h) for (let i = h.length - 1; i >= 0 && h[i].t > tv; i--) if (h[i].by === P.uid) { v = h[h.length - 1].v; break; }
    }
    return v;
  }
  reqId() { return 'req' + (++this.req).toString(36); }
  /* returns {value} (resolved SDK response, possibly {code}) or {transport:true} (SDK rejects) */
  apply(rec, P) {
    const c = this.cfg, t = this.w.now;
    rec.applied = true; rec.tA = t;
    switch (rec.op) {
      case 'add': {
        const doc = rec.doc || {};
        const id = (typeof doc._id === 'string' && doc._id) ? doc._id : ('auto' + (++this.auto));
        if (this.latest(id)) {
          rec.res = 'dup';
          if (c.dupMode === 'duplicate_write') return { value: { code: 'DATABASE_DUPLICATE_WRITE', message: 'duplicate key: _id ' + id, requestId: this.reqId() } };
          if (c.dupMode === 'http500') return { transport: true };
          if (c.dupMode === 'silent') return { value: { id, requestId: this.reqId() } };
          return { value: { code: 'DATABASE_REQUEST_FAILED',
            message: '[FailedOperation] multiple write errors: [{write errors: [{E11000 duplicate key error collection: env.hansen_pk_rooms index: _id_ dup key: { _id: "' + id + '" }}]}, {<nil>}]; ',
            requestId: this.reqId() } };
        }
        const v = Object.assign(clone(doc), { _id: id, _openid: P.uid });
        this.write(id, v, P.uid);
        rec.res = 'ok';
        return { value: { id, requestId: this.reqId() } };
      }
      case 'get': {
        const tv = this.visT(P, false);
        const v = this.seen(P, rec.id, tv);
        rec.res = v ? 'hit' : 'miss'; rec.lag = Math.round(t - tv);
        return { value: { data: v ? [clone(v)] : [], requestId: this.reqId() } };
      }
      case 'update': case 'remove': {
        const cur = this.latest(rec.id);
        if (!cur) { rec.res = 'none'; return { value: rec.op === 'update' ? { updated: 0, requestId: this.reqId() } : { deleted: 0, requestId: this.reqId() } }; }
        if (cur._openid !== P.uid) {
          rec.res = 'denied'; rec.owner = cur._openid;
          if (c.permMode === 'rules') return { value: { code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied', requestId: this.reqId() } };
          return { value: rec.op === 'update' ? { updated: 0, requestId: this.reqId() } : { deleted: 0, requestId: this.reqId() } };
        }
        if (rec.op === 'remove') { this.write(rec.id, null, P.uid); rec.res = 'del'; return { value: { deleted: 1, requestId: this.reqId() } }; }
        const nv = Object.assign({}, cur, clone(rec.data || {}), { _id: cur._id, _openid: cur._openid });
        const changed = JSON.stringify(nv) !== JSON.stringify(cur);
        if (changed) this.write(rec.id, nv, P.uid);
        rec.res = changed ? 'upd' : 'same';
        return { value: { updated: changed ? 1 : 0, requestId: this.reqId() } };
      }
      case 'query': {
        if (rec.orderBy && c.orderByFail) { rec.res = 'orderby-refused'; return { value: { code: 'DATABASE_REQUEST_FAILED', message: 'sort without index refused', requestId: this.reqId() } }; }
        const cond = rec.cond || {};
        /* doc(id).get() is itself a queryDocument {_id: id} in the CloudBase SDK — an _id-keyed query
           (where({_id: _.in([...])}), used by the v1164-r1 getMany) gets the same lag as a point read */
        const byId = !!(cond._id && typeof cond._id === 'object' && Array.isArray(cond._id.$in));
        const tv = this.visT(P, !byId);
        let rows = [];
        const ids = byId ? cond._id.$in.filter((x) => typeof x === 'string' && this.docs.has(x)) : this.docs.keys();
        const seenIds = new Set();
        for (const id of ids) {
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          const v = this.seen(P, id, tv);
          if (!v) continue;
          if (condMatch(v, cond)) rows.push(v);
        }
        if (byId) rec.ids = cond._id.$in.length;
        if (rec.orderBy) {
          const f = rec.orderBy[0], dir = rec.orderBy[1] === 'asc' ? 1 : -1;
          const rank = (x) => (x == null ? 0 : typeof x === 'number' ? 1 : typeof x === 'string' ? 2 : typeof x === 'boolean' ? 4 : 3);
          rows = rows.map((v, i) => [v, i]).sort((A, B) => {
            const a = A[0][f], b = B[0][f];
            const ra = rank(a), rb = rank(b);
            let d = ra !== rb ? ra - rb : (ra === 1 ? a - b : ra === 2 ? (a < b ? -1 : a > b ? 1 : 0) : 0);
            if (d === 0) return A[1] - B[1];
            return d * dir;
          }).map(x => x[0]);
        }
        rows = rows.slice(0, rec.limit || 100);
        rec.res = rows.length + ' rows'; rec.lag = Math.round(t - tv);
        return { value: { data: rows.map(clone), requestId: this.reqId() } };
      }
    }
    return { value: {} };
  }
}

/* ═════════════════════ one page load of the app on one phone ═════════════════════ */
export class Instance {
  constructor(world, player, no) {
    this.world = world; this.player = player; this.no = no;
    this.label = player.label + (no > 1 ? '#' + no : '');
    this.timers = new Map(); this.tid = 0;
    this.frozenUntil = 0; this.dead = false; this.unloading = false; this.hidden = false;
    this.winL = []; this.docL = [];
    if (!player.sess) player.sess = new Map();
    this.probes = new Map();
    const W = world, P = player, self = this;
    const mrand = stream(W.seedKey, 'math/' + P.label + '/' + no);
    class FakeDate extends Date {
      constructor(...a) { if (a.length === 0) super(W.now + P.skew); else super(...a); }
      static now() { return W.now + P.skew; }
    }
    const M = Object.create(Math); M.random = () => mrand.float();
    const sdkDb = this.makeSdkDb();
    const sessRng = stream(W.seedKey, 'session/' + P.label + '/' + no);
    const probeRng = stream(W.seedKey, 'probe/' + P.label + '/' + no);
    const ctx = {
      console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
      Date: FakeDate, Math: M,
      setTimeout: (f, ms) => self.setTimeout(f, ms),
      clearTimeout: (id) => self.clearTimer(id),
      setInterval: (f, ms) => self.setInterval(f, ms),
      clearInterval: (id) => self.clearTimer(id),
      addEventListener: (t, f) => { self.winL.push([t, f]); },
      removeEventListener() {},
      document: { addEventListener: (t, f) => { self.docL.push([t, f]); }, removeEventListener() {},
                  get visibilityState() { return self.hidden ? 'hidden' : 'visible'; } },
      /* sessionStorage belongs to the browser TAB: it survives a reload of the page (same player), not a second device */
      sessionStorage: {
        getItem: (k) => (P.sess.has(String(k)) ? P.sess.get(String(k)) : null),
        setItem: (k, v) => { P.sess.set(String(k), String(v)); },
        removeItem: (k) => { P.sess.delete(String(k)); },
        clear: () => { P.sess.clear(); }
      },
      HANSEN_VOCAB_ALL: VOCAB,
      HansenAuth: {
        readLocal: () => ({ uid: P.uid }),
        isSignedIn: () => true,
        /* the ladder UI asks the login service (same cloud domain) whether the network is up */
        probeCloud: () => new Promise((res) => { self.setTimeout(() => res(!W.offlineAt(P, W.now)), 30 + Math.floor(probeRng.float() * 200)); }),
        /* real ensureSession resolves {ok:true, uid}; transient failures resolve {ok:false, kind:'session'} */
        ensureSession: () => new Promise((res) => {
          self.setTimeout(() => {
            if (P.sessionFailP && sessRng.chance(P.sessionFailP)) {
              W.mark(P, 'session-fault');
              res({ ok: false, notReady: true, kind: 'session', reason: '云端会话尚未就绪（已重试 1 次），请稍候再试' });
            } else res({ ok: true, uid: P.uid });
          }, 5 + Math.floor(sessRng.float() * 40));
        }),
        _app: () => Promise.resolve({ database: () => sdkDb })
      },
      HansenSbProfile: { displayName: () => P.name },
      HansenPkRecord: { summary: () => ({ rating: P.rating }) }
    };
    if (W.mod.probed) ctx.__hsnProbe = (k, args) => {
      const a0 = args && args[0];
      const id = (a0 && typeof a0 === 'object') ? String(a0._id || '') : String(a0 || '');
      self.probes.set(k + '|' + id, new Error('probe').stack);
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    W.mod.script.runInContext(ctx);
    this.ctx = ctx;
    this.api = ctx.HansenPkRoom;
  }
  localNow() { return this.world.now + this.player.skew; }
  setTimeout(f, ms) {
    const id = ++this.tid, W = this.world;
    const ev = W.at(W.now + Math.max(0, Number(ms) || 0), () => { this.timers.delete(id); f(); }, this);
    this.timers.set(id, ev);
    return id;
  }
  setInterval(f, ms) {
    const id = ++this.tid, W = this.world, step = Math.max(1, Number(ms) || 0);
    const fire = () => {
      if (!this.timers.has(id)) return;
      this.timers.set(id, W.at(W.now + step, fire, this));
      f();
    };
    this.timers.set(id, W.at(W.now + step, fire, this));
    return id;
  }
  clearTimer(id) { const ev = this.timers.get(id); if (ev) { ev.dead = true; this.timers.delete(id); } }
  fire(type) {
    for (const [t, f] of this.winL) if (t === type) { try { f({ type }); } catch (e) { this.world.moduleError(e, this, 'listener ' + type); } }
  }
  /* page visibility (switching to WeChat, locking the screen): module listeners on document + the UI port */
  setHidden(h) {
    h = !!h;
    if (this.hidden === h || this.dead) return;
    this.hidden = h;
    this.world.log(this.label, h ? 'page hidden (visibilitychange)' : 'page visible again (visibilitychange)');
    for (const [t, f] of this.docL) if (t === 'visibilitychange') { try { f({ type: t }); } catch (e) { this.world.moduleError(e, this, 'visibilitychange'); } }
    if (this.ui && this.ui.onVisibility) { try { this.ui.onVisibility(h); } catch (e) { this.world.moduleError(e, this, 'ui visibilitychange'); } }
  }
  /* fake @cloudbase/js-sdk database object (only what the module uses) */
  makeSdkDb() {
    const self = this;
    const W = this.world;
    const q = (col, st) => ({
      where: (cond) => q(col, Object.assign({}, st, { cond: clone(cond) })),
      orderBy: (f, d) => q(col, Object.assign({}, st, { orderBy: [f, d] })),
      limit: (n) => q(col, Object.assign({}, st, { limit: n })),
      get: () => W.request(self, 'query', Object.assign({ col }, st))
    });
    return {
      collection(col) {
        return {
          add: (doc) => W.request(self, 'add', { col, doc: clone(doc) }),
          doc: (id) => ({
            get: () => W.request(self, 'get', { col, id: String(id) }),
            update: (data) => W.request(self, 'update', { col, id: String(id), data: clone(data) }),
            remove: () => W.request(self, 'remove', { col, id: String(id) })
          }),
          where: (cond) => q(col, { cond: clone(cond) }),
          orderBy: (f, d) => q(col, { orderBy: [f, d] }),
          limit: (n) => q(col, { limit: n })
        };
      },
      serverDate: () => ({ $date: W.now }),
      command: COMMAND
    };
  }
}

/* ═════════════════════ the world ═════════════════════ */
export class World {
  constructor(spec, opts = {}) {
    this.spec = spec;
    this.opts = opts;
    this.seedKey = String(spec.seed) + (spec.salt ? '~' + spec.salt : '');
    this.now = T0;
    this.seq = 0;
    this.heap = new Heap();
    this.trace = [];
    this.ops = [];
    this.marks = [];        /* fault/partition/etc. markers per player (for kind ground truth) */
    this.errors = [];       /* exceptions thrown by module code */
    this.mod = loadModule(opts.repoDir, { probe: !!opts.probe });
    this.uiFlags = loadUiFlags(opts.repoDir);
    this.server = new Server(this, spec.db);
    this.players = [];
    this.nEvents = 0;
    this.opSeq = 0;
  }
  rel(t) { return ((t == null ? this.now : t) - T0) / 1000; }
  log(who, msg) { this.trace.push({ t: this.now, who, msg }); }
  mark(P, what, extra) { this.marks.push(Object.assign({ t: this.now, who: P.label, uid: P.uid, what }, extra || {})); }
  moduleError(e, inst, where) {
    this.errors.push({ t: this.now, who: inst ? inst.label : '', where, msg: String(e && e.stack || e).slice(0, 800) });
  }
  at(t, fn, owner) {
    const ev = { t: Math.max(t, this.now), seq: ++this.seq, fn, owner: owner || null, dead: false };
    this.heap.push(ev);
    return ev;
  }
  after(ms, fn, owner) { return this.at(this.now + ms, fn, owner); }

  inWin(list, t) { for (const x of (list || [])) if (t >= T0 + x.a && t < T0 + x.b) return x; return null; }
  offlineAt(P, t) { return this.inWin(P.partitions, t) || this.inWin(this.spec.outages, t); }

  latency(P, rnd) {
    const n = P.net || {};
    let ms = (n.base || 0) + (n.jitter || 0) * Math.pow(rnd.float(), 2);
    if (n.spikeP && rnd.chance(n.spikeP)) ms += rnd.range(800, 4000);
    return Math.max(1, Math.round(ms));
  }

  /* every SDK database call goes through here */
  request(inst, op, args) {
    const W = this, P = inst.player, srv = this.server;
    const rec = { n: ++this.opSeq, t0: this.now, who: inst.label, uid: P.uid, op, id: args.id || (args.doc && args.doc._id) || '',
      cond: args.cond, orderBy: args.orderBy, limit: args.limit, doc: args.doc, data: args.data,
      fault: '', applied: false, tA: 0, tR: 0, res: '' };
    if (inst.probes.size && (op === 'update' || op === 'remove' || op === 'add')) {
      const k = op === 'update' ? 'patch' : op;
      rec.stack = inst.probes.get(k + '|' + rec.id) || '';
    }
    this.ops.push(rec);
    return new Promise((resolve, reject) => {
      if (inst.dead) { rec.fault = 'dead'; return; }
      const rnd = P.netRng;
      const t0 = this.now;
      const failAt = (t, why) => {
        if (!rec.fault) rec.fault = why;
        rec.tR = t;
        W.mark(P, 'netfail', { why, op });
        W.at(t, () => reject(new Error('network request error')), inst);
      };
      if (inst.unloading) {
        /* pagehide: the request may or may not leave the phone; the answer is never processed */
        rec.fault = 'unload';
        if (rnd.chance(this.spec.unloadSendP == null ? 0.6 : this.spec.unloadSendP)) {
          const up = this.latency(P, rnd);
          W.at(t0 + up, () => { if (!W.offlineAt(P, W.now)) srv.apply(rec, P); }, null);
        }
        return;
      }
      const off = this.offlineAt(P, t0);
      if (off) { failAt(t0 + (off.mode === 'hang' ? SDK_TIMEOUT_MS : 50 + Math.floor(rnd.float() * 900)), P.partitions && this.inWin(P.partitions, t0) ? 'offline' : 'outage'); return; }
      let up = this.latency(P, rnd), down = this.latency(P, rnd);
      const n = P.net || {};
      let fault = '';
      if (n.faultRate > 0 && rnd.chance(n.faultRate)) fault = rnd.pickW(n.faultMix || { drop: 1, lost: 1, e5xx: 1, slow: 1 });
      if (fault === 'slow') { up = up * rnd.range(3, 8) + rnd.range(2000, 9000); down = down * rnd.range(1, 3) + rnd.range(500, 3000); W.mark(P, 'slow', { op }); }
      if (fault === 'drop') { failAt(t0 + Math.min(SDK_TIMEOUT_MS, 300 + Math.floor(rnd.float() * 14000)), 'drop'); return; }
      const tA = t0 + up, tR = tA + down;
      if (!fault && up + down > 7000) W.mark(P, 'slow', { op, natural: true });
      const timedOut = (tR - t0) > SDK_TIMEOUT_MS;
      if (timedOut) failAt(t0 + SDK_TIMEOUT_MS, 'sdk-timeout');
      W.at(tA, () => {
        if (W.offlineAt(P, W.now)) { rec.fault = rec.fault || 'lost-up'; if (!timedOut) failAt(tR, 'lost-up'); return; }
        if (fault === 'e5xx') { rec.fault = '5xx'; if (!timedOut) failAt(tR, '5xx'); return; }
        const out = srv.apply(rec, P);
        if (timedOut) return;
        if (fault === 'lost') { failAt(tR, 'lost'); return; }
        if (W.offlineAt(P, tR)) { failAt(tR, 'lost-down'); return; }
        if (out.transport) { failAt(tR, 'http500'); return; }
        rec.tR = tR;
        const val = clone(out.value);
        W.at(tR, () => resolve(val), inst);
      }, null);
    });
  }

  async run(stop, hardLimit) {
    while (this.heap.size()) {
      const ev = this.heap.pop();
      if (ev.dead) continue;
      if (ev.t > hardLimit) { this.heap.push(ev); return false; }
      const o = ev.owner;
      if (o) {
        if (o.dead) continue;
        if (o.frozenUntil > ev.t) { ev.t = o.frozenUntil; this.heap.push(ev); continue; }
      }
      if (ev.t > this.now) this.now = ev.t;
      try { ev.fn(); } catch (e) { this.moduleError(e, o, 'event'); }
      await drain();
      this.nEvents++;
      if (stop && stop()) return true;
    }
    return true;
  }
}
