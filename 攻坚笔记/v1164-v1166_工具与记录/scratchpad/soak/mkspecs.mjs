/* mkspecs.mjs — targeted scenarios the random profiles cannot reach (written to specs/targeted/) */
import fs from 'node:fs';
const base = (seed, kind) => ({ seed, profile: 'targeted', kind, db: { lagMax: 300, lagShape: 2, queryLagMul: 1.2, queryLagExtra: 0, lagMode: 'random', ryw: false, dupMode: 'request_failed', permMode: 'rules', orderByFail: false }, unloadSendP: 0.6, outages: [], players: [], adversary: null });
const kid = { pCorrect: 0.7, minMs: 2000, maxMs: 8000, slowP: 0 };
const pl = (i, o) => Object.assign({ label: 'P' + i, uid: 'k' + i + 'xT', name: ['小明', '小红', '阿杰', '朵朵'][i], rating: 1000, skew: 0, net: { base: 60, jitter: 60, spikeP: 0, faultRate: 0 }, partitions: [], freezes: [], reloads: [], hides: [], sessionFailP: 0, kid, again: { p: 0, p2: 0, max: 0 }, intents: [], ladderer: false, afterReload: null }, o);
const out = {};
/* T1: ladder, one kid's phone clock 40 min fast (outside the ±30 min list window) */
for (const sk of [40 * 60e3, -40 * 60e3]) {
  const s = base(9001, 'ladder');
  s.players.push(pl(0, { ladderer: true, intents: [{ at: 500, act: 'ladder' }] }));
  s.players.push(pl(1, { ladderer: true, skew: sk, intents: [{ at: 900, act: 'ladder' }] }));
  out['T1_ladder_skew' + (sk > 0 ? 'plus' : 'minus') + '40min'] = s;
}
/* T2: same account on a second device whose clock is 40 min fast: its lobby sweep vs the live room of the first device */
{
  const s = base(9002, 'rooms');
  s.players.push(pl(0, { isHost: true, intents: [{ at: 500, act: 'create', mode: 'C', private: false, wordCount: 10 }] }));
  s.players.push(pl(1, { intents: [{ at: 4000, act: 'join', via: 'list', target: 'P0', pick: 'first', tries: 4 }] }));
  const tw = pl(0, { label: 'P0b', twinOf: 'P0', skew: 40 * 60e3, intents: [{ at: 15000, act: 'browse' }, { at: 30000, act: 'browse' }, { at: 60000, act: 'browse' }] });
  s.players.push(tw);
  out.T2_twin_clock_plus40min_sweeps = s;
}
/* T3: guest leaves for 12 minutes in the middle of a match (host claims abandon, finishes, leaves; sweep 10 min later) */
{
  const s = base(9003, 'rooms');
  s.players.push(pl(0, { isHost: true, intents: [{ at: 500, act: 'create', mode: 'A', private: false, wordCount: 10 }] }));
  s.players.push(pl(1, { intents: [{ at: 3000, act: 'join', via: 'list', target: 'P0', pick: 'first', tries: 4 }], freezes: [{ at: 25000, dur: 12 * 60e3 }] }));
  out.T3_guest_away_12min = s;
}
/* T4: host leaves for 12 minutes in the middle of a match */
{
  const s = base(9004, 'rooms');
  s.players.push(pl(0, { isHost: true, intents: [{ at: 500, act: 'create', mode: 'A', private: false, wordCount: 10 }], freezes: [{ at: 25000, dur: 12 * 60e3 }] }));
  s.players.push(pl(1, { intents: [{ at: 3000, act: 'join', via: 'list', target: 'P0', pick: 'first', tries: 4 }] }));
  out.T4_host_away_12min = s;
}
/* T5: classroom Wi-Fi drops for both phones for 75 s mid-match (F4) */
for (const mode of ['A', 'C']) {
  const s = base(9005, 'rooms');
  s.players.push(pl(0, { isHost: true, intents: [{ at: 500, act: 'create', mode, private: false, wordCount: 10 }] }));
  s.players.push(pl(1, { intents: [{ at: 3000, act: 'join', via: 'list', target: 'P0', pick: 'first', tries: 4 }] }));
  s.outages.push({ a: 30000, b: 105000, mode: 'fast' });
  out['T5_both_offline_75s_' + mode] = s;
}
/* T6: four kids press 开始排位 within 1 s, network fine (convergence) — 10 variants */
for (let v = 0; v < 10; v++) {
  const s = base(9100 + v, 'ladder');
  for (let i = 0; i < 4; i++) s.players.push(pl(i, { ladderer: true, rating: 1000 + (i * 37 + v * 11) % 90, intents: [{ at: 300 + ((i * 131 + v * 71) % 1000), act: 'ladder' }] }));
  out['T6_four_simultaneous_ladder_' + v] = s;
}
for (const [k, s] of Object.entries(out)) fs.writeFileSync('specs/targeted/' + k + '.json', JSON.stringify(s, null, 1));
console.log(Object.keys(out).join('\n'));
