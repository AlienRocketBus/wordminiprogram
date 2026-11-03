#!/usr/bin/env node
/* shrink_reps.mjs — for every root-cause group in <outDir>/clusters.json pick its most frequent base signature,
 * replay up to 6 seeds of the profile it was seen in, shrink it, and save the minimal spec + trace.
 *   node shrink_reps.mjs <repoDir> <outDir> [rootRegex]
 * Runs fuzz.mjs as child processes ONE AT A TIME (pid file <outDir>/min/child.pid). */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [repo, outDir, rootRe] = process.argv.slice(2);
const C = JSON.parse(fs.readFileSync(path.join(outDir, 'clusters.json'), 'utf8'));
const minDir = path.join(outDir, 'min');
fs.mkdirSync(minDir, { recursive: true });
fs.writeFileSync(path.join(minDir, 'shrink.pid'), String(process.pid));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const g of C.groups) {
  if (rootRe && !new RegExp(rootRe).test(g.root)) continue;
  const base = g.sigs.filter((s) => !s.sig.startsWith('I9:') && !/^I8:adv-caused:/.test(s.sig)).sort((a, b) => (rank(a.sev) - rank(b.sev)) || (b.count - a.count));
  if (!base.length) continue;
  const s = base[0];
  const byProf = {};
  for (const x of s.seeds) { const [p, sd] = x.split(':'); (byProf[p] = byProf[p] || []).push(sd); }
  const prof = Object.keys(byProf).sort((a, b) => byProf[b].length - byProf[a].length)[0];
  const seeds = byProf[prof].slice(0, 6).join(',');
  const args = [path.join(here, 'fuzz.mjs'), repo, '--profile', prof, '--seed-list', seeds, '--only', '^' + esc(s.sig) + '$', '--shrink', '--shrink-budget', '45', '--max-clusters', '1', '--out', path.join(minDir, g.root)];
  const t = Date.now();
  const r = await new Promise((res) => {
    const ch = spawn(process.execPath, args);
    fs.writeFileSync(path.join(minDir, 'child.pid'), String(ch.pid));
    let so = '', se = '';
    ch.stdout.on('data', (d) => { so += d; });
    ch.stderr.on('data', (d) => { se += d; });
    ch.on('close', () => res({ stdout: so, stderr: se }));
  });
  const txt = '# ' + g.root + ' — representative ' + s.sig + ' (profile ' + prof + ', seeds ' + seeds + ')\n# node ' + args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ') + '\n\n' + (r.stdout || '') + (r.stderr || '');
  fs.writeFileSync(path.join(minDir, g.root + '.txt'), txt);
  console.log(g.root.padEnd(36) + ' ' + s.sig.padEnd(70) + ' ' + ((Date.now() - t) / 1000).toFixed(0) + 's');
}
function rank(s) { return s === 'high' ? 0 : s === 'medium' ? 1 : 2; }
