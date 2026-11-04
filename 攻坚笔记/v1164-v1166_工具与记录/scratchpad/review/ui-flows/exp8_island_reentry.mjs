// EXP8: island page (island_animal.html) + spelling_pk.html, ranked game to the end, then 再来一局 on both.
//   Checks every screen is the top layer on the island (touch hit-tests), the rematch forms, no page errors.
//   Also: the identity bar 「点这里设置名字」 on the island PK screen (profile overlay stacking).
import { setup, docs, sleep, report, H } from './lib.mjs';
const rep = report('EXP8 island re-entry (再来一局) with the real SDK');
const env = await setup({ permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 });
const islandReady = () => !!(window.HansenAuth && window.HansenSbPK && window.HansenLadderUI && window.HansenPkRoom && window.HansenPkRoomUI);
try {
  const E = await env.phone('岛', { path: '/island_animal.html', ready: islandReady, nick: '岛上蜂' });
  const F = await env.phone('页', { nick: '页面蜂' });
  await H.dismissIslandWelcome(E);
  await E.tap('.mode-card[onclick*="openSpellPK"]');
  await E.waitScreen(/天梯排位/, { timeout: 8000 });
  // profile overlay from the island PK screen
  await E.tap('#kMe');
  await sleep(800);
  const prof = await E.eval(() => { const p = document.getElementById('hsb_prof'); return p ? { on: p.classList.contains('on'), z: getComputedStyle(p).zIndex } : null; });
  const top = (await E.screen()).replace(/\s+/g, ' ').slice(0, 60);
  rep.log(`island: tap the identity bar on 拼写大PK -> profile overlay ${JSON.stringify(prof)}; top layer shows: ${top}`);
  rep.expect(!prof || !prof.on || !/拼写大PK/.test(top), 'the profile page opened from the island PK screen is visible on top');
  await E.eval(() => { try { window.HansenSbProfile._close(); } catch (e) {} return true; });
  await sleep(300);

  await E.tap('#kLadder'); await E.waitScreen(/开始排位/, { timeout: 8000 });
  await F.tap('#pkLadder'); await H.answerNameIfAsked(F, F.nick); await F.waitScreen(/开始排位/, { timeout: 8000 });
  await E.tap('#ldGo'); await sleep(3000); await F.tap('#ldGo');
  const both = await H.until(async () => (await H.battleView(E)) && (await H.battleView(F)), { timeout: 70000, interval: 400 });
  rep.expect(!!both, 'game 1: both on the battle screen');
  const R = docs(env.emu).find((d) => d.kind === 'room' && d.status === 'playing');
  const host = R && R._openid === E.cloudUid ? E : F, guest = host === E ? F : E;
  const words = await H.wordsOfRoom(E, R);
  const run = await H.playMatch({ host, guest }, words, (i) => ({ first: i % 2 ? 'guest' : 'host' }), { timeout: 200000 });
  const rE = await H.waitResult(E, 60000), rF = await H.waitResult(F, 60000);
  rep.log(`game 1 result: 岛 ${rE && rE.text.split('\n')[0]} ${rE && rE.mine}:${rE && rE.theirs}; 页 ${rF && rF.text.split('\n')[0]} ${rF && rF.mine}:${rF && rF.theirs}; maxGap ${run.maxGap}`);
  rep.expect(rE && rF && rE.mine === rF.theirs && rE.theirs === rF.mine, 'both phones agree on the score');
  // 再来一局 on the island
  const again = await E.hitTest('#prAgain', { timeout: 3000 });
  rep.expect(again.ok, `island result screen 再来一局 tappable (${again.why || again.hit})`);
  await E.tap('#prAgain');
  await sleep(1500);
  const mHit = await E.hitTest('#ldCancel2', { timeout: 4000 });
  const ms = (await E.screen()).replace(/\s+/g, ' ').slice(0, 70);
  rep.expect(mHit.ok && /正在找对手/.test(ms), `island: 再来一局 -> matching screen on top, cancel tappable (${mHit.why || mHit.hit}; ${ms})`);
  await F.tap('#prAgain');
  const both2 = await H.until(async () => (await H.battleView(E)) && (await H.battleView(F)), { timeout: 80000, interval: 400 });
  const kb = both2 ? await E.hitTest('#prKb .pr_key[data-k="a"]', { timeout: 3000 }) : { ok: false, why: 'no battle' };
  rep.expect(!!both2 && kb.ok, `game 2 (rematch) forms and the island battle keyboard is on top (${kb.why || kb.hit})`);
  const rooms = docs(env.emu).filter((d) => d.kind === 'room');
  rep.log('rooms on server:', rooms.map((d) => `${d._id.slice(-5)}:${d.status}`).join(' '));
  rep.log('page errors:', E.errors, F.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
