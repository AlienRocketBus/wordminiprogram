/* targeted R11 scenario: the guest leaves while markReady's read is still in flight (slow network) */
import { runSpec } from './lib/run.mjs';
import { checkWorld } from './lib/checks.mjs';
import fs from 'node:fs';
const net = (base) => ({ base, jitter: 0, spikeP: 0, faultRate: 0 });
const pl = (label, uid, name, intents, base) => ({ label, uid, name, rating: 1000, skew: 0, net: net(base), partitions: [], freezes: [], reloads: [], hides: [], sessionFailP: 0,
  kid: { pCorrect: 0.8, minMs: 1500, maxMs: 3000, slowP: 0 }, again: { p: 0, p2: 0, max: 0 }, intents });
const mk = (leaveAt) => ({ seed: 9500, profile: 'targeted', kind: 'rooms', db: { lagMax: 0, lagShape: 1, queryLagMul: 1, queryLagExtra: 0, lagMode: 'random', ryw: true, dupMode: 'request_failed', permMode: 'rules', orderByFail: false },
  unloadSendP: 1, outages: [], adversary: null,
  players: [pl('P0', 'k0xT', '小明', [{ at: 300, act: 'create', mode: 'C', private: false, wordCount: 3 }], 60),
            pl('P1', 'k1xT', '小红', [{ at: 2000, act: 'join', via: 'list', target: 'P0', pick: 'first', tries: 3 }, { at: leaveAt, act: 'leave' }], 900)] });
const [mut, ok] = process.argv.slice(2);
const T0 = 1767574800000;
let found = null;
for (let at = 6000; at <= 20000 && !found; at += 150) {
  const W = await runSpec(mk(at), { repoDir: mut });
  const V = checkWorld(W).filter((v) => v.sev !== 'low' && /zombie/.test(v.sig));
  if (!V.length) continue;
  const W2 = await runSpec(mk(at), { repoDir: ok });
  const V2 = checkWorld(W2).filter((v) => v.sev !== 'low');
  if (!V2.length) found = { at, sig: V[0].sig };
}
console.log('found', JSON.stringify(found));
if (found) fs.writeFileSync('specs/regress/R11b_leave_during_markready_slow_net.json', JSON.stringify({ name: 'R11b_leave_during_markready_slow_net', bug: 'R11 (6165390): the guest leaves while markReady is still reading the room on a slow network → markReady re-registers the room and restarts the heartbeat (zombie writes after leaving)', spec: mk(found.at) }, null, 1));
