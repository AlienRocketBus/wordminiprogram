// UI-12 skeptic: free-room 抢答赛 (ranked per HansenPkRecord) — which opponent rating does the GUEST's ELO use?
import { env, sleep, H, report, flat, rtOf, stOf, roomDocs, myOpenRoom, wordsOf } from './sk.mjs';
const rep = report('UI-12 skeptic · free A room, host rated 1400');
const E = await env({ latencyMs: 50 });
const setRating = (p, r) => p.eval((r) => { localStorage.setItem('hansen_pk_record_v1', JSON.stringify({ rating: r, peakRating: r, placementGames: 3, wins: 5, losses: 5, history: [] })); return window.HansenPkRecord.summary().rating; }, r);
try {
  const Hh = await E.phone('房主', { nick: '高手蜂' });
  const G = await E.phone('客人', { nick: '新手蜂' });
  rep.log('host rating', await setRating(Hh, 1400), '| guest rating', await setRating(G, 1000));
  await Hh.tap('#pkRooms'); await Hh.waitScreen(/开一间/, { timeout: 8000 });
  await Hh.tap('#prNew'); await Hh.waitScreen(/选个玩法/, { timeout: 4000 });
  rep.log('mode card A says:', flat(await Hh.eval(() => document.querySelector('.pr_mode[data-mode="A"]').innerText), 60));
  await Hh.tap('.pr_mode[data-mode="A"]');
  await Hh.waitScreen(/等对手进来/, { timeout: 15000 });
  const R = myOpenRoom(E.emu, Hh.cloudUid);
  rep.log('room on server: mode', R.mode, 'hostRating', R.hostRating);
  const words = await wordsOf(Hh.page, R);
  await G.tap('#pkRooms'); await G.waitScreen(/开一间/, { timeout: 8000 });
  await H.until(async () => { const h = await G.hitTest(`button[data-rid="${R._id}"]`, { timeout: 300 }); if (h.ok) return h; await G.tap('#prRef').catch(() => {}); return null; }, { timeout: 20000, interval: 900 });
  await G.tap(`button[data-rid="${R._id}"]`);
  await H.until(async () => { const a = await rtOf(Hh.page), b = await rtOf(G.page); return a && b; }, { timeout: 30000, interval: 100 });
  // guest wins the first typeable word, then the host's phone dies (closes the page) -> abandon win for the guest
  let v = await H.battleView(G);
  while (v && !/^[a-zA-Z]+$/.test((words[v.round] || {}).en || '')) { await sleep(500); v = await H.battleView(G); }
  if (v) await H.typeWord(G, words[v.round].en);
  await sleep(1500);
  rep.log('guest state:', JSON.stringify(await stOf(G.page)), '| host state:', JSON.stringify(await stOf(Hh.page)));
  await Hh.close();
  const res = await H.until(async () => { const s = flat(await G.screen(), 400); return /你赢了|离场|本局你胜/.test(s) && /天梯分|段位/.test(s) ? s : null; }, { timeout: 120000, interval: 1000 });
  rep.log('guest result screen:', res);
  const exp = await G.eval(() => ({ vsReal: HansenSbLadder.nextRating({ myRating: 1000, oppRating: 1400, won: true }).rating, vs1000: HansenSbLadder.nextRating({ myRating: 1000, oppRating: 1000, won: true }).rating }));
  rep.log('guest rating now', (await G.eval(() => HansenPkRecord.summary().rating)), '| expected vs real host 1400:', exp.vsReal, '| vs made-up 1000:', exp.vs1000);
  rep.log('errors', G.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 600)); }
await E.done();
process.exit(0);
