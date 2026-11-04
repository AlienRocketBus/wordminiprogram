// UI-1 skeptic: main kid path index.html -> island (iframe) -> 拼写大PK -> rooms/ladder, then the
// phone's Back key (page.goBack() = browser back). Variants: free | ladder | battle
import { env, sleep, H, islandFrame, ftap, fscreen, fwait, flat, rtOf, stOf, roomDocs, myOpenRoom, report, wordsOf } from './sk.mjs';
const V = process.argv[2] || 'free';
const rep = report(`UI-1 skeptic · island Back · variant ${V}`);
const E = await env({ latencyMs: 50, jitterMs: 30, consistencyLagMs: 200 });
try {
  const K = await E.phone('岛', { path: '/index.html', login: false, ready: () => !!(window.HansenAuth && window.openIsland) });
  await K.eval(() => { localStorage.setItem('hansen_onboarded', '1'); return 1; });
  await K.page.reload({ waitUntil: 'domcontentloaded' });
  await K.page.waitForFunction(() => !!(window.HansenAuth && window.openIsland), null, { timeout: 30000 });
  await sleep(1200);
  const lr = await H.loginPhone(K, '13900005555');
  rep.log('shell login ok:', !!(lr && lr.ok));
  await K.eval(() => { try { HansenSbProfile.setName('岛上小美'); } catch (e) {} return 1; });
  rep.log('history.length before island:', await K.eval(() => history.length));
  await K.tap('a.island.food');
  let fr = null;
  await H.until(async () => { fr = islandFrame(K.page); return fr && fr.evaluate(() => !!(window.HansenSbPK && window.HansenLadderUI && window.HansenPkRoomUI && window.HansenAuth && window.HANSEN_VOCAB_ALL)).catch(() => false); }, { timeout: 40000 });
  rep.log('island frame:', fr && fr.url().replace(/^https?:\/\/[^/]+/, ''), '| history.length:', await K.eval(() => history.length), '| state:', await K.eval(() => JSON.stringify(history.state)));
  await sleep(1200);
  for (let i = 0; i < 4; i++) { try { await ftap(K.page, fr, '#alertModal.show button', { timeout: 1200 }); await sleep(400); } catch (e) { break; } }
  await ftap(K.page, fr, '.mode-card[onclick*="openSpellPK"]');
  await fwait(fr, /拼写大PK/);
  const F = await E.phone('另一个孩子', { nick: '小F' });
  let rid = null;
  if (V === 'free' || V === 'battle') {
    await ftap(K.page, fr, '#kRooms');
    await fwait(fr, /开一间/);
    await ftap(K.page, fr, '#prNew');
    await ftap(K.page, fr, '.pr_mode[data-mode="C"]');
    await fwait(fr, /等对手进来/, 15000);
    rid = (myOpenRoom(E.emu, K.cloudUid) || {})._id;
    rep.log('island kid is waiting in free room', rid, '| screen:', flat(await fscreen(fr), 90));
  } else {
    await fr.evaluate(() => { window.__hsnLadderWaitSec = 3; return 1; });   // documented test knob: self-host after 3 s instead of 20 s
    await ftap(K.page, fr, '#kLadder');
    await fwait(fr, /开始排位/);
    await ftap(K.page, fr, '#ldGo');
    await fwait(fr, /等对手进来/, 30000);
    rid = (myOpenRoom(E.emu, K.cloudUid) || {})._id;
    rep.log('island kid is in a ranked waiting room', rid, '| screen:', flat(await fscreen(fr), 90));
  }
  if (V === 'battle') {
    await F.tap('#pkRooms'); await F.waitScreen(/开一间/, { timeout: 8000 });
    await H.until(async () => { const h = await F.hitTest(`button[data-rid="${rid}"]`, { timeout: 300 }); if (h.ok) return h; await F.tap('#prRef').catch(() => {}); return null; }, { timeout: 20000, interval: 900 });
    await F.tap(`button[data-rid="${rid}"]`);
    await H.until(async () => { const a = await rtOf(fr), b = await rtOf(F.page); return a && b; }, { timeout: 30000, interval: 200 });
    rep.log('battle started on both phones; island screen:', flat(await fscreen(fr), 120));
    await sleep(2000);
  }
  // ── the phone's Back key ──
  await K.page.goBack();
  await sleep(2000);
  const wrap = await K.eval(() => getComputedStyle(document.getElementById('islandFrameWrap')).display);
  const vis = await fr.evaluate(() => document.visibilityState).catch((e) => 'gone');
  const dl = await fr.evaluate(() => ({ room: HansenPkRoom._currentRoomId(), role: HansenPkRoom._currentRole() })).catch(() => null);
  rep.log(`after Back: wrapper display=${wrap}; island visibilityState=${vis}; island data layer: ${JSON.stringify(dl)}; shell shows: ${flat(await K.screen(), 70)}`);
  if (V !== 'battle') {
    await sleep(33000);
    const R2 = roomDocs(E.emu).find((d) => d._id === rid);
    rep.log(`35 s after Back: room status=${R2 && R2.status}, heartbeat age=${R2 ? Date.now() - R2.heartbeatAt : '-'} ms`);
    if (V === 'free') {
      await F.tap('#pkRooms'); await F.waitScreen(/开一间/, { timeout: 8000 });
      const seen = await H.until(async () => { const h = await F.hitTest(`button[data-rid="${rid}"]`, { timeout: 300 }); if (h.ok) return h; await F.tap('#prRef').catch(() => {}); return null; }, { timeout: 12000, interval: 900 });
      rep.log('other kid\'s lobby lists the absent kid\'s room:', !!seen, '|', flat(await F.screen(), 140));
      if (seen) await F.tap(`button[data-rid="${rid}"]`);
    } else {
      await F.tap('#pkLadder'); await F.waitScreen(/开始排位/, { timeout: 8000 });
      await F.tap('#ldGo');
    }
  }
  const fb = await H.until(async () => H.battleView(F), { timeout: 40000, interval: 300 });
  rep.log('other kid on battle screen:', !!fb, fb ? `word ${fb.round + 1}, opp「${fb.oppName}」` : '');
  if (fb) {
    const words = await wordsOf(F.page, roomDocs(E.emu).find((d) => d._id === rid));
    // the other kid spells every typeable word it is shown, for ~50 s
    const t0 = Date.now(), typed = new Set();
    while (Date.now() - t0 < 50000) {
      const v = await H.battleView(F);
      if (!v) break;
      const w = words[v.round];
      if (!v.disabled && w && /^[a-zA-Z]+$/.test(w.en) && !typed.has(v.round)) { typed.add(v.round); await H.typeWord(F, w.en).catch(() => {}); }
      await sleep(300);
    }
    const v2 = await H.battleView(F);
    const hr = await rtOf(fr);
    rep.log(`after ~50 s: other kid ${v2 ? `on word ${v2.round + 1}, score ${v2.my}:${v2.opp}, line「${v2.hintLine}」` : 'not on battle: ' + flat(await F.screen(), 140)}; hidden island kid on word ${hr ? hr.idx + 1 : '-'}`);
    rep.log('other kid page text:', flat(await F.screen(), 200));
    if (process.argv[3] === 'wait') {
      const res = await H.until(async () => { const t = await fscreen(fr); return /你赢了|这局输了|打平|离场|判给/.test(t) ? t : null; }, { timeout: 120000, interval: 1000 });
      rep.log('hidden island kid result screen (never seen by the kid):', flat(res, 160));
    }
    const rec0 = await fr.evaluate(() => HansenPkRecord.read()).catch(() => null);
    rep.log('hidden island kid record so far: losses', rec0 && rec0.losses, 'rating', rec0 && rec0.rating);
    // island kid comes back to the same island
    await K.tap('a.island.food');
    await sleep(1500);
    rep.log('island kid re-opens 美食岛 and sees:', flat(await fscreen(fr), 200));
  }
  rep.log('errors K', K.errors, 'F', F.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 700)); }
await E.done();
process.exit(0);
