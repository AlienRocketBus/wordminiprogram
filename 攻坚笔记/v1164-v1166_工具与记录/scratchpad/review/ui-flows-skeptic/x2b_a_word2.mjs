// UI-2 skeptic (A mode, word 2): host wins word 1 quickly; on word 2 the guest (previous loser) does nothing.
// Claim: the previous loser's clock starts earlier (shared W0.at) than the winner's (local, +1.4 s),
// so the loser's timeout doc lands while the winner still has time; the winner's correct answer scores 0.
import { env, sleep, H, rtOf, stOf, hintOf, wordsOf, roomDocs, myOpenRoom, report } from './sk.mjs';
const LAT = Number(process.argv[2] || 60);
const rep = report(`UI-2 skeptic · mode A word 2 · latency ${LAT} ms`);
const E = await env({ latencyMs: LAT, jitterMs: 30 });
const typeable = (w) => !!(w && /^[a-zA-Z]+$/.test(String(w.en || '')));
try {
  const Hh = await E.phone('房主', { nick: '房主蜂' });
  const G = await E.phone('客人', { nick: '客人蜂' });
  let rid = null, words = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    await Hh.tap('#pkRooms'); await Hh.waitScreen(/开一间/, { timeout: 8000 });
    await Hh.tap('#prNew'); await Hh.tap('.pr_mode[data-mode="A"]');
    await Hh.waitScreen(/等对手进来/, { timeout: 15000 });
    const R = myOpenRoom(E.emu, Hh.cloudUid);
    words = await wordsOf(Hh.page, R);
    if (typeable(words[0]) && typeable(words[1]) && words[1].en.length >= 3) { rid = R._id; break; }
    await Hh.tap('#prBack'); await sleep(800);
  }
  if (!rid) throw new Error('no usable room');
  rep.log('room', rid, 'words 1-2 =', words[0].en, '/', words[1].en);
  await G.tap('#pkRooms'); await G.waitScreen(/开一间/, { timeout: 8000 });
  await H.until(async () => { const h = await G.hitTest(`button[data-rid="${rid}"]`, { timeout: 300 }); if (h.ok) return h; await G.tap('#prRef').catch(() => {}); return null; }, { timeout: 20000, interval: 900 });
  await G.tap(`button[data-rid="${rid}"]`);
  await H.until(async () => { const a = await rtOf(Hh.page), b = await rtOf(G.page); return (a && b && a.idx === 0 && b.idx === 0); }, { timeout: 30000, interval: 100 });
  await sleep(1200);
  await H.typeWord(Hh, words[0].en);           // host wins word 1
  const both2 = await H.until(async () => { const a = await rtOf(Hh.page), b = await rtOf(G.page); return (a && b && a.idx === 1 && b.idx === 1) ? [a, b] : null; }, { timeout: 20000, interval: 50 });
  if (!both2) throw new Error('word 2 not reached');
  await sleep(300);
  const a = await rtOf(Hh.page), b = await rtOf(G.page);
  rep.log(`word-2 deadlines: host(winner of word 1) − guest(loser) = ${a.deadline - b.deadline} ms`);
  const en = words[1].en.toLowerCase();
  for (const ch of en.slice(0, -1)) await Hh.tap(`#prKb .pr_key[data-k="${ch}"]`, { timeout: 4000 });
  const wid = rid + '_w1';
  const w1 = await H.until(async () => roomDocs(E.emu).find((d) => d._id === wid) || null, { timeout: 30000, interval: 25 });
  const hr = await rtOf(Hh.page);
  rep.log(`W1 landed: winner=${JSON.stringify(w1 && w1.winner)} by=${w1 && (w1._openid === G.cloudUid ? '客人' : '房主')}; host has ${hr.deadline - Date.now()} ms left (answered=${hr.answered}), clock shows`, await Hh.eval(() => (document.getElementById('prClock') || {}).textContent));
  if (!hr.answered && hr.deadline > Date.now()) {
    await Hh.tap(`#prKb .pr_key[data-k="${en.slice(-1)}"]`, { timeout: 2000 });
    rep.log(`host finished 「${en}」 with ${hr.deadline - Date.now()} ms on its clock`);
    await sleep(1200);
    rep.log('host hint:', await hintOf(Hh.page), '| host score:', (await stOf(Hh.page) || {}).myScore);
  }
  rep.log('errors', Hh.errors, G.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 600)); }
await E.done();
process.exit(0);
