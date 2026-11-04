#!/usr/bin/env node
/* fuzz.mjs — randomized, seeded soak/fuzz harness for the online-battle protocol (hansen_pk_room_v1065.js).
 *
 *   node fuzz.mjs <repoDir> [--profile ci] [--seeds N] [--from S] [--seed S] [--spec file.json]
 *                           [--shrink | --no-shrink] [--out dir] [--strict] [--quiet] [--trace]
 *
 *   <repoDir>      directory that contains hansen_pk_room_v1065.js (the code under test; never modified)
 *   --profile      clean | smoke | ci | lag | faults | skew | ladder | adversary | disrupt | chaos | sweep
 *   --seeds N      number of runs (default: the profile's); seeds are --from .. --from+N-1 (default --from 1)
 *   --seed S       run one seed and print its full trace
 *   --spec F       replay a scenario spec (e.g. a shrunk one written to --out)
 *   --shrink       shrink one failing seed per cluster (default on for multi-seed runs; --no-shrink to skip)
 *   --strict       low-severity violations also make the exit code non-zero
 *   --out D        write report.json, clusters.txt and the minimal specs into D
 *
 * Exit code: 0 = no violations (of severity high/medium, or any with --strict), 1 = violations, 2 = usage/harness error.
 * Everything is virtual time: a 3-minute match runs in well under a second; one process, one core.
 */
import fs from 'node:fs';
import path from 'node:path';
import { runSpec } from './lib/run.mjs';
import { checkWorld } from './lib/checks.mjs';
import { genSpec, profileCfg, shrinkSteps, specSize, PROFILES } from './lib/scenario.mjs';
import { T0, loadUiFlags } from './lib/world.mjs';

const argv = process.argv.slice(2);
const opt = { profile: 'ci', shrink: null, strict: false, quiet: false, trace: false, from: 1 };
let repoDir = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => argv[++i];
  if (a === '--profile') opt.profile = next();
  else if (a === '--seeds') opt.seeds = Number(next());
  else if (a === '--from') opt.from = Number(next());
  else if (a === '--seed') opt.seed = Number(next());
  else if (a === '--spec') opt.spec = next();
  else if (a === '--shrink') opt.shrink = true;
  else if (a === '--no-shrink') opt.shrink = false;
  else if (a === '--out') opt.out = next();
  else if (a === '--strict') opt.strict = true;
  else if (a === '--quiet') opt.quiet = true;
  else if (a === '--trace') opt.trace = true;
  else if (a === '--shrink-budget') opt.shrinkBudget = Number(next());
  else if (a === '--max-clusters') opt.maxClusters = Number(next());
  else if (a === '--seed-list') opt.seedList = next().split(',').map(Number);
  else if (a === '--only') opt.only = new RegExp(next());
  else if (a === '--no-hide') opt.noHide = true;      /* no 'page hidden, JS running' disruptions (as in the first soak round) */
  else if (a === '--regress') opt.regress = next();   /* directory of regression specs (one real bug each), run after the profile */
  else if (a === '--no-regress') opt.regress = '';
  else if (a === '-h' || a === '--help') { usage(0); }
  else if (!repoDir && !a.startsWith('--')) repoDir = a;
  else { console.error('unknown argument ' + a); usage(2); }
}
function usage(code) {
  console.log('usage: node fuzz.mjs <repoDir> [--profile ' + Object.keys(PROFILES).join('|') + '] [--seeds N] [--from S] [--seed S] [--spec file] [--shrink|--no-shrink] [--out dir] [--strict] [--quiet]');
  process.exit(code);
}
if (!repoDir) usage(2);
repoDir = path.resolve(repoDir);
if (!fs.existsSync(path.join(repoDir, 'hansen_pk_room_v1065.js'))) { console.error('no hansen_pk_room_v1065.js in ' + repoDir); process.exit(2); }

let CUR = null;   /* world being run (unhandled rejections from module code are attributed to it) */
process.on('unhandledRejection', (e) => { if (CUR) CUR.errors.push({ t: CUR.now, who: '?', where: 'unhandledRejection', msg: String(e && e.stack || e).slice(0, 800) }); });

const rel = (t) => ((t - T0) / 1000).toFixed(1);
/* regression scenarios: {name, bug, spec} — the bundled test embeds them (REGRESS_SPECS); otherwise read --regress DIR */
const REGRESS_SPECS = [];
function regressList() {
  if (REGRESS_SPECS.length && opt.regress !== '') return REGRESS_SPECS;
  if (!opt.regress) return [];
  return fs.readdirSync(opt.regress).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const j = JSON.parse(fs.readFileSync(path.join(opt.regress, f), 'utf8'));
    return j.spec ? j : { name: f.replace(/\.json$/, ''), bug: '', spec: j };
  });
}
async function runRegress() {
  const L = regressList();
  if (!L.length) return 0;
  console.log('\n══ regression scenarios (' + L.length + ') ══');
  let bad = 0;
  for (const r of L) {
    let res;
    try { res = await runOne(r.spec); } catch (e) { console.log('  HARNESS ERROR ' + r.name + ': ' + (e && e.stack || e)); bad++; continue; }
    const f = res.V.filter(FAILSEV);
    if (f.length) bad++;
    console.log('  ' + (f.length ? 'FAIL' : 'ok  ') + '  ' + r.name.padEnd(44) + (r.bug ? ' [' + r.bug + ']' : '') + (f.length ? '  ' + [...new Set(f.map((v) => v.sig))].slice(0, 3).join(', ') : ''));
  }
  console.log('REGRESS ' + (L.length - bad) + '/' + L.length + ' ok');
  return bad;
}
const FAILSEV = (v) => opt.strict || v.sev !== 'low';

async function play(spec, probe) {
  const W = await (async () => {
    const p = runSpec(spec, { repoDir, probe, hooks: { onWorld: (w) => { CUR = w; } } });
    return p;
  })();
  CUR = null;
  return W;
}
function settledPairs(W) {
  let n = 0;
  const H = W.players.filter((p) => p.honest && !p.twinOf);
  for (const P of H) for (const m of P.matches) {
    if (m.side !== 'host' || !m.result) continue;
    const G = H.find((x) => x.key === m.oppKey);
    const mg = G && G.matches.find((x) => x.roomId === m.roomId && x.side === 'guest');
    if (mg && mg.result) n++;
  }
  return n;
}
function stripSkew(spec) {
  const s = JSON.parse(JSON.stringify(spec));
  for (const p of s.players) p.skew = 0;
  return s;
}
function hasSkew(spec) { return spec.players.some((p) => p.skew); }
function noAdv(spec) { const s = JSON.parse(JSON.stringify(spec)); s.adversary = null; return s; }

/* one run + the two differential checks */
async function runOne(spec, o = {}) {
  const W = await play(spec, o.probe);
  let V = checkWorld(W);
  const stats = { matches: 0, settled: settledPairs(W), events: W.nEvents, vt: (W.tEnd - T0) / 1000 };
  for (const P of W.players) stats.matches += P.matches.filter((m) => m.side === 'host').length;
  stats.settledAny = 0;
  for (const P of W.players) stats.settledAny += P.matches.filter((m) => m.result).length;
  if (!o.noDiff) {
    if (V.length && hasSkew(spec)) {
      const base = new Set();
      for (const salt of ['a', 'b', 'c']) for (const v of checkWorld(await play(Object.assign(stripSkew(spec), { salt })))) base.add(v.sig);
      for (const v of V.slice()) if (!base.has(v.sig) && v.inv !== 'I9' && v.inv !== 'I8') V.push(Object.assign({}, v, { inv: 'I9', sig: 'I9:' + v.sig, msg: '(only with clock skew: absent in 3 re-runs with all clocks equal) ' + v.msg }));
    }
    if (spec.adversary) {
      const W1 = await play(noAdv(spec));
      const V1 = checkWorld(W1);
      /* the fewest honest matches settled across the 3 adversary-free re-runs (one re-run alone is noisy ±1) */
      let s1 = settledPairs(W1);
      for (const salt of ['a', 'b']) { const Wx = await play(Object.assign(noAdv(spec), { salt })); s1 = Math.min(s1, settledPairs(Wx)); for (const v of checkWorld(Wx)) V1.push(v); }
      /* seat squatting = a logged-in griefer sitting in public seats: the open-seat design cannot prevent it client-side
         (classified low, design limitation); anything else (flood, forged rooms, squatted round ids) must not block matches */
      const aa = spec.adversary.adv || {};
      const squat = !!(aa.squatSeats || (aa.squatWins && aa.squatWins.depth >= 3));   /* seat squatting / every round id squatted: inherent DoS */
      /* the adversary's docs also perturb honest timing (sweeps of forged docs cost requests): only a block that holds
         in 3 adversary runs (salts) against the 3 adversary-free runs counts */
      let sAdv = stats.settled;
      if (s1 > sAdv) for (const salt of ['a', 'b']) sAdv = Math.max(sAdv, settledPairs(await play(Object.assign(JSON.parse(JSON.stringify(spec)), { salt }))));
      if (s1 > sAdv) V.push({ inv: 'I8', sig: 'I8:' + (stats.settled === 0 ? 'matchmaking-blocked' : 'fewer-matches-settled') + (squat ? ':seat-squatting' : ''),
        sev: squat ? 'low' : stats.settled === 0 ? 'high' : 'medium', who: 'ADV', t: W.tEnd,
        msg: 'with the adversary ' + stats.settled + ' honest match(es) settled, without it ' + s1 });
      const base = new Set(V1.map((v) => v.sig));
      for (const v of V.slice()) if (!base.has(v.sig) && v.inv !== 'I8' && v.inv !== 'I9' && v.inv !== 'I2') V.push(Object.assign({}, v, { inv: 'I8', sig: 'I8:adv-caused:' + v.sig, msg: '(only with the adversary: absent in 3 re-runs without it) ' + v.msg }));
    }
  }
  return { W, V, stats };
}

function specLine(spec) {
  const p = spec.players.map((x) => x.label + '{' + [x.isHost ? 'host' : '', x.ladderer ? 'ladder' : '', x.twinOf ? 'twin' : '',
    x.skew ? 'skew' + Math.round(x.skew / 1000) + 's' : '', x.net && x.net.faultRate ? 'f' + x.net.faultRate : '', 'lat' + (x.net ? x.net.base : 0),
    (x.reloads || []).length ? 'reload' : '', (x.freezes || []).length ? 'freeze' : '', (x.partitions || []).length ? 'offline' : '', (x.hides || []).length ? 'hide' : '', x.sessionFailP ? 'sess' : '']
    .filter(Boolean).join(',') + '}').join(' ');
  return 'seed ' + spec.seed + ' ' + spec.profile + ' ' + spec.kind + ' lag' + spec.db.lagMax + '/' + spec.db.lagMode + (spec.db.ryw ? '+ryw' : '') + ' dup=' + spec.db.dupMode
    + ' perm=' + spec.db.permMode + (spec.db.orderByFail ? ' noIndex' : '') + ((spec.outages || []).length ? ' outage' : '') + (spec.adversary ? ' ADV' + JSON.stringify(spec.adversary.adv) : '') + ' | ' + p;
}

/* trace + op-log excerpt around a violation */
function excerpt(W, v, spec) {
  const out = [];
  out.push('    scenario: ' + JSON.stringify(compactSpec(spec)));
  out.push('    violation [' + v.sev + '] ' + v.sig + ' @' + rel(v.t) + 's ' + v.who + ': ' + v.msg);
  const rooms = new Set((v.msg.match(/r[0-9a-z]{8,}/g) || []));
  const lo = v.t - 90000, hi = v.t + 30000;
  out.push('    ── event trace (virtual seconds) ──');
  let n = 0;
  for (const e of W.trace) {
    if (e.t < lo || e.t > hi) continue;
    if (/roundState|opponentGone/.test(e.msg) && !/FAIL/.test(e.msg)) continue;
    out.push('    ' + rel(e.t).padStart(7) + '  ' + e.who.padEnd(6) + ' ' + e.msg);
    if (++n > 160) { out.push('    …'); break; }
  }
  if (rooms.size) {
    out.push('    ── op log for ' + [...rooms].join(', ') + ' ──');
    let k = 0;
    for (const r of W.ops) {
      const id = r.id || '';
      const hit = [...rooms].some((x) => id.startsWith(x) || (r.cond && JSON.stringify(r.cond).includes(x)));
      if (!hit) continue;
      if (r.op === 'get' && r.res === 'hit' && !r.fault && k > 60) continue;
      out.push('    ' + rel(r.t0).padStart(7) + (r.tA ? '→' + rel(r.tA) : '        ') + '  ' + r.who.padEnd(6) + ' ' + r.op.padEnd(6) + ' ' + id.padEnd(22) + ' '
        + (r.res || '') + (r.lag ? ' lag' + r.lag : '') + (r.fault ? ' FAULT:' + r.fault : '') + (r.data ? ' ' + JSON.stringify(r.data).slice(0, 110) : '')
        + (r.doc ? ' ' + JSON.stringify(pick(r.doc, ['kind', 'status', 'guestId', 'seat', 'epoch', 'winner', 'by', 'acked'])).slice(0, 110) : ''));
      if (++k > 140) { out.push('    …'); break; }
    }
  }
  return out.join('\n');
}
function pick(o, ks) { const r = {}; for (const k of ks) if (o && o[k] !== undefined) r[k] = o[k]; return r; }
function compactSpec(s) {
  return { seed: s.seed, kind: s.kind, db: s.db, outages: s.outages, adversary: s.adversary && s.adversary.adv,
    players: s.players.map((p) => ({ label: p.label, skew: p.skew, rating: p.rating, net: p.net && { base: p.net.base, jitter: p.net.jitter, faultRate: p.net.faultRate },
      intents: p.intents, reloads: p.reloads, freezes: p.freezes, partitions: p.partitions, hides: p.hides, kid: p.kid, sessionFailP: p.sessionFailP || undefined, twinOf: p.twinOf })) };
}

async function shrinkFor(spec, sig, budget) {
  const isI9 = sig.startsWith('I9:'), isI8 = sig.startsWith('I8:');
  const baseSig = isI9 ? sig.slice(3) : sig;
  const fails = async (s) => {
    if (isI9) {
      if (!hasSkew(s)) return false;
      const a = checkWorld(await play(s));
      if (!a.some((v) => v.sig === baseSig)) return false;
      const b = checkWorld(await play(stripSkew(s)));
      return !b.some((v) => v.sig === baseSig);
    }
    const r = await runOne(s, { noDiff: !isI8 });
    return r.V.some((v) => v.sig === sig);
  };
  let best = spec, runs = 0, improved = true;
  const steps = [];
  while (improved && runs < budget) {
    improved = false;
    for (const [desc, mk] of shrinkSteps(best)) {
      if (runs >= budget) break;
      const cand = mk();
      if (!cand || specSize(cand) >= specSize(best)) continue;
      runs++;
      if (await fails(cand)) { best = cand; improved = true; steps.push(desc); break; }
    }
  }
  return { best, runs, steps };
}

async function main() {
  const prof = profileCfg(opt.profile);
  if (opt.noHide) prof.hideW = 0;
  if (opt.spec || opt.seed != null) {
    let spec = opt.spec ? JSON.parse(fs.readFileSync(opt.spec, 'utf8')) : genSpec(opt.seed, prof);
    if (spec && spec.spec && spec.name) spec = spec.spec;   /* a regression file {name, bug, spec} */
    const t = Date.now();
    const { W, V, stats } = await runOne(spec, { probe: true });
    console.log(specLine(spec));
    console.log('virtual ' + stats.vt.toFixed(0) + 's, ' + stats.events + ' events, ' + (Date.now() - t) + ' ms real; matches ' + stats.matches + ', settled pairs ' + stats.settled);
    if (opt.trace) for (const e of W.trace) console.log(rel(e.t).padStart(7) + '  ' + e.who.padEnd(6) + ' ' + e.msg);
    for (const v of V) console.log(excerpt(W, v, spec));
    const bad = V.filter(FAILSEV);
    console.log('SUMMARY runs=1 violations=' + V.length + ' failing=' + bad.length);
    uiPortNote();
    process.exit(bad.length ? 1 : 0);
  }
  const N = opt.seedList ? opt.seedList.length : (opt.seeds != null ? opt.seeds : prof.runs);
  const t0 = Date.now();
  const clusters = new Map();   /* sig → {inv, sev, count, seeds[], best:{spec,size}, msg} */
  const perInv = {};
  const failingSeeds = [];
  let failingRuns = 0, totalMatches = 0, totalSettled = 0, totalEvents = 0, totalVt = 0;
  for (let k = 0; k < N; k++) {
    const seed = opt.seedList ? opt.seedList[k] : opt.from + k;
    const spec = genSpec(seed, prof);
    let res;
    try { res = await runOne(spec); }
    catch (e) { console.error('HARNESS ERROR seed ' + seed + ': ' + (e && e.stack || e)); process.exit(2); }
    const { V, stats } = res;
    totalMatches += stats.matches; totalSettled += stats.settled; totalEvents += stats.events; totalVt += stats.vt;
    const seen = new Set(), seenInv = new Set();
    for (const v of V) {
      if (seen.has(v.sig)) continue;
      seen.add(v.sig);
      if (!seenInv.has(v.inv)) { seenInv.add(v.inv); perInv[v.inv] = (perInv[v.inv] || 0) + 1; }
      let c = clusters.get(v.sig);
      if (!c) { c = { sig: v.sig, inv: v.inv, sev: v.sev, count: 0, seeds: [], best: null, msg: v.msg }; clusters.set(v.sig, c); }
      c.count++;
      if (c.seeds.length < 12) c.seeds.push(seed);
      const sz = specSize(spec);
      if (!c.best || sz < c.best.size) c.best = { spec, size: sz, msg: v.msg };
    }
    if (V.some(FAILSEV)) { failingRuns++; failingSeeds.push({ seed, sigs: [...new Set(V.filter(FAILSEV).map((v) => v.sig))] }); }
    if (!opt.quiet && (k + 1) % 50 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log('… ' + (k + 1) + '/' + N + ' runs, ' + failingRuns + ' failing, ' + clusters.size + ' clusters, ' + el.toFixed(0) + 's');
    }
  }
  const elapsed = (Date.now() - t0) / 1000;
  const cl = [...clusters.values()].sort((a, b) => (sevRank(a.sev) - sevRank(b.sev)) || (b.count - a.count));
  console.log('\n══ clusters (' + cl.length + ') ══');
  for (const c of cl) console.log('  [' + c.sev.padEnd(6) + '] ' + String(c.count).padStart(4) + '× ' + c.sig + '   seeds ' + c.seeds.slice(0, 6).join(',') + '\n           e.g. ' + c.msg.slice(0, 220));
  const doShrink = opt.shrink == null ? true : opt.shrink;
  const minimal = [];
  if (doShrink && cl.length) {
    console.log('\n══ shrinking one seed per cluster ══');
    const maxC = opt.maxClusters || 40;
    for (const c of cl.filter((x) => !opt.only || opt.only.test(x.sig)).slice(0, maxC)) {
      const { best, runs, steps } = await shrinkFor(c.best.spec, c.sig, opt.shrinkBudget || 60);
      const r = await runOne(best, { probe: true, noDiff: !c.sig.startsWith('I8:') });
      let v = r.V.find((x) => x.sig === c.sig) || r.V.find((x) => c.sig.startsWith('I9:') && x.sig === c.sig.slice(3));
      console.log('\n── ' + c.sig + ' (' + c.count + ' runs) — minimal after ' + runs + ' shrink runs: ' + specLine(best));
      console.log('   removed: ' + (steps.join('; ') || '(nothing)'));
      if (v) console.log(excerpt(r.W, v, best));
      else console.log('   (violation did not reproduce on the minimal spec — flaky under differential? original seed ' + c.best.spec.seed + ')');
      minimal.push({ sig: c.sig, inv: c.inv, sev: c.sev, count: c.count, seeds: c.seeds, spec: best, steps });
      if (opt.out) {
        fs.mkdirSync(opt.out, { recursive: true });
        fs.writeFileSync(path.join(opt.out, 'min_' + c.sig.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 80) + '.json'), JSON.stringify(best, null, 1));
      }
    }
  }
  const bad = cl.filter((c) => opt.strict || c.sev !== 'low');
  const invs = ['ERR', 'I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9', 'I10'].map((i) => i + ':' + (perInv[i] || 0)).join(' ');
  const summary = 'SUMMARY profile=' + prof.name + ' runs=' + N + ' seeds=' + opt.from + '..' + (opt.from + N - 1) + ' failing_runs=' + failingRuns
    + ' clusters=' + cl.length + ' (fail-level ' + bad.length + ') | runs-with-violation per invariant: ' + invs
    + ' | matches=' + totalMatches + ' settled_pairs=' + totalSettled + ' virtual=' + (totalVt / 3600).toFixed(1) + 'h events=' + totalEvents + ' real=' + elapsed.toFixed(0) + 's';
  console.log('\n' + summary);
  uiPortNote();
  const regressBad = await runRegress();
  if (opt.out) {
    fs.mkdirSync(opt.out, { recursive: true });
    fs.writeFileSync(path.join(opt.out, 'report.json'), JSON.stringify({ summary, profile: prof.name, runs: N, from: opt.from, perInv, failingRuns, failingSeeds,
      clusters: cl.map((c) => ({ sig: c.sig, inv: c.inv, sev: c.sev, count: c.count, seeds: c.seeds, example: c.msg })), minimal }, null, 1));
  }
  process.exit((bad.length || regressBad) ? 1 : 0);
}
function sevRank(s) { return s === 'high' ? 0 : s === 'medium' ? 1 : 2; }
/* the UI is a port (lib/ui_r1.mjs, 3b6bbd7): say which reviewed UI fixes were detected and whether ported functions changed */
function uiPortNote() {
  try {
    const src = fs.readFileSync(path.join(repoDir, 'hansen_pk_room_v1065.js'), 'utf8');
    if (!/settleRound/.test(src)) return;   /* pre-round-1 protocol: the 47a97f9 port (lib/ui.mjs) is used */
    const f = loadUiFlags(repoDir);
    console.log('UI port: 56b8146 control flow (a model of the page); fixes detected in the repo UI: ' + (['abandonSure', 'finishSettles', 'failedPending', 'neverCameGuard', 'neverCameGuardPoll', 'pendingKept', 'timeCap', 'resumeCheck', 'settleWhileOffline', 'claimBack'].filter((k) => f[k]).join(', ') || 'none'));
    if (f.changed && f.changed.length) console.log('WARNING: ported UI functions differ from the version the port was checked against (56b8146 + 联机压力测试 fixes) — re-check lib/ui_r1.mjs: ' + f.changed.join(', '));
  } catch (e) {}
}

main().catch((e) => { console.error('HARNESS ERROR ' + (e && e.stack || e)); process.exit(2); });
