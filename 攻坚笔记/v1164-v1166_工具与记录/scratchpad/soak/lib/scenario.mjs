/* scenario.mjs — seeded scenario generator (profiles = parameter distributions) and shrink operators.
 * A spec is plain JSON: replaying the same spec on the same code gives the same run. */
import { Rand } from './prng.mjs';

const NAMES = ['小明', '小红', '阿杰', '朵朵', '豆豆', '乐乐', '天天', '果果'];

/* knob helpers: number | [lo, hi] | {weights} */
function val(r, k, dflt) {
  if (k == null) return dflt;
  if (typeof k === 'number' || typeof k === 'string' || typeof k === 'boolean') return k;
  if (Array.isArray(k)) return k.length === 2 && typeof k[0] === 'number' ? r.range(k[0], k[1]) : r.pick(k);
  if (typeof k === 'object') { const x = r.pickW(k); const n = Number(x); return isNaN(n) ? x : n; }
  return dflt;
}

const BASE = {
  kinds: { rooms: 5, rooms2: 1, ladder: 4 },
  lag: { 0: 3, 800: 2, 2500: 2, 6000: 1 },     /* max eventual-consistency lag (ms) */
  lat: { 15: 2, 80: 3, 250: 2, 600: 1 },        /* typical one-way latency (ms) */
  fault: { 0: 3, 0.02: 2, 0.05: 2, 0.1: 1 },     /* per-request fault probability */
  skewP: 0.25, skewMax: { 20000: 1, 120000: 1, 600000: 1 },
  disruptP: 0.25, outageP: 0.06, sessionP: 0.04,
  adv: 0.08, twinP: 0.03,
  modes: { A: 1, B: 1, C: 1 }, wordCount: { 10: 2, 5: 2, 3: 3 },
  privateP: 0.3
};

export const PROFILES = {
  /* sanity: no lag, no faults, no skew, no disruption → anything that fails here is a plain logic bug or a harness bug */
  clean: { runs: 200, lag: 0, lat: { 15: 1, 80: 1 }, fault: 0, skewP: 0, disruptP: 0, outageP: 0, sessionP: 0, adv: 0, twinP: 0 },
  smoke: { runs: 30 },
  /* CI-sized mix (≈ 60–120 s on one core) */
  ci: { runs: 400 },
  lag: { runs: 600, lag: { 1500: 1, 3000: 1, 6000: 2 }, fault: { 0: 2, 0.02: 1 }, skewP: 0, disruptP: 0.1, adv: 0, twinP: 0 },
  faults: { runs: 600, fault: { 0.03: 1, 0.06: 1, 0.1: 2 }, lag: { 0: 1, 1500: 1 }, skewP: 0, disruptP: 0.1, adv: 0 },
  skew: { runs: 600, skewP: 0.8, skewMax: { 30000: 1, 120000: 1, 600000: 2 }, lag: { 0: 2, 800: 1 }, fault: { 0: 3, 0.02: 1 }, disruptP: 0.05, adv: 0, twinP: 0.15 },
  ladder: { runs: 600, kinds: { ladder: 1 }, lag: { 0: 2, 1500: 2, 4000: 1 } },
  adversary: { runs: 400, adv: 1, lag: { 0: 2, 1000: 1 }, fault: { 0: 3, 0.02: 1 }, skewP: 0.1, disruptP: 0.05 },
  disrupt: { runs: 600, disruptP: 0.9, outageP: 0.2, lag: { 0: 2, 1500: 1 }, fault: { 0: 2, 0.03: 1 }, skewP: 0.1, adv: 0 },
  chaos: { runs: 600, lag: { 0: 1, 2000: 1, 6000: 1 }, lat: { 80: 1, 400: 1, 1000: 1 }, fault: { 0.02: 1, 0.05: 1, 0.1: 1 }, skewP: 0.5, skewMax: { 60000: 1, 600000: 1 }, disruptP: 0.5, outageP: 0.15, adv: 0.2, twinP: 0.08 },
  /* grid sweep: each seed lands in one cell of lag × latency × faults × skew × kind × adversary */
  sweep: { runs: 2304, grid: { lag: [0, 1500, 3000, 6000], lat: [15, 250, 1000], fault: [0, 0.02, 0.05, 0.1], skew: [0, 60000, 600000], kind: ['rooms', 'ladder'], adv: [0, 1] } }
};

export function profileCfg(name) {
  const p = PROFILES[name];
  if (!p) throw new Error('unknown profile ' + name + ' (have: ' + Object.keys(PROFILES).join(', ') + ')');
  return Object.assign({}, BASE, p, { name });
}

function gridCell(grid, seed) {
  const keys = Object.keys(grid); let x = Math.abs(Math.floor(seed)); const out = {};
  for (const k of keys) { const a = grid[k]; out[k] = a[x % a.length]; x = Math.floor(x / a.length); }
  return out;
}

export function genSpec(seed, prof) {
  const r = new Rand(seed, 'gen/' + prof.name);
  const cell = prof.grid ? gridCell(prof.grid, seed - 1) : null;
  const kind = cell ? (cell.kind === 'rooms' && r.chance(0.2) ? 'rooms2' : cell.kind) : val(r, prof.kinds, 'rooms');
  const lagMax = Math.round(cell ? cell.lag : val(r, prof.lag, 0));
  const lat = cell ? cell.lat : val(r, prof.lat, 50);
  const fault = cell ? cell.fault : val(r, prof.fault, 0);
  const skewMax = cell ? cell.skew : val(r, prof.skewMax, 0);
  const skewP = cell ? (cell.skew ? 0.7 : 0) : prof.skewP;
  const adv = cell ? !!cell.adv : r.chance(prof.adv);
  const spec = {
    seed, profile: prof.name, kind,
    db: {
      lagMax, lagShape: r.pick([1, 2, 3]), queryLagMul: +(1 + r.float()).toFixed(2), queryLagExtra: lagMax ? r.int(0, 1000) : 0,
      lagMode: r.pickW({ random: 3, monotonic: 1 }), ryw: r.chance(0.25),
      dupMode: r.pickW({ request_failed: 4, duplicate_write: 2, http500: 1 }), permMode: r.pick(['legacy', 'rules']),
      orderByFail: r.chance(0.1)
    },
    unloadSendP: +(0.3 + 0.6 * r.float()).toFixed(2),
    outages: [], players: [], adversary: null
  };
  const n = kind === 'ladder' ? val(r, { 2: 5, 3: 3, 4: 2 }) : kind === 'rooms2' ? val(r, { 3: 2, 4: 1 }) : val(r, { 1: 1, 2: 6, 3: 3, 4: 2 });
  const mkNet = () => {
    const base = Math.round(lat * (0.4 + 0.8 * r.float()));
    return { base, jitter: Math.round(base * (0.3 + 1.7 * r.float())), spikeP: 0.01,
      faultRate: fault ? +(fault * (0.5 + r.float())).toFixed(3) : 0, faultMix: { drop: 1, lost: 1.5, e5xx: 1, slow: 0.7 } };
  };
  const tight = kind === 'ladder' ? r.pickW({ tight: 2, medium: 1, wide: 1 }) : 'n/a';
  for (let i = 0; i < n; i++) {
    const skew = (r.chance(skewP) && skewMax) ? Math.round((r.chance(0.5) ? 1 : -1) * skewMax * (0.3 + 0.7 * r.float())) : 0;
    spec.players.push({
      label: 'P' + i, uid: 'k' + i + 'x' + (seed % 9973), name: NAMES[i], rating: 1000, skew,
      net: mkNet(), partitions: [], freezes: [], reloads: [], sessionFailP: r.chance(prof.sessionP) ? 0.35 : 0,
      kid: { pCorrect: +(0.45 + 0.5 * r.float()).toFixed(2), minMs: r.int(1200, 3500), maxMs: r.int(5000, 15000), slowP: +(0.15 * r.float()).toFixed(2) },
      again: { p: 0.3, p2: 0.6, max: 2 }, intents: [], ladderer: false, afterReload: null
    });
  }
  const P = spec.players;
  if (kind === 'rooms' || kind === 'rooms2') {
    const hosts = kind === 'rooms2' ? [P[0], P[1]] : [P[0]];
    for (const h of hosts) {
      const priv = r.chance(prof.privateP);
      h.rating = 1000 + r.int(-300, 300);
      h.intents.push({ at: r.int(0, 1500), act: 'create', mode: val(r, prof.modes, 'C'), private: priv, wordCount: val(r, prof.wordCount, 10) });
      h.isHost = true; h.private = priv;
      if (r.chance(0.08)) h.intents.push({ at: r.int(2000, 45000), act: 'closeWaiting' });
      if (r.chance(0.06)) h.intents.push({ at: r.int(20000, 160000), act: 'leave' });
    }
    let prevJoin = null;
    for (const g of P.filter((x) => !x.isHost)) {
      g.rating = 1000 + r.int(-300, 300);
      const h = kind === 'rooms2' ? r.pick(hosts) : hosts[0];
      const when = r.pickW({ immediate: 3, simultaneous: prevJoin == null ? 0 : 2, late: 2 });
      let at = when === 'immediate' ? r.int(1500, 4000) : when === 'simultaneous' ? prevJoin + r.int(0, 250) : r.int(10000, 95000);
      prevJoin = at;
      const via = h.private ? 'code' : 'list';
      if (via === 'code') at = Math.max(at, 8000 + r.int(0, 4000));   /* the friend has to get the code over WeChat and type it */
      g.intents.push({ at, act: 'join', via, target: kind === 'rooms2' && r.chance(0.4) && via === 'list' ? null : h.label, pick: r.chance(0.5) ? 'random' : 'first', tries: r.int(2, 5) });
      if (r.chance(0.12)) g.intents.push({ at: at + r.int(300, 9000), act: 'cancelJoin' });
      if (r.chance(0.06)) g.intents.push({ at: r.int(20000, 160000), act: 'leave' });
      g.afterReload = r.chance(0.5) ? { at: 0, act: 'join', via, target: h.label, pick: 'first', tries: 3 } : null;
    }
  } else {
    const spread = tight === 'tight' ? 3000 : tight === 'medium' ? 25000 : 70000;
    const base = r.int(0, 1000);
    for (const p of P) {
      p.ladderer = true;
      p.rating = tight === 'tight' ? 1000 + r.int(-50, 50) : 1000 + r.int(-250, 250);
      p.intents.push({ at: base + r.int(0, spread), act: 'ladder' });
      if (r.chance(0.07)) p.intents.push({ at: r.int(5000, 100000), act: 'leave' });
      p.afterReload = r.chance(0.7) ? { at: 0, act: 'ladder' } : null;
    }
  }
  /* disruptions */
  for (const p of P) {
    if (!r.chance(prof.disruptP)) continue;
    const what = r.pickW({ reload: 3, freeze: 3.5, partition: 3.5 });
    const at = r.int(4000, 150000);
    const dur = r.pickW({ s: 1, l: 1 }) === 's' ? r.int(3000, 20000) : r.int(45000, 110000);
    if (what === 'reload') p.reloads.push({ at, delay: r.int(1500, 6000) });
    else if (what === 'freeze') p.freezes.push({ at, dur });
    else p.partitions.push({ a: at, b: at + dur, mode: r.pick(['fast', 'hang']) });
  }
  if (r.chance(prof.outageP)) { const a = r.int(5000, 120000); spec.outages.push({ a, b: a + r.int(5000, 80000), mode: r.pick(['fast', 'hang']) }); }
  /* same account on a second device (siblings sharing a parent's phone number) that just browses the lobby */
  if (r.chance(prof.twinP) && P.length) {
    const o = P[0];
    const tw = JSON.parse(JSON.stringify(o));
    tw.label = 'P0b'; tw.twinOf = 'P0'; tw.intents = []; tw.ladderer = false; tw.isHost = false; tw.afterReload = null;
    tw.reloads = []; tw.freezes = []; tw.partitions = [];
    tw.skew = o.skew + Math.round((r.chance(0.5) ? 1 : -1) * r.range(60000, 600000));
    for (let k = 0; k < 6; k++) tw.intents.push({ at: r.int(2000, 170000), act: 'browse' });
    P.push(tw);
  }
  if (adv) {
    const b = { start: r.int(0, 20000), period: r.int(2000, 5000) };
    if (r.chance(0.45)) b.flood = { n: r.int(5, 45), created: r.pick(['old', 'future']), forge: r.chance(0.3) };
    if (r.chance(0.45)) b.squatSeats = { depth: r.int(1, 3), acked: r.chance(0.5), forge: r.chance(0.5), beat: r.chance(0.5) };
    if (r.chance(0.45)) b.squatWins = true;
    if (r.chance(0.3)) b.forgeHost = true;
    if (!b.flood && !b.squatSeats && !b.squatWins && !b.forgeHost) b.squatWins = true;
    spec.adversary = { uid: 'adv' + (seed % 977), name: '捣蛋鬼', rating: 1000, skew: 0, net: mkNet(), adv: b };
  }
  return spec;
}

/* ── shrinking: candidate simplifications of a spec (each returns a new spec or null) ── */
export function shrinkSteps(spec) {
  const C = [];
  const cp = () => JSON.parse(JSON.stringify(spec));
  if (spec.adversary) C.push(['drop adversary', () => { const s = cp(); s.adversary = null; return s; }]);
  if (spec.adversary) for (const k of ['flood', 'squatSeats', 'squatWins', 'forgeHost']) if (spec.adversary.adv[k]) C.push(['adversary without ' + k, () => { const s = cp(); delete s.adversary.adv[k]; return s; }]);
  if ((spec.outages || []).length) C.push(['drop outages', () => { const s = cp(); s.outages = []; return s; }]);
  spec.players.forEach((p, i) => {
    C.push(['drop player ' + p.label, () => { const s = cp(); s.players.splice(i, 1); return s; }]);
  });
  spec.players.forEach((p, i) => {
    for (const k of ['reloads', 'freezes', 'partitions']) if ((p[k] || []).length) C.push([p.label + ' no ' + k, () => { const s = cp(); s.players[i][k] = []; return s; }]);
    if (p.skew) C.push([p.label + ' skew 0', () => { const s = cp(); s.players[i].skew = 0; return s; }]);
    if (p.skew && Math.abs(p.skew) > 2000) C.push([p.label + ' skew /2', () => { const s = cp(); s.players[i].skew = Math.round(p.skew / 2); return s; }]);
    if (p.net && p.net.faultRate) C.push([p.label + ' no faults', () => { const s = cp(); s.players[i].net.faultRate = 0; return s; }]);
    if (p.net && (p.net.base > 5 || p.net.jitter > 5)) C.push([p.label + ' fast net', () => { const s = cp(); s.players[i].net.base = 5; s.players[i].net.jitter = 5; s.players[i].net.spikeP = 0; return s; }]);
    if (p.sessionFailP) C.push([p.label + ' no session faults', () => { const s = cp(); s.players[i].sessionFailP = 0; return s; }]);
    (p.intents || []).forEach((it, j) => {
      if (it.act !== 'create' && it.act !== 'join' && it.act !== 'ladder') C.push([p.label + ' drop intent ' + it.act, () => { const s = cp(); s.players[i].intents.splice(j, 1); return s; }]);
      if (it.wordCount && it.wordCount > 1) C.push([p.label + ' fewer words', () => { const s = cp(); s.players[i].intents[j].wordCount = Math.max(1, Math.floor(it.wordCount / 2)); return s; }]);
    });
    if (p.afterReload) C.push([p.label + ' no afterReload', () => { const s = cp(); s.players[i].afterReload = null; return s; }]);
    if (p.again && p.again.max) C.push([p.label + ' no again', () => { const s = cp(); s.players[i].again = { p: 0, p2: 0, max: 0 }; return s; }]);
    if (p.kid && p.kid.slowP) C.push([p.label + ' kid not slow', () => { const s = cp(); s.players[i].kid.slowP = 0; return s; }]);
  });
  if (spec.db.lagMax) {
    C.push(['no lag', () => { const s = cp(); s.db.lagMax = 0; s.db.queryLagExtra = 0; return s; }]);
    C.push(['lag /2', () => { const s = cp(); s.db.lagMax = Math.round(s.db.lagMax / 2); return s; }]);
  }
  if (spec.db.queryLagExtra) C.push(['no extra query lag', () => { const s = cp(); s.db.queryLagExtra = 0; return s; }]);
  if (spec.db.orderByFail) C.push(['orderBy ok', () => { const s = cp(); s.db.orderByFail = false; return s; }]);
  if (spec.db.dupMode !== 'request_failed') C.push(['dupMode request_failed', () => { const s = cp(); s.db.dupMode = 'request_failed'; return s; }]);
  if (spec.db.ryw) C.push(['no ryw', () => { const s = cp(); s.db.ryw = false; return s; }]);
  return C;
}

export function specSize(spec) {
  let n = spec.players.length * 10 + (spec.adversary ? 15 : 0) + (spec.outages || []).length * 3 + (spec.db.lagMax ? 3 : 0);
  for (const p of spec.players) {
    n += (p.reloads || []).length * 3 + (p.freezes || []).length * 3 + (p.partitions || []).length * 3 + (p.skew ? 2 : 0)
      + (p.net && p.net.faultRate ? 2 : 0) + (p.intents || []).length;
    for (const it of p.intents || []) n += (it.wordCount || 0) / 3;
  }
  return n;
}
