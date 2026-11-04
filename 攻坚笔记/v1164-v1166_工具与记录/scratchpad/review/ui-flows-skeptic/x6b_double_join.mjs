// UI-6 skeptic b: after a double tap on a mode card, a guest joins. Do both host loops write to the room?
import { env, sleep, H, report, flat, rtOf, roomDocs, myOpenRoom } from './sk.mjs';
const rep = report('UI-6 skeptic b · double-tapped room, guest joins');
const E = await env({ latencyMs: 80, jitterMs: 40 });
try {
  const Hh = await E.phone('房主', { nick: '房主蜂' });
  const G = await E.phone('客人', { nick: '客人蜂' });
  await Hh.tap('#pkRooms'); await Hh.waitScreen(/开一间/, { timeout: 8000 });
  await Hh.tap('#prNew'); await Hh.waitScreen(/选个玩法/, { timeout: 4000 });
  const c = await Hh.hitTest('.pr_mode[data-mode="C"]');
  await Hh.page.touchscreen.tap(c.x, c.y); await sleep(150); await Hh.page.touchscreen.tap(c.x, c.y);
  await Hh.waitScreen(/等对手进来/, { timeout: 15000 });
  const rid = myOpenRoom(E.emu, Hh.cloudUid)._id;
  const n0 = E.emu.log.length;
  await G.tap('#pkRooms'); await G.waitScreen(/开一间/, { timeout: 8000 });
  await H.until(async () => { const h = await G.hitTest(`button[data-rid="${rid}"]`, { timeout: 300 }); if (h.ok) return h; await G.tap('#prRef').catch(() => {}); return null; }, { timeout: 20000, interval: 900 });
  await G.tap(`button[data-rid="${rid}"]`);
  const ok = await H.until(async () => { const a = await rtOf(Hh.page), b = await rtOf(G.page); return a && b; }, { timeout: 30000, interval: 200 });
  await sleep(2000);
  const hostWrites = E.emu.log.slice(n0).filter((e) => e.uid === Hh.cloudUid && /update/i.test(e.action || '') && e.docId === rid).length;
  const hostUpd = E.emu.writes ? E.emu.writes.filter((w) => w && JSON.stringify(w).includes(rid) && JSON.stringify(w).includes('"status":"playing"')).length : 'n/a';
  rep.log(`both on the battle screen: ${!!ok}; host room-doc updates since the guest tapped: ${hostWrites}; writes containing status:playing: ${hostUpd}`);
  rep.log('guest sees:', flat(await G.screen(), 80));
  rep.log('errors', Hh.errors, G.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 500)); }
await E.done(); process.exit(0);
