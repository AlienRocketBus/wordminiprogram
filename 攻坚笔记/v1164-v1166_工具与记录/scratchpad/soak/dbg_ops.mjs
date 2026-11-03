// usage: node dbg_ops.mjs <repoDir> <profile> <seed> <who> <fromSec> <toSec>
import { runSpec } from './lib/run.mjs';
import { genSpec, profileCfg } from './lib/scenario.mjs';
import { T0 } from './lib/world.mjs';
const [repo, prof, seed, who, a, b] = process.argv.slice(2);
const spec = genSpec(Number(seed), profileCfg(prof));
const W = await runSpec(spec, { repoDir: repo });
for (const r of W.ops) {
  const t = (r.t0 - T0) / 1000;
  if (t < Number(a) || t > Number(b)) continue;
  if (who !== '*' && !r.who.startsWith(who)) continue;
  console.log(t.toFixed(2), r.tA ? ((r.tA - T0) / 1000).toFixed(2) : '-', r.who, r.op, r.id, JSON.stringify(r.cond || ''), r.res, r.fault, r.lag || '', r.data ? JSON.stringify(r.data).slice(0, 120) : '', r.doc ? JSON.stringify(r.doc).slice(0, 160) : '');
}
