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
        const tv = this.visT(P, true);
        const cond = rec.cond || {};
        let rows = [];
        for (const id of this.docs.keys()) {
          const v = this.seen(P, id, tv);
          if (!v) continue;
          let okk = true;
          for (const k of Object.keys(cond)) { if (v[k] !== cond[k]) { okk = false; break; } }
          if (okk) rows.push(v);
        }
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
    this.frozenUntil = 0; this.dead = false; this.unloading = false;
    this.winL = []; this.docL = [];
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
    const ctx = {
      console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
      Date: FakeDate, Math: M,
      setTimeout: (f, ms) => self.setTimeout(f, ms),
      clearTimeout: (id) => self.clearTimer(id),
      setInterval: (f, ms) => self.setInterval(f, ms),
      clearInterval: (id) => self.clearTimer(id),
      addEventListener: (t, f) => { self.winL.push([t, f]); },
      removeEventListener() {},
      document: { addEventListener: (t, f) => { self.docL.push([t, f]); }, removeEventListener() {}, visibilityState: 'visible' },
      HANSEN_VOCAB_ALL: VOCAB,
      HansenAuth: {
        readLocal: () => ({ uid: P.uid }),
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
      serverDate: () => ({ $date: W.now })
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
