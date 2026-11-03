import * as H from '/home/claude/work/repo/cloudbase_e2e_harness.mjs';
const mode = process.argv[2] || 'legacy';
const emu = H.makeEmulator({ knobs: { latencyMs: 40, jitterMs: 40, consistencyLagMs: 300, permissionMode: mode } });
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const t0 = Date.now();
const lg = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', ...a);
const P = {};
try {
  for (const [n, num] of [['A', '13800000001'], ['B', '13800000002']]) {
    const p = await H.openPhone(browser, emu, srv.origin, { name: n }); P[n] = p;
    const r = await H.loginPhone(p, num); lg(n, 'login', r.ok, r.uid);
    await p.tap('#pkLadder'); await H.answerNameIfAsked(p, '小蜂' + n);
  }
  const { A, B } = P;
  await A.tap('#ldGo'); lg('A go');
  await A.waitScreen(/等对手进来/, { timeout: 35000 }); lg('A hosting');
  await B.tap('#ldGo'); lg('B go');
  const got = await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: 40000 });
  lg('both battle?', !!got, (await A.screen()).slice(0, 200).replace(/\n/g, ' | '), ' || ', (await B.screen()).slice(0, 200).replace(/\n/g, ' | '));
  console.log(H.describeRooms(emu));
  if (got) {
    const room = H.roomDocs(emu).find((d) => d.kind === 'room');
    const words = await H.wordsOfRoom(A, room);
    lg('words', words.map((w) => w.en).join(','));
    const typed = { A: new Set(), B: new Set() };
    const tEnd = Date.now() + 120000;
    while (Date.now() < tEnd) {
      const va = await H.battleView(A), vb = await H.battleView(B);
      if (!va && !vb) break;
      for (const [n, v] of [['A', va], ['B', vb]]) {
        if (!v || v.round < 0) continue;
        const winner = v.round < 6 ? 'A' : 'B';
        if (n === winner && !typed[n].has(v.round) && !v.disabled) {
          typed[n].add(v.round);
          lg(n, 'types round', v.round, words[v.round].en, 'cn shown', v.cn, 'opp', v.oppName, v.my, v.opp);
          await H.typeWord(P[n], words[v.round].en);
        }
      }
      await H.sleep(150);
    }
    lg('after loop A:', (await A.screen()).slice(0, 300).replace(/\n/g, ' | '));
    lg('after loop B:', (await B.screen()).slice(0, 300).replace(/\n/g, ' | '));
    await H.sleep(5000);
    lg('later A:', (await A.screen()).slice(0, 300).replace(/\n/g, ' | '));
    lg('later B:', (await B.screen()).slice(0, 300).replace(/\n/g, ' | '));
  }
  console.log(H.describeRooms(emu));
  console.log('foreign', JSON.stringify(emu.foreign.slice(0, 5)));
  for (const p of Object.values(P)) console.log(p.name, 'errors', p.errors, 'dialogs', p.dialogs.map((d) => d.message), 'leaks', p.leaks.length);
} catch (e) { console.log('ERR', e.message); console.log(H.describeRooms(emu)); console.log(H.recentLog(emu, 20)); }
await browser.close(); srv.close();
