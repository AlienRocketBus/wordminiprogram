#!/usr/bin/env node
/* consolidate.mjs — merge out/<profile>/report.json into root-cause clusters.
 *   node consolidate.mjs <outDir>  → prints a table and writes <outDir>/clusters.json
 * The mapping signature → root cause is by regex (first match wins); unmatched signatures are listed as "other". */
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'out';
const ROOT = [
  ['A-dup-as-config', /I6:config:(joinRoom|claimRound|skipRound|createRoom):DATABASE_(REQUEST_FAILED|DUPLICATE_WRITE)|score-vs-rounds:(claim-failed|own-win-doc-landed-but-scored-0):config/],
  ['B-deadline-desync', /skip-beat-correct-answer:(A|BC)$/],
  ['C-deadline-skew', /skip-beat-correct-answer:(A|BC):skew|battle-too-long|clean-match-false-abandon:H:result-wait-idle/],
  ['D-checkStillThere-failed-check', /false-abandon:.*checkfail/],
  ['E-abandon-stale-read/both-win', /results-win-win|results-lose-lose|scores-not-mirrored/],
  ['F-skew-freshness', /gone-but-room-open:(findByCode|joinRoom):skew|no-convergence:skew|ghost-room-listed:host-clock-ahead|ack-timeout-host-alive:skew/],
  ['G-twin-sweep', /live-doc-swept-by-same-account-device/],
  ['H-cancel-during-claim', /^I2:(update|remove)(@|$)|I6:config:leaveRoom:DATABASE_PERMISSION_DENIED/],
  ['I-zombie-heartbeat', /zombie-heartbeat/],
  ['J-ack-handshake-stale', /ack-timeout-but-host-had-acked|taken-but-nobody-else:host-reopened-my-seat|ack-timeout-host-alive$/],
  ['K-lag-false-gone', /gone-but-room-open:(findByCode|joinRoom):lag|own-room-reported-gone|gone-but-room-open:.*room-just-created/],
  ['L-adv-forged-docs', /adv-win-doc-accepted|claim-won-not-mine|impersonated-guest-accepted|claim-ok-but-scored-100-vs/],
  ['M-adv-dos', /matchmaking-blocked|fewer-matches-settled|stuck-at-end:waiting|too-long:waiting|ghost-room-listed$|adv-seat-accepted|too-long:result-wait|stuck-at-end:result-wait/],
  ['N-opponent-abandon-not-noticed', /played-on-after-opponent-claimed-abandon/],
  ['O-lost-answers', /score-vs-rounds:(own-win-doc-landed|claim-failed|claim-ok-but-scored)/],
  ['P-wording', /full-room-reported-gone|taken-but-nobody-else:(room-holds-my-own-key|no-seat|my-own-seat)/],
  ['Q-phantom-seat', /^I1:|foreign-win-doc/],
  ['R-sweep-vs-forged', /I2:remove:adv-forged-target/],
  ['S-unsettled-other', /clean-match-unsettled$|clean-match-false-abandon/]
];
const groups = new Map();
const totals = {};
for (const p of fs.readdirSync(out)) {
  const f = path.join(out, p, 'report.json');
  if (!fs.existsSync(f)) continue;
  const rep = JSON.parse(fs.readFileSync(f, 'utf8'));
  totals[p] = { runs: rep.runs, failingRuns: rep.failingRuns, perInv: rep.perInv, summary: rep.summary };
  for (const c of rep.clusters) {
    const base = c.sig.replace(/^I9:/, '').replace(/^I8:adv-caused:/, '');
    let root = 'other';
    for (const [k, re] of ROOT) if (re.test(base)) { root = k; break; }
    if (!groups.has(root)) groups.set(root, { root, sigs: new Map(), runs: 0, sev: 'low' });
    const g = groups.get(root);
    const key = c.sig;
    const s = g.sigs.get(key) || { sig: c.sig, sev: c.sev, count: 0, seeds: [] };
    s.count += c.count;
    for (const sd of c.seeds.slice(0, 6)) s.seeds.push(p + ':' + sd);
    g.sigs.set(key, s);
    if (!c.sig.startsWith('I9:') && !c.sig.startsWith('I8:adv-caused:')) g.runs += c.count;
    if (c.sev === 'high' || (c.sev === 'medium' && g.sev === 'low')) g.sev = c.sev;
  }
}
const list = [...groups.values()].sort((a, b) => b.runs - a.runs);
for (const g of list) {
  console.log('\n## ' + g.root + '  [' + g.sev + ']  ' + g.runs + ' run-signature hits');
  for (const s of [...g.sigs.values()].sort((a, b) => b.count - a.count)) console.log('   ' + String(s.count).padStart(5) + '× [' + s.sev + '] ' + s.sig + '   ' + s.seeds.slice(0, 4).join(' '));
}
console.log('\n## runs per profile');
for (const [p, t] of Object.entries(totals)) console.log('  ' + t.summary);
fs.writeFileSync(path.join(out, 'clusters.json'), JSON.stringify({ totals, groups: list.map((g) => ({ root: g.root, sev: g.sev, runs: g.runs, sigs: [...g.sigs.values()] })) }, null, 1));
