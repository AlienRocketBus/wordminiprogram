// UI-2 skeptic: in a free room (mode from argv), the guest never answers word N; the host has typed all
// but the last letter and finishes the word right after the guest's timeout doc lands.
// Nobody else spelled it -> by the published rules this is 先拼对 (100). What does the host get?
import { env, sleep, H, rtOf, stOf, hintOf, wordsOf, roomDocs, myOpenRoom, report, flat } from './sk.mjs';
const MODE = process.argv[2] || 'C';
const LAT = Number(process.argv[3] || 60);
const rep = report(`UI-2 skeptic · mode ${MODE} · latency ${LAT} ms`);
const E = await env({ latencyMs: LAT, jitterMs: 30 });
const typeable = (w) => !!(w && /^[a-zA-Z]+$/.test(String(w.en || '')));
try {
  const Hh = await E.phone('房主', { nick: '房主蜂' });
  const G = await E.phone('客人', { nick: '客人蜂' });
  let rid = null, words = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    await Hh.tap('#pkRooms'); await Hh.waitScreen(/开一间/, { timeout: 8000 });
    await Hh.tap('#prNew');
    await Hh.tap(`.pr_mode[data-mode="${MODE}"]`);
    await Hh.waitScreen(/等对手进来/, { timeout: 15000 });
    const R = myOpenRoom(E.emu, Hh.cloudUid);
    words = await wordsOf(Hh.page, R);
    if (typeable(words[0]) && words[0].en.length >= 3) { rid = R._id; break; }
    rep.log(`attempt ${attempt}: word 1 「${words[0] && words[0].en}」 not usable, reopening`);
    await Hh.tap('#prBack'); await sleep(800);
  }
  if (!rid) throw new Error('no usable room');
  rep.log('room', rid, 'word 1 =', words[0].en, words[0].cn);
  await G.tap('#pkRooms'); await G.waitScreen(/开一间/, { timeout: 8000 });
  const ok = await H.until(async () => { const h = await G.hitTest(`button[data-rid="${rid}"]`, { timeout: 300 }); if (h.ok) return h; await G.tap('#prRef').catch(() => {}); return null; }, { timeout: 20000, interval: 900 });
  if (!ok) throw new Error('guest never saw the room');
  await G.tap(`button[data-rid="${rid}"]`);
  const both = await H.until(async () => { const a = await rtOf(Hh.page), b = await rtOf(G.page); return (a && b && a.idx === 0 && b.idx === 0) ? [a, b] : null; }, { timeout: 30000, interval: 100 });
  if (!both) throw new Error('battle did not start');
  await sleep(1500);
  const a = await rtOf(Hh.page), b = await rtOf(G.page);
  rep.log(`word-1 deadlines: host−guest = ${a.deadline - b.deadline} ms (host left ${a.deadline - a.now} ms, guest left ${b.deadline - b.now} ms)`);
  // host types everything but the last letter, then waits
  const en = words[0].en.toLowerCase();
  for (const ch of en.slice(0, -1)) await Hh.tap(`#prKb .pr_key[data-k="${ch}"]`, { timeout: 4000 });
  rep.log('host typed', JSON.stringify(en.slice(0, -1)), 'and waits; guest does nothing');
  // wait for the guest's timeout doc W0
  const wid = rid + '_w0';
  const w0 = await H.until(async () => roomDocs(E.emu).find((d) => d._id === wid) || null, { timeout: 30000, interval: 25 });
  const landedAt = Date.now();
  const hr = await rtOf(Hh.page);
  const gUid = G.cloudUid;
  rep.log(`W0 landed: winner=${JSON.stringify(w0 && w0.winner)} by=${w0 && (w0._openid === gUid ? '客人' : (w0._openid === Hh.cloudUid ? '房主' : w0._openid))}; host clock: ${hr ? hr.deadline - Date.now() : 'n/a'} ms left, answered=${hr && hr.answered}`);
  const clockTxt = await Hh.eval(() => (document.getElementById('prClock') || {}).textContent || '');
  rep.log('host screen clock reads:', clockTxt);
  if (hr && !hr.answered && hr.deadline > Date.now()) {
    await Hh.tap(`#prKb .pr_key[data-k="${en.slice(-1)}"]`, { timeout: 2000 });
    const tapAt = Date.now();
    rep.log(`host tapped the last letter ${tapAt - landedAt} ms after W0 landed, with ${hr.deadline - tapAt} ms on its own clock`);
    await sleep(1300);
    const h1 = await hintOf(Hh.page); const s1 = await stOf(Hh.page);
    rep.log('host hint line:', h1, '| host score:', s1 && s1.myScore);
    const gHint = await hintOf(G.page);
    rep.log('guest hint line:', gHint);
  } else rep.log('window closed before the host could tap (no data point)');
  rep.log('page errors', Hh.errors, G.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 600)); }
await E.done();
process.exit(0);
