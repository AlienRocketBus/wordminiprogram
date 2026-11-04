// UI-4 skeptic: does 「同一个账号在另一台设备上开着房」 appear right after the kid's OWN room closes?
// variants: timeout (free room, real 2-minute wait) | bg (waiting room hidden 31 s) | ladder (ranked room times out, then 开始排位)
import { env, sleep, H, roomDocs, myOpenRoom, report, flat, setHidden } from './sk.mjs';
const V = process.argv[2] || 'timeout';
const LAG = Number(process.argv[3] || 0);
const rep = report(`UI-4 skeptic · ${V} · consistencyLag ${LAG} ms`);
const E = await env({ latencyMs: 60, jitterMs: 40, consistencyLagMs: LAG });
const SAME = /同一个账号在另一台设备上开着房/;
try {
  const P = await E.phone('孩子', { nick: '等等蜂' });
  // nobody else in this emulator: this account has exactly one device
  if (V === 'timeout' || V === 'bg') {
    await P.tap('#pkRooms'); await P.waitScreen(/开一间/, { timeout: 8000 });
    await P.tap('#prNew'); await P.tap('.pr_mode[data-mode="C"]');
    await P.waitScreen(/等对手进来/, { timeout: 15000 });
    const rid = myOpenRoom(E.emu, P.cloudUid)._id;
    rep.log('waiting in', rid);
    if (V === 'bg') { await sleep(2000); await setHidden(P.page, true); rep.log('page hidden'); await sleep(31500); await setHidden(P.page, false); rep.log('page visible again'); }
    const txt = await P.waitScreen(V === 'bg' ? /切出去太久/ : /等了两分钟/, { timeout: V === 'bg' ? 8000 : 140000, interval: 300 });
    const tReason = Date.now();
    rep.log('reason shown:', flat(txt, 200));
    const samples = [];
    for (let i = 0; i < 12; i++) { const s = flat(await P.screen(), 400); samples.push([Date.now() - tReason, SAME.test(s)]); await sleep(500); }
    rep.log('same-account warning over the next 6 s [ms,shown]:', samples.map((x) => x[0] + ':' + (x[1] ? 'Y' : 'n')).join(' '));
    rep.log('lobby now:', flat(await P.screen(), 300));
    rep.log('own room still in DB:', roomDocs(E.emu).filter((d) => d._id === rid).map((d) => d.status).join(',') || 'removed');
  } else {
    await P.eval(() => { window.__hsnLadderWaitSec = 2; return 1; });   // documented test knob: self-host after 2 s
    await P.tap('#pkLadder'); await P.waitScreen(/开始排位/, { timeout: 8000 });
    await P.tap('#ldGo');
    await P.waitScreen(/等对手进来/, { timeout: 20000 });
    const rid = myOpenRoom(E.emu, P.cloudUid)._id;
    rep.log('ranked room', rid, '— waiting for the 2-minute timeout');
    await P.eval(() => { window.__hsnLadderWaitSec = 60; return 1; });   // later matching stays on the matching screen
    await P.waitScreen(/暂时没有对手/, { timeout: 150000, interval: 300 });
    rep.log('ladder home shows the timeout note');
    for (const wait of [0, 1500]) {
      await sleep(wait);
      await P.tap('#ldGo');
      const t0 = Date.now(), samples = [];
      while (Date.now() - t0 < 4000) { const s = flat(await P.screen(), 400); samples.push((Date.now() - t0) + ':' + (SAME.test(s) ? 'Y' : 'n')); await sleep(250); }
      rep.log(`tap 开始排位 ${wait} ms after the note: warning samples`, samples.join(' '));
      rep.log('own room in DB:', roomDocs(E.emu).filter((d) => d._id === rid).map((d) => d.status).join(',') || 'removed');
      await P.tap('#ldCancel').catch((e) => rep.log('cancel tap failed', e.message.slice(0, 80)));
      await P.waitScreen(/开始排位/, { timeout: 8000 }).catch(() => {});
    }
  }
  rep.log('errors', P.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 600)); }
await E.done();
process.exit(0);
