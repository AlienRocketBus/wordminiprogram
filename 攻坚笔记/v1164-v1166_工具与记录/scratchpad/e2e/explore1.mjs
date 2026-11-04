import * as H from '/home/claude/work/repo/cloudbase_e2e_harness.mjs';
const emu = H.makeEmulator({ knobs: { latencyMs: 40, jitterMs: 40, consistencyLagMs: 300 } });
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const t0 = Date.now();
const lg = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', ...a);
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' });
  lg('A opened');
  const la = await H.loginPhone(A, '13800000001');
  lg('A login', JSON.stringify(la).slice(0, 200));
  await A.tap('#pkLadder');
  lg('tapped ladder');
  const asked = await H.answerNameIfAsked(A, '小蜂A');
  lg('name asked', asked);
  lg('screen', (await A.screen()).slice(0, 300).replace(/\n/g, ' | '));
  const h = await A.hitTest('#ldGo');
  lg('ldGo hit', JSON.stringify(h));
  await A.tap('#ldGo');
  await H.sleep(2500);
  lg('screen after go', (await A.screen()).slice(0, 300).replace(/\n/g, ' | '));
  await H.sleep(20000);
  lg('screen after 22s', (await A.screen()).slice(0, 300).replace(/\n/g, ' | '));
  console.log(H.describeRooms(emu));
  console.log('leaks', A.leaks.slice(0, 5), 'errors', A.errors, 'dialogs', A.dialogs, 'missing', srv.missing.slice(0, 10));
  console.log(H.recentLog(emu, 30));
} catch (e) { console.log('ERR', e.message); }
await browser.close(); srv.close();
