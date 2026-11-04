// UI-10 / UI-11 skeptic (visibility emulated; JS timers keep running, as in a WebView that does not pause timers)
//  ui10: tap 开始排位, then the page goes to the background on the matching screen
//  ui11: mid-word, hide for HIDE ms, then come back; how much time is given back?
import { env, sleep, H, report, flat, setHidden, rtOf, stOf, roomDocs, myOpenRoom } from './sk.mjs';
const V = process.argv[2] || 'ui10';
const rep = report(`skeptic · ${V}`);
const E = await env({ latencyMs: 60, jitterMs: 30 });
try {
  if (V === 'ui10') {
    const P = await E.phone('切走的孩子', { nick: '切走蜂' });
    const Q = await E.phone('另一个孩子', { nick: '前台蜂' });
    await P.tap('#pkLadder'); await P.waitScreen(/开始排位/, { timeout: 8000 });
    await P.tap('#ldGo'); await P.waitScreen(/正在找对手/, { timeout: 4000 });
    await sleep(1500);
    await setHidden(P.page, true);
    const tHide = Date.now();
    rep.log('P hidden on the matching screen');
    const room = await H.until(async () => myOpenRoom(E.emu, P.cloudUid) || null, { timeout: 40000, interval: 300 });
    rep.log(`${Math.round((Date.now() - tHide) / 1000)} s after hiding: hidden P opened ranked room ${room && room._id}`);
    await Q.tap('#pkLadder'); await Q.waitScreen(/开始排位/, { timeout: 8000 });
    await Q.tap('#ldGo');
    const qb = await H.until(async () => H.battleView(Q), { timeout: 30000, interval: 300 });
    rep.log('Q matched into a battle with hidden P:', !!qb, qb ? `opp「${qb.oppName}」` : '');
    // wait past the 30 s background clean-up
    while (Date.now() - tHide < 36000) await sleep(500);
    const st = await stOf(P.page);
    const R2 = room && roomDocs(E.emu).find((d) => d._id === room._id);
    rep.log(`${Math.round((Date.now() - tHide) / 1000)} s after hiding: hidden P state ${JSON.stringify(st)}; room status ${R2 && R2.status}`);
    await setHidden(P.page, false);
    await sleep(800);
    rep.log('P comes back and sees:', flat(await P.screen(), 140));
    rep.log('errors', P.errors, Q.errors);
  } else {
    const HIDE = Number(process.argv[3] || 8000);
    const Hh = await E.phone('房主', { nick: '房主蜂' });
    const G = await E.phone('客人', { nick: '客人蜂' });
    await Hh.tap('#pkRooms'); await Hh.waitScreen(/开一间/, { timeout: 8000 });
    await Hh.tap('#prNew'); await Hh.tap('.pr_mode[data-mode="A"]');
    await Hh.waitScreen(/等对手进来/, { timeout: 15000 });
    const rid = myOpenRoom(E.emu, Hh.cloudUid)._id;
    await G.tap('#pkRooms'); await G.waitScreen(/开一间/, { timeout: 8000 });
    await H.until(async () => { const h = await G.hitTest(`button[data-rid="${rid}"]`, { timeout: 300 }); if (h.ok) return h; await G.tap('#prRef').catch(() => {}); return null; }, { timeout: 20000, interval: 900 });
    await G.tap(`button[data-rid="${rid}"]`);
    await H.until(async () => { const a = await rtOf(Hh.page), b = await rtOf(G.page); return a && b && a.idx === 0 && b.idx === 0; }, { timeout: 30000, interval: 100 });
    await sleep(1000);
    const a0 = await rtOf(G.page);
    const left0 = a0.deadline - Date.now();
    await setHidden(G.page, true);
    const t1 = Date.now();
    await sleep(HIDE);
    await setHidden(G.page, false);
    const away = Date.now() - t1;
    await sleep(1300);   // let the 1 s poll interval run once after coming back
    const a1 = await rtOf(G.page);
    const left1 = a1 && a1.idx === 0 ? a1.deadline - Date.now() : null;
    const elapsed = Date.now() - t1 + 0;
    rep.log(`guest word 1: ${left0} ms left before hiding ${away} ms; ${left1} ms left 1.3 s after coming back`);
    if (left1 != null) rep.log(`time given back ≈ ${Math.round(left1 - (left0 - elapsed))} ms (v1126 rule: grace capped at 3000 ms)`);
    const hr = await rtOf(Hh.page);
    rep.log(`host on word ${hr && hr.idx + 1} with ${hr ? hr.deadline - Date.now() : '-'} ms left`);
  }
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 600)); }
await E.done();
process.exit(0);
