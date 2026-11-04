// EXP14: the watchdog rescue overlay's two buttons on the island page (the overlay is rendered through the
//        watchdog's own rescue(); everything after the tap is the real flow).
import { setup, sleep, report, H } from './lib.mjs';
const rep = report('EXP14 rescue buttons (island)');
const env = await setup({ permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 });
const islandReady = () => !!(window.HansenAuth && window.HansenSbPK && window.HansenLadderUI && window.HansenPkRoom && window.HansenPkRoomUI && window.HansenPkWatchdog);
try {
  const E = await env.phone('岛', { path: '/island_animal.html', ready: islandReady, nick: '岛上蜂' });
  await H.dismissIslandWelcome(E);
  await E.tap('.mode-card[onclick*="openSpellPK"]');
  await E.waitScreen(/天梯排位/, { timeout: 8000 });
  await E.tap('#kLadder'); await E.waitScreen(/开始排位/, { timeout: 8000 });
  await E.eval(() => { HansenPkWatchdog._rescueForTest('这一步没能打开', '刚才那个操作没有正常显示出来。'); return true; });
  await E.tap('#pkRescueRetry');
  await sleep(1500);
  const m = await E.hitTest('#ldCancel2', { timeout: 3000 });
  rep.expect(m.ok, `重新找对手 -> matching screen on top (${m.why || m.hit})`);
  let again = false;
  for (let i = 0; i < 16 && !again; i++) { await sleep(500); again = !!(await E.eval(() => !!document.getElementById('pkRescue'))); }
  rep.expect(!again, 'no rescue overlay comes back within 8 s');
  await E.tap('#ldCancel2'); await sleep(500); await E.tap('#ldX'); await sleep(500);
  await E.eval(() => { HansenPkWatchdog._rescueForTest('这一局卡住了', '…'); return true; });
  await E.tap('#pkRescueBack');
  await sleep(1000);
  const pk = await E.hitTest('#kLadder', { timeout: 3000 });
  rep.expect(pk.ok, `回到大PK首页 -> the island 拼写大PK screen is on top (${pk.why || pk.hit})`);
  again = false;
  for (let i = 0; i < 18 && !again; i++) { await sleep(500); again = !!(await E.eval(() => !!document.getElementById('pkRescue'))); }
  rep.expect(!again, 'no rescue loop after 回到大PK首页 (9 s)');
  rep.log('errors', E.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
