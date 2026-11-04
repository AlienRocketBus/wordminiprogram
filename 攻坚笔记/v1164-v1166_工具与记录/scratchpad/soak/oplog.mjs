/* oplog.mjs — print the op log (all ops touching ids with a prefix) + trace for one seed/spec: node oplog.mjs <repo> <profile> <seed> <idPrefix> [fromSec] [toSec] */
import { runSpec } from './lib/run.mjs';
import { genSpec, profileCfg } from './lib/scenario.mjs';
import { T0 } from './lib/world.mjs';
import fs from 'node:fs';
const [repo, prof, seedOrSpec, pre, a, b] = process.argv.slice(2);
const spec = fs.existsSync(seedOrSpec) ? JSON.parse(fs.readFileSync(seedOrSpec, 'utf8')) : genSpec(Number(seedOrSpec), profileCfg(prof));
const W = await runSpec(spec, { repoDir: repo, probe: false });
const rel = (t) => ((t - T0) / 1000).toFixed(1);
const lo = a ? T0 + Number(a) * 1000 : -Infinity, hi = b ? T0 + Number(b) * 1000 : Infinity;
const rows = [];
for (const r of W.ops) {
  if (r.t0 < lo || r.t0 > hi) continue;
  const id = r.id || '';
  const hit = !pre || id.startsWith(pre) || (r.cond && JSON.stringify(r.cond).includes(pre));
  if (!hit) continue;
  rows.push({ t: r.t0, s: rel(r.t0).padStart(7) + (r.tA ? '→' + rel(r.tA) : '       ') + (r.tR ? '→' + rel(r.tR) : '') + '  ' + r.who.padEnd(6) + ' ' + r.op.padEnd(6) + ' ' + id.padEnd(26) + ' ' + (r.res || '') + (r.lag != null ? ' lag' + r.lag : '') + (r.fault ? ' FAULT:' + r.fault : '') + (r.data ? ' ' + JSON.stringify(r.data).slice(0, 150) : '') + (r.doc ? ' ' + JSON.stringify(r.doc).slice(0, 150) : '') + (r.cond ? ' ' + JSON.stringify(r.cond).slice(0, 100) : '') });
}
for (const e of W.trace) if (e.t >= lo && e.t <= hi) rows.push({ t: e.t, s: rel(e.t).padStart(7) + '  ' + e.who.padEnd(6) + ' » ' + e.msg });
rows.sort((x, y) => x.t - y.t);
for (const r of rows) console.log(r.s);
