// UI-6 skeptic: single vs double tap on a 选个玩法 card. Count 1 s intervals on the waiting screen,
// room/seat reads while waiting, and requests after 关掉房间.
import { env, sleep, H, report, flat, census, roomDocs, myOpenRoom } from './sk.mjs';
const GAP = Number(process.argv[2] || 150);
const rep = report(`UI-6 skeptic · mode card single vs double tap (gap ${GAP} ms)`);
const E = await env({ latencyMs: 80, jitterMs: 30 });
try {
  const P = await E.phone('孩子', { nick: '选择蜂', census: true });
  for (const kind of ['single', 'double']) {
    await P.tap('#pkRooms'); await P.waitScreen(/开一间/, { timeout: 8000 });
    await P.tap('#prNew'); await P.waitScreen(/选个玩法/, { timeout: 4000 });
    const before = await census(P);
    const c = await P.hitTest('.pr_mode[data-mode="B"]');
    await P.page.touchscreen.tap(c.x, c.y);
    if (kind === 'double') { await sleep(GAP); await P.page.touchscreen.tap(c.x, c.y); }
    await P.waitScreen(/等对手进来/, { timeout: 15000 });
    await sleep(1500);
    const R = myOpenRoom(E.emu, P.cloudUid);
    const rid = R && R._id;
    const open = roomDocs(E.emu).filter((d) => d.kind === 'room' && d._openid === P.cloudUid && d.status === 'open').length;
    const during = await census(P);
    const iv1s = during.iv.filter((s) => /^1000@/.test(s));
    const n0 = E.emu.log.length;
    await sleep(10000);
    const reads = E.emu.log.slice(n0).filter((e) => e.uid === P.cloudUid && /queryDocument|getDocument/i.test(e.action || '') ).length;
    const allReq = E.emu.log.slice(n0).filter((e) => e.uid === P.cloudUid).map((e) => (e.action || '').replace('database.', '')).reduce((m, a) => { m[a] = (m[a] || 0) + 1; return m; }, {});
    rep.log(`[${kind}] open rooms of this kid: ${open}; 1 s intervals on the waiting screen: ${iv1s.length} (${iv1s.join(' | ')}); DB requests in the next 10 s: ${JSON.stringify(allReq)}`);
    await P.tap('#prBack');
    const n1 = E.emu.log.length;
    await sleep(500);
    const after0 = await census(P);
    await sleep(9500);
    const post = E.emu.log.slice(n1).filter((e) => e.uid === P.cloudUid).map((e) => (e.action || '').replace('database.', '') + (e.docId ? '(' + String(e.docId).slice(-5) + ')' : ''));
    const after = await census(P);
    rep.log(`[${kind}] after 关掉房间: intervals ${after0.intervals}→${after.intervals}; requests in 10 s: ${post.length} [${post.join(', ')}]`);
    rep.log(`[${kind}] screen: ${flat(await P.screen(), 60)}`);
    await P.tap('#prBack').catch(() => {});   // back to the PK home
    await sleep(600);
  }
  rep.log('errors', P.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 600)); }
await E.done();
process.exit(0);
