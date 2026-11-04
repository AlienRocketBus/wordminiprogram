/* TI-1 ladder: with the ordered query refused and >=40 stale open rooms, do two kids ever meet? */
import { H, overlay, phone, toLadderHome, flat } from './common.mjs';
const [N, REFUSE] = [Number(process.argv[2] || 45), process.argv[3] !== 'ok'];
const srv = await H.startStatic(); const browser = await H.launchBrowser();
const live = [], names = {};
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
const day = 86400000, old = Date.now() - 3 * day;
for (let i = 0; i < N; i++) {
  emu.seedDoc('hansen_pk_rooms', { _id: 'rold' + String(i).padStart(3, '0'), status: 'open', isPrivate: false, code: '', hostId: '1380000' + String(1000 + i), hostName: '旧版' + i, hostRating: 1000, guestId: '', guestName: '', seed: i, wordCount: 10, createdAt: old + i * 1000, heartbeatAt: old + i * 1000, hostBeat: old + i * 1000, guestBeat: 0 }, '1700000000000000' + String(100 + i), 3 * day);
}
const stats = {};
const refuse = (ph) => overlay(ph, (b) => b.action === 'database.queryDocument' && b.collectionName === 'hansen_pk_rooms' && Array.isArray(b.order) && b.order.length,
  () => ({ status: 200, body: { code: 'DATABASE_REQUEST_FAILED', message: '[FailedOperation] sort field has no index (emulated)', requestId: 'x' } }), stats);
const out = { N, refuse: REFUSE, timeline: [] };
const T0 = Date.now(); const s = () => Math.round((Date.now() - T0) / 1000);
try {
  const A = await phone(browser, emu, srv, 'A', '13800000081', '小蜂A', live, names);
  const B = await phone(browser, emu, srv, 'B', '13800000082', '小蜂B', live, names);
  if (REFUSE) { await refuse(A); await refuse(B); }
  await toLadderHome(A); await A.tap('#ldGo');
  await A.waitScreen(/等对手进来/, { timeout: 45000 });
  out.timeline.push(`${s()}s A 等对手进来`);
  await toLadderHome(B); await B.tap('#ldGo');
  out.timeline.push(`${s()}s B 开始排位`);
  const tB = Date.now();
  let met = null, lastB = '', lastA = '';
  while (Date.now() - tB < 90000) {
    const a = await H.battleView(A), b = await H.battleView(B);
    if (a && b) { met = Math.round((Date.now() - tB) / 1000); break; }
    const sb = flat(await B.screen()).slice(0, 60), sa = flat(await A.screen()).slice(0, 60);
    if (sb !== lastB) { out.timeline.push(`${s()}s B: ${sb}`); lastB = sb; }
    if (sa !== lastA) { out.timeline.push(`${s()}s A: ${sa}`); lastA = sa; }
    await H.sleep(1000);
  }
  out.metAfterSecFromB = met;
  out.openLiveRooms = H.roomDocs(emu).filter((d) => d.kind === 'room' && d.status === 'open').length;
  out.refusedOrderedQueries = stats.hits || 0;
  out.pageErrors = live.map((p) => p.errors.length);
} catch (e) { out.err = String(e && e.message || e).slice(0, 400); }
console.log(JSON.stringify(out, null, 1));
for (const p of live) await p.close();
srv.close(); await browser.close();
process.exit(0);
