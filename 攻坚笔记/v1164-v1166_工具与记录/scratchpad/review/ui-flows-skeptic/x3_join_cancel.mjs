// UI-3 skeptic: slow network; guest taps 进去打 then 取消 (or ← 返回) after DELAY ms.
// How long does 「正在进房，等房主确认…」 stay after the tap, and where does it land?
import { env, sleep, H, roomDocs, myOpenRoom, report, flat } from './sk.mjs';
const LAT = Number(process.argv[2] || 500), DELAY = Number(process.argv[3] || 700), BTN = process.argv[4] || '#prJoinCancel';
const rep = report(`UI-3 skeptic · latency ${LAT} ms · cancel ${DELAY} ms after 进去打 via ${BTN}`);
const E = await env({ latencyMs: LAT, jitterMs: 40 });
try {
  const Hh = await E.phone('房主', { nick: '房主蜂' });
  const G = await E.phone('客人', { nick: '客人蜂' });
  await Hh.tap('#pkRooms'); await Hh.waitScreen(/开一间/, { timeout: 15000 });
  await Hh.tap('#prNew'); await Hh.tap('.pr_mode[data-mode="C"]');
  await Hh.waitScreen(/等对手进来/, { timeout: 20000 });
  const rid = myOpenRoom(E.emu, Hh.cloudUid)._id;
  await G.tap('#pkRooms'); await G.waitScreen(/开一间/, { timeout: 15000 });
  await H.until(async () => { const h = await G.hitTest(`button[data-rid="${rid}"]`, { timeout: 300 }); if (h.ok) return h; await G.tap('#prRef').catch(() => {}); return null; }, { timeout: 30000, interval: 1500 });
  await G.tap(`button[data-rid="${rid}"]`);
  const t0 = Date.now();
  await G.waitScreen(/正在进房/, { timeout: 4000, interval: 50 });
  await sleep(Math.max(0, DELAY - (Date.now() - t0)));
  const seatAtTap = roomDocs(E.emu).some((d) => d.kind === 'seat' && d.roomId === rid && d._openid === G.cloudUid);
  await G.tap(BTN, { timeout: 2000 });
  const tTap = Date.now();
  rep.log(`tapped ${BTN} ${tTap - t0} ms after 进去打; guest seat on server at that moment: ${seatAtTap}`);
  const counters = [];
  let leftAt = 0, last = '';
  while (Date.now() - tTap < 30000) {
    const s = flat(await G.screen(), 200);
    const m = /已等 (\d+) 秒/.exec(s);
    if (/正在进房/.test(s)) { if (m) counters.push(Number(m[1])); last = s; }
    else { leftAt = Date.now(); last = s; break; }
    await sleep(250);
  }
  const uniq = [...new Set(counters)];
  rep.log(`screen stayed on 「正在进房，等房主确认…」 for ${leftAt ? leftAt - tTap : '>30000'} ms after the tap; counter values seen: ${uniq.join(',')}`);
  rep.log('then the guest sees:', last.slice(0, 160));
  rep.log('host sees:', flat(await Hh.screen(), 120));
  const docs = roomDocs(E.emu).filter((d) => d.roomId === rid || d._id === rid).map((d) => `${d.kind}:${d._id.slice(-4)}:${d.status || ''}${d.guestId ? ' g=' + d.guestId.slice(-3) : ''}`);
  rep.log('room docs now:', docs.join(' | '));
  rep.log('errors', G.errors, Hh.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 600)); }
await E.done();
process.exit(0);
