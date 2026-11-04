/* attribute.mjs — which real bug explains each failing seed?
 *
 *   node attribute.mjs <fixed-out-dir> <out.json> [patchedDir] [mutantsRoot]
 *   (defaults: ../soak_patched and ../mutants next to this directory; mutantsRoot holds the M_* dirs built by mutants.py)
 *
 * For every profile in <fixed-out-dir> (a soak_all.sh output on 3b6bbd7), take the seeds that failed
 * (fail-level = high/medium), replay exactly those seeds on
 *   · soak_patched   (all proposed fixes)              → should pass; a seed that still fails is a residual
 *   · mutants/M_Rx   (all fixes except Rx = only Rx)    → fails ⇒ bug Rx alone reproduces a fail-level
 *                                                          violation in that scenario
 * One fuzz.mjs process per (profile, variant), run one after another (one heavy process at a time).
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const S = path.resolve(HERE, '..');
const [fixedOut, outJson, patchedArg, mutArg] = process.argv.slice(2);
if (!fixedOut || !outJson) { console.error('usage: node attribute.mjs <fixed-out-dir> <out.json> [patchedDir] [mutantsRoot]'); process.exit(2); }
const PATCHED = path.resolve(patchedArg || path.join(S, 'soak_patched')), MUTROOT = path.resolve(mutArg || path.join(S, 'mutants'));
const PROFILES = ['clean', 'ci', 'lag', 'faults', 'skew', 'ladder', 'adversary', 'disrupt', 'chaos', 'sweep'];
/* every M_* directory mutants.py built (one fix taken out each) */
const MUT = (() => { try { return fs.readdirSync(MUTROOT).filter((d) => /^M_/.test(d)).map((d) => d.slice(2)).sort(); } catch (e) { return []; } })();
const VARIANTS = [['patched', PATCHED], ...MUT.map((m) => ['M_' + m, path.join(MUTROOT, 'M_' + m)])];

function failing(rep) {
  if (Array.isArray(rep.failingSeeds)) return rep.failingSeeds;
  /* older report.json without failingSeeds: union of the fail-level clusters' (≤12) seeds */
  const m = new Map();
  for (const c of rep.clusters || []) if (c.sev !== 'low') for (const s of c.seeds) { if (!m.has(s)) m.set(s, new Set()); m.get(s).add(c.sig); }
  return [...m].map(([seed, sigs]) => ({ seed, sigs: [...sigs], partial: true }));
}

const res = { fixedOut, profiles: {} };
const tmp = path.join(HERE, 'tmp_attr');
for (const prof of PROFILES) {
  const rp = path.join(fixedOut, prof, 'report.json');
  if (!fs.existsSync(rp)) continue;
  const rep = JSON.parse(fs.readFileSync(rp, 'utf8'));
  const fs0 = failing(rep);
  const P = res.profiles[prof] = { runs: rep.runs, failing: fs0.length, partial: fs0.some((x) => x.partial), seeds: {} };
  for (const x of fs0) P.seeds[x.seed] = { fixed: x.sigs, fails: {} };
  if (!fs0.length) continue;
  const list = fs0.map((x) => x.seed).join(',');
  for (const [name, dir] of VARIANTS) {
    fs.rmSync(tmp, { recursive: true, force: true });
    const t0 = Date.now();
    const r = spawnSync('node', [path.join(HERE, 'fuzz.mjs'), dir, '--profile', prof, '--seed-list', list, '--no-shrink', '--quiet', '--no-regress', '--out', tmp], { encoding: 'utf8', maxBuffer: 64 << 20 });
    let out = null;
    try { out = JSON.parse(fs.readFileSync(path.join(tmp, 'report.json'), 'utf8')); } catch (e) {}
    if (!out) { console.log(prof, name, 'NO REPORT rc=' + r.status, (r.stderr || '').slice(0, 300)); continue; }
    for (const y of out.failingSeeds || []) if (P.seeds[y.seed]) P.seeds[y.seed].fails[name] = y.sigs;
    console.log(prof.padEnd(9), name.padEnd(8), 'failing ' + (out.failingSeeds || []).length + '/' + fs0.length, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  fs.writeFileSync(outJson, JSON.stringify(res, null, 1));
}
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(outJson, JSON.stringify(res, null, 1));

/* summary: per seed, the mutants that fail; per bug, the seeds it explains */
const byBug = {};
let unexplained = [], residual = [];
for (const [prof, P] of Object.entries(res.profiles)) {
  for (const [seed, x] of Object.entries(P.seeds)) {
    const ms = Object.keys(x.fails).filter((k) => k.startsWith('M_')).map((k) => k.slice(2));
    if (x.fails.patched) residual.push(prof + ':' + seed + ' [' + x.fails.patched.join(' | ') + ']');
    if (!ms.length && !x.fails.patched) unexplained.push(prof + ':' + seed + ' [' + x.fixed.join(' | ') + ']');
    for (const m of ms) (byBug[m] = byBug[m] || []).push(prof + ':' + seed);
  }
}
console.log('\n== seeds explained per bug (the mutant with only that bug fails on the seed) ==');
for (const m of MUT) console.log(m.padEnd(4), String((byBug[m] || []).length).padStart(3), (byBug[m] || []).slice(0, 14).join(' '));
console.log('\n== still failing with all fixes (residual) ==\n' + (residual.join('\n') || '(none)'));
console.log('\n== failing on 3b6bbd7, but no single-bug mutant fails (needs ≥2 bugs together, or a timing butterfly) ==\n' + (unexplained.join('\n') || '(none)'));
