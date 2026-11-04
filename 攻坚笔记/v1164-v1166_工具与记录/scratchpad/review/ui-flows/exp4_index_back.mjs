// EXP4: the real kid path index.html -> island (in #islandFrame) -> 拼写大PK -> 天梯排位 -> 开始排位,
//       then the Android back key (history.back() in the shell) while waiting for an opponent.
//       What keeps running in the hidden island iframe? Can a 2nd phone get matched against this ghost?
import { setup, docs, sleep, report, H } from './lib.mjs';
import { islandFrame, ftap, fscreen, fwait } from './frame.mjs';
const rep = report('EXP4 index.html island path + Android back');
const env = await setup({ permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 });
try {
  const E = await env.phone('戊', { path: '/index.html', login: false, setName: false, ready: () => !!(window.HansenAuth && window.openIsland) });
  await E.eval(() => { localStorage.setItem('hansen_onboarded', '1'); return true; });
  await E.page.reload({ waitUntil: 'domcontentloaded' });
  await E.page.waitForFunction(() => !!(window.HansenAuth && window.openIsland), null, { timeout: 30000 });
  await sleep(1500);
  const lr = await H.loginPhone(E, '13711112222');
  rep.log('login on the shell:', lr && lr.ok, lr && lr.uid);
  await E.eval(() => { try { window.HansenSbProfile && HansenSbProfile.setName && HansenSbProfile.setName('岛上蜂'); } catch (e) {} return true; });
  await E.tap('a.island.animal');
  let fr = null;
  await H.until(async () => { fr = islandFrame(E.page); if (!fr) return false; return fr.evaluate(() => !!(window.HansenSbPK && window.HansenLadderUI && window.HansenPkRoomUI && window.HansenAuth)).catch(() => false); }, { timeout: 40000 });
  rep.log('island frame ready:', !!fr, fr && fr.url().replace(/^https?:\/\/[^/]+/, ''));
  await sleep(1500);
  for (let i = 0; i < 4; i++) { try { await ftap(E.page, fr, '#alertModal.show button', { timeout: 1500 }); await sleep(500); } catch (e) { break; } }
  await ftap(E.page, fr, '.mode-card[onclick*="openSpellPK"]');
  await fwait(fr, /天梯排位/);
  await ftap(E.page, fr, '#kLadder');
  await sleep(800);
  const s1 = (await fscreen(fr)).replace(/\s+/g, ' ').slice(0, 120);
  rep.log('after tapping 天梯排位 inside the island iframe:', s1);
  await ftap(E.page, fr, '#ldGo');
  await fwait(fr, /正在找对手/, 6000);
  const s2 = await fwait(fr, /等对手进来/, 45000).catch((e) => e.last || '');
  rep.log('after 20 s:', s2.replace(/\s+/g, ' ').slice(0, 100));
  const R = docs(env.emu).find((d) => d.kind === 'room' && d._openid === E.cloudUid && d.status === 'open');
  rep.log('E\'s ranked room on the server:', R && R._id, R && R.status);

  // ── Android back ──
  await E.eval(() => { history.back(); return true; });
  await sleep(2500);
  const wrapShown = await E.eval(() => { const w = document.getElementById('islandFrameWrap'); return w ? getComputedStyle(w).display : 'none'; });
  const vis = await fr.evaluate(() => document.visibilityState).catch((e) => 'frame gone');
  const dl = await fr.evaluate(() => ({ room: HansenPkRoom._currentRoomId(), role: HansenPkRoom._currentRole() })).catch(() => null);
  rep.log(`after Android back: island wrapper display=${wrapShown}; iframe visibilityState=${vis}; data layer still holds room ${JSON.stringify(dl)}`);
  rep.log('what the kid sees now (shell):', (await E.screen()).replace(/\s+/g, ' ').slice(0, 100));
  await sleep(35000);
  const R2 = docs(env.emu).find((d) => d._id === (R && R._id));
  const beatAge = R2 ? Date.now() - Number(R2.heartbeatAt || 0) : null;
  rep.log(`35 s after back: E's room status=${R2 && R2.status}, heartbeat ${beatAge} ms old`);
  rep.expect(!R2 || R2.status !== 'open' || beatAge > 30000, 'leaving the island with the back key closes (or stops advertising) the waiting room');

  // ── a second phone starts ranked play and gets matched against the ghost ──
  const F = await env.phone('己', { nick: '小蜂己' });
  await F.tap('#pkLadder'); await H.answerNameIfAsked(F, F.nick); await F.waitScreen(/开始排位/, { timeout: 8000 });
  await F.tap('#ldGo');
  const fb = await H.until(async () => H.battleView(F), { timeout: 40000 });
  const eState = await fr.evaluate(() => { const s = HansenPkRoomUI._stateForTest(); return s ? { roomId: s.roomId, started: !!s.startAt, opp: s.oppName } : null; }).catch(() => null);
  rep.log(`F matched and is on the battle screen: ${!!fb} (opp shown: ${fb && fb.oppName}); hidden island iframe state: ${JSON.stringify(eState)}`);
  rep.expect(!fb, 'nobody can be matched against a kid who already left the island');
  if (fb) {
    await sleep(45000);
    const fv = await H.battleView(F), ev = await fr.evaluate(() => { const r = HansenPkRoomUI._rtForTest(); return r ? r.idx : null; }).catch(() => null);
    rep.log(`45 s later: F on word ${fv && fv.round + 1} (score ${fv && fv.my}:${fv && fv.opp}); hidden E iframe on word ${ev == null ? '-' : ev + 1}`);
    // E comes back to the island
    await E.tap('a.island.animal').catch((e) => rep.log('tap island again failed', e.message));
    await sleep(1500);
    rep.log('E re-opens the island and sees:', (await fscreen(fr)).replace(/\s+/g, ' ').slice(0, 160));
  }
  rep.log('E page errors:', E.errors, 'F page errors:', F.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
