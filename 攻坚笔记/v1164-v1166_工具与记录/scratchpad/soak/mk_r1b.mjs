/* targeted R1 scenario on 6165390: the host's network hangs right after it acks; the guest plays alone, is told
   「对手刚才没进来」; the host comes back and re-opens the same room at a new epoch; the guest joins it again */
import { runSpec } from './lib/run.mjs';
import { checkWorld } from './lib/checks.mjs';
import fs from 'node:fs';
const net = (base) => ({ base, jitter: 0, spikeP: 0, faultRate: 0 });
const pl = (label, uid, name, intents, base, extra) => Object.assign({ label, uid, name, rating: 1000, skew: 0, net: net(base), partitions: [], freezes: [], reloads: [], hides: [], sessionFailP: 0,
  kid: { pCorrect: 1, minMs: 1500, maxMs: 2500, slowP: 0 }, again: { p: 0, p2: 0, max: 0 }, intents }, extra || {});
const mk = (pa, rejoin) => ({ seed: 9600, profile: 'targeted', kind: 'rooms', db: { lagMax: 0, lagShape: 1, queryLagMul: 1, queryLagExtra: 0, lagMode: 'random', ryw: true, dupMode: 'request_failed', permMode: 'rules', orderByFail: false },
  unloadSendP: 1, outages: [], adversary: null,
  players: [pl('P0', 'k0xT', '小明', [{ at: 300, act: 'create', mode: 'A', private: false, wordCount: 3 }], 80, { partitions: [{ a: pa, b: pa + 75000, mode: 'hang' }] }),
            pl('P1', 'k1xT', '小红', [{ at: 2000, act: 'join', via: 'list', target: 'P0', pick: 'first', tries: 3 }, { at: rejoin, act: 'join', via: 'list', target: 'P0', pick: 'first', tries: 8 }], 80)] });
const [mut, ok, dbg] = process.argv.slice(2);
if (dbg) { const W = await runSpec(mk(Number(dbg), 95000), { repoDir: mut }); const T0 = 1767574800000;
  for (const P of W.players.filter((p) => p.honest)) { for (const m of P.matches) console.log(P.label, m.side, m.roomId, 'seat', m.seat, 'start', Math.round((m.startT - T0) / 100) / 10, 'end', m.end && m.end.how, 'res', m.result && m.result.result, 'claims', JSON.stringify(m.claims.map((c) => c.idx + (c.won ? 'W' : c.pending ? 'P' : '-')))); }
  console.log(checkWorld(W).filter((v) => v.sev !== 'low').map((v) => v.sig).join(' | ')); process.exit(0); }
let found = null;
outer: for (let pa = 2500; pa <= 7000; pa += 250) for (const rj of [95000, 110000]) {
  const W = await runSpec(mk(pa, rj), { repoDir: mut });
  const V = checkWorld(W).filter((v) => v.sev !== 'low' && /^I[34]/.test(v.sig));
  if (!V.length) continue;
  const W2 = await runSpec(mk(pa, rj), { repoDir: ok });
  if (!checkWorld(W2).filter((v) => v.sev !== 'low').length) { found = { pa, rj, sig: V[0].sig }; break outer; }
}
console.log('found', JSON.stringify(found));
if (found) fs.writeFileSync('specs/regress/R01b_rejoin_same_room_new_epoch_6165390.json', JSON.stringify({ name: 'R01b_rejoin_same_room_new_epoch_6165390', bug: 'R1 (6165390): the host hangs right after acking; the guest plays alone, leaves, and joins the same room again at its new epoch → the previous epoch\'s cached wins are reused (claims answered from the stale cache, scores wrong)', spec: mk(found.pa, found.rj) }, null, 1));
