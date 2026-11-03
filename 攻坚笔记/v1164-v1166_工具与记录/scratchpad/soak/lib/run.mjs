/* run.mjs — build a World from a scenario spec, play it, run the end phase, return the world for checking. */
import { World, Instance, T0 } from './world.mjs';
import { Ui } from './ui.mjs';
import { stream } from './prng.mjs';

const STALE_MS = 30000;

function mkPlayer(W, ps, i, honest) {
  const P = Object.assign({}, ps);
  P.idx = i; P.label = ps.label || ('P' + i); P.honest = honest;
  P.key = 'u' + P.uid;
  P.skew = Number(ps.skew) || 0;
  P.partitions = (ps.partitions || []).map((x) => Object.assign({}, x));
  P.netRng = stream(W.seedKey, 'net/' + P.label);
  P.kidRng = stream(W.seedKey, 'kid/' + P.label);
  P.lagRng = stream(W.seedKey, 'lag/' + P.label);
  P.events = []; P.matches = []; P.apiFails = []; P.joins = []; P.waitEvents = []; P.hosted = [];
  P.instances = []; P.instNo = 0; P.inst = null;
  P.visT = -Infinity;
  return P;
}

export function spawn(W, P) {
  P.instNo++;
  const inst = new Instance(W, P, P.instNo);
  inst.ui = new Ui(inst);
  P.inst = inst; P.instances.push(inst);
  W.log(inst.label, 'page loaded (instance ' + inst.no + ')');
  P.events.push({ t: W.now, inst: inst.no, type: 'load' });
  return inst;
}

/* reload = pagehide (module + UI listeners run; their requests may or may not get out), page dies, new page later */
export function reload(W, P, delay) {
  const old = P.inst;
  if (!old || old.dead) return;
  old.unloading = true;
  W.log(old.label, 'pagehide / reload');
  P.events.push({ t: W.now, inst: old.no, type: 'reload' });
  try { old.fire('pagehide'); } catch (e) {}
  try { old.ui.onPageHide(); } catch (e) {}
  try { old.fire('beforeunload'); } catch (e) {}
  /* microtasks of the pagehide task still run (that is when the SDK calls are made); after that the page is gone */
  W.after(0, () => { old.dead = true; old.unloading = false; }, null);
  W.after(delay || 3000, () => {
    const inst = spawn(W, P);
    /* after a reload the kid goes back to what they were doing */
    const again = P.afterReload;
    if (again) inst.setTimeout(() => inst.ui.intent(Object.assign({}, again)), 1500);
  }, null);
}

export function freeze(W, P, dur) {
  const inst = P.inst;
  if (!inst || inst.dead) return;
  inst.frozenUntil = Math.max(inst.frozenUntil, W.now + dur);
  W.log(inst.label, 'background (JS frozen) for ' + Math.round(dur / 1000) + ' s');
  W.mark(P, 'freeze', { until: W.now + dur });
  P.events.push({ t: W.now, inst: inst.no, type: 'freeze', until: W.now + dur });
}

/* ── adversary: a logged-in stranger who edits JS; writes only its own docs (it cannot do anything else) ── */
class AdvInst {
  constructor(W, P) { this.world = W; this.player = P; this.no = 1; this.label = P.label; this.dead = false; this.unloading = false; this.frozenUntil = 0; this.probes = new Map(); this.timers = new Map(); this.tid = 0; }
  localNow() { return this.world.now + this.player.skew; }
}
function startAdversary(W, A) {
  const inst = new AdvInst(W, A);
  A.inst = inst;
  const b = A.adv || {};
  const rnd = stream(W.seedKey, 'adv');
  const req = (op, args) => W.request(inst, op, args).catch(() => null);
  const honestKeys = () => W.players.filter((p) => p.honest).map((p) => p.key);
  const mine = new Set();
  const every = (ms, fn) => { const loop = () => { fn(); W.after(ms, loop, inst); }; W.at(T0 + (b.start || 0), loop, inst); };
  const now = () => inst.localNow();
  if (b.flood) {
    W.at(T0 + (b.start || 0), () => {
      for (let k = 0; k < (b.flood.n || 20); k++) {
        const old = b.flood.created === 'old';
        const id = 'rzz' + k + rnd.int(1000, 9999);
        mine.add(id);
        req('add', { col: 'hansen_pk_rooms', doc: { _id: id, proto: 2, kind: 'room', status: 'open', isPrivate: false, code: '',
          mode: 'A', askMode: 'cn', seed: rnd.int(1, 1e9), wordCount: 10,
          hostId: b.flood.forge ? rnd.pick(honestKeys()) : 'uFAKE' + k, hostName: '大魔王' + k, hostRating: 1000 + rnd.int(-50, 50),
          hostTier: '', guestId: '', seat: 0, createdAt: old ? now() - 3600e3 - k : now() + 3600e3 + k,
          heartbeatAt: now() + 864e5 * 365, hostBeat: 1, hostReady: false, nonce: 'x' } });
      }
    }, inst);
  }
  if (b.squatSeats || b.squatWins) {
    every(b.period || 3000, () => {
      W.request(inst, 'query', { col: 'hansen_pk_rooms', cond: b.squatWins ? { kind: 'room' } : { kind: 'room', status: 'open' }, limit: 50 }).then((r) => {
        const rows = (r && r.data) || [];
        for (const R of rows) {
          if (!R || mine.has(R._id) || R._openid === A.uid) continue;
          if (b.squatSeats && R.status === 'open') {
            const ep = Number(R.seat) || 0;
            for (let e = ep; e <= ep + (b.squatSeats.depth || 2); e++) {
              const sid = R._id + '_s' + e;
              if (mine.has(sid)) continue;
              mine.add(sid);
              const t = now();
              req('add', { col: 'hansen_pk_rooms', doc: { _id: sid, proto: 2, kind: 'seat', roomId: R._id, epoch: e,
                guestId: b.squatSeats.forge ? rnd.pick(honestKeys().filter((k) => k !== R.hostId)) || 'uADV' : 'u' + A.uid,
                guestName: '捣蛋鬼', guestRating: 1000, createdAt: t, guestBeat: t, acked: !!b.squatSeats.acked,
                guestReady: !!b.squatSeats.acked, guestReadyAt: t, guestScore: null, left: false, abandonWin: '', nonce: 'x' } });
            }
          }
          if (b.squatWins && (R.status === 'open' || R.status === 'playing')) {
            const wc = Math.max(1, Math.min(30, Number(R.wordCount) || 10));
            for (let i = 0; i < wc; i++) {
              const wid = R._id + '_w' + i;
              if (mine.has(wid)) continue;
              mine.add(wid);
              req('add', { col: 'hansen_pk_rooms', doc: { _id: wid, proto: 2, kind: 'win', roomId: R._id, i,
                winner: rnd.pick(['host', 'guest', '']), by: rnd.chance(0.5) ? R.hostId : 'u' + A.uid, at: now(), nonce: 'x' } });
            }
          }
        }
      }, () => {});
      /* keep the squatted seats "alive" */
      if (b.squatSeats && b.squatSeats.beat) for (const id of mine) if (/_s\d+$/.test(id)) req('update', { col: 'hansen_pk_rooms', id, data: { guestBeat: now() } });
    });
  }
  if (b.forgeHost) {
    W.at(T0 + (b.start || 0), () => {
      for (const k of honestKeys()) for (let j = 0; j < 6; j++) {
        const id = 'rzf' + j + rnd.int(1000, 9999);
        mine.add(id);
        req('add', { col: 'hansen_pk_rooms', doc: { _id: id, proto: 2, kind: 'room', status: j < 3 ? 'done' : 'open', isPrivate: false,
          mode: 'A', hostId: k, hostName: '冒名', hostRating: 1000, guestId: '', seat: 0, createdAt: now() - 7200e3,
          heartbeatAt: j < 3 ? now() - 7200e3 : now() + 864e5, endedAt: now() - 7200e3, nonce: 'x' } });
        req('add', { col: 'hansen_pk_rooms', doc: { _id: id + '_s0', proto: 2, kind: 'seat', roomId: id, epoch: 0, guestId: k,
          createdAt: now() - 7200e3, guestBeat: now() - 7200e3, nonce: 'x' } });
      }
    }, inst);
  }
}

/* ═════════════════════ play one scenario ═════════════════════ */
export async function runSpec(spec, opts = {}) {
  const W = new World(spec, opts);
  if (opts.hooks && opts.hooks.onWorld) opts.hooks.onWorld(W);
  W.lastChange = W.now;
  W.playerByLabel = (l) => W.players.find((p) => p.label === l) || null;
  W.onIdle = (ui) => { ui.inst.setTimeout(() => { try { ui.onIdleKid(); } catch (e) { W.moduleError(e, ui.inst, 'onIdleKid'); } }, 0); };
  let lastAt = 0;
  (spec.players || []).forEach((ps, i) => { W.players.push(mkPlayer(W, ps, i, true)); });
  for (const P of W.players) {
    spawn(W, P);
    for (const it of (P.intents || [])) {
      lastAt = Math.max(lastAt, it.at);
      const fire = () => {
        const inst = P.inst;
        if (!inst || inst.dead) { W.after(1000, fire, null); return; }      /* page reloading: the kid acts once it is back */
        if (inst.frozenUntil > W.now) { W.at(inst.frozenUntil + 50, fire, null); return; }
        try { inst.ui.intent(Object.assign({}, it)); } catch (e) { W.moduleError(e, inst, 'intent'); }
      };
      W.at(T0 + it.at, fire, null);
    }
    for (const x of (P.reloads || [])) { lastAt = Math.max(lastAt, x.at + (x.delay || 3000)); W.at(T0 + x.at, () => reload(W, P, x.delay), null); }
    for (const x of (P.freezes || [])) { lastAt = Math.max(lastAt, x.at + x.dur); W.at(T0 + x.at, () => freeze(W, P, x.dur), null); }
    for (const x of P.partitions) {
      lastAt = Math.max(lastAt, x.b);
      W.at(T0 + x.a, () => { W.log(P.label, 'network lost (' + x.mode + ') for ' + Math.round((x.b - x.a) / 1000) + ' s'); W.mark(P, 'partition', { a: T0 + x.a, b: T0 + x.b }); }, null);
      W.at(T0 + x.b, () => W.log(P.label, 'network back'), null);
    }
  }
  for (const o of (spec.outages || [])) {
    lastAt = Math.max(lastAt, o.b);
    W.at(T0 + o.a, () => { W.log('SERVER', 'outage (' + o.mode + ') for ' + Math.round((o.b - o.a) / 1000) + ' s'); for (const P of W.players) W.mark(P, 'outage', { a: T0 + o.a, b: T0 + o.b }); }, null);
  }
  if (spec.adversary) {
    const A = mkPlayer(W, Object.assign({ label: 'ADV' }, spec.adversary), W.players.length, false);
    W.adversary = A;
    startAdversary(W, A);
  }
  W.lastAt = T0 + lastAt;
  const hard = T0 + lastAt + (opts.hardMs || 25 * 60e3);
  const honest = W.players.filter((p) => p.honest);
  const quiet = () => {
    if (W.now < W.lastAt + 2000) return false;
    for (const P of honest) {
      const i = P.inst;
      if (!i || i.dead || i.frozenUntil > W.now) return false;
      if (!i.ui.idle() || i.ui.joinPlan || i.ui.pressPending) return false;
    }
    return W.now - W.lastChange > 8000;
  };
  W.phase1Complete = await W.run(quiet, hard);
  W.phase1End = W.now;
  W.screenAtP1 = new Map(honest.map((P) => [P.label, P.inst && !P.inst.dead ? { screen: P.inst.ui.screen, at: P.inst.ui.screenAt, idle: P.inst.ui.idle() } : null]));

  /* ── end phase: everybody is idle (or stuck). Sweeps run, time passes, then an unskewed observer looks at the list. ── */
  W.endPhase = true;
  W.lastChange = W.now;
  const t1 = W.now;
  for (const P of honest) {
    for (const dt of [1000, 131000, 262000]) {
      W.at(t1 + dt, () => { const i = P.inst; if (i && !i.dead) { try { i.api.sweepMyDeadRooms(); } catch (e) { W.moduleError(e, i, 'sweep'); } } }, null);
    }
  }
  let endDone = false;
  W.at(t1 + 272000, () => { endDone = true; }, null);
  await W.run(() => endDone, t1 + 300000);
  W.tEnd = W.now;
  return W;
}

/* what an unskewed, lag-free observer's listRooms would show right now (server-side evaluation of the module's filter) */
export function advertised(W, tObs) {
  const out = [];
  for (const [id] of W.server.docs) {
    const x = W.server.latest(id);
    if (!x || x.proto !== 2 || x.kind !== 'room' || x.status !== 'open' || x.isPrivate === true || x.guestId) continue;
    const beat = x.heartbeatAt || x.createdAt || 0;
    if ((tObs - beat) >= STALE_MS) continue;
    out.push(x);
  }
  return out;
}
