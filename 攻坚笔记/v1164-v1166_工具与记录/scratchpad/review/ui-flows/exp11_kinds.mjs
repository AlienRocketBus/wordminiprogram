// EXP11: error routes by kind on spelling_pk.html — exact screen texts.
//   b) taken  (stale 进去打 after someone else took the seat)
//   c) gone   (stale 进去打 after the host closed the room)
//   d) self   (same account on a 2nd phone: list hint + entering its own private code)
//   e) network mid-wait (lobby room)    f) network mid-wait (ranked room)    a) slow (hanging DB) on the ladder
import { setup, docs, sleep, report, H, toLobby, openRoom } from './lib.mjs';
const rep = report('EXP11 kinds');
const env = await setup({ permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 });
const flat = (s) => String(s || '').replace(/\s+/g, ' ');
async function ensureLobby(p) {
  if ((await p.hitTest('#prNew', { timeout: 600 })).ok) return;
  for (const b of ['#prBack2', '#prResBack', '#prBack']) { if ((await p.hitTest(b, { timeout: 300 })).ok) { await p.tap(b).catch(() => {}); await sleep(600); if ((await p.hitTest('#prNew', { timeout: 600 })).ok) return; } }
  await toLobby(p);
}
async function listAndWait(g, rid) {
  await ensureLobby(g);
  return H.until(async () => { const h = await g.hitTest(`button[data-rid="${rid}"]`, { timeout: 400 }); if (h.ok) return h; await g.tap('#prRef').catch(() => {}); return null; }, { timeout: 20000, interval: 900 });
}
try {
  const Hh = await env.phone('房主', { nick: '房主蜂' });
  const G1 = await env.phone('客一', { nick: '客一蜂' });
  const G2 = await env.phone('客二', { nick: '客二蜂' });
  // b) taken
  await toLobby(Hh);
  const R = await openRoom(env.emu, Hh, 'C');
  await listAndWait(G2, R._id);                 // G2 sees the room in its list
  await listAndWait(G1, R._id);
  await G1.tap(`button[data-rid="${R._id}"]`);  // G1 takes the seat
  await H.until(async () => (await H.battleView(G1)) && (await H.battleView(Hh)), { timeout: 30000 });
  await G2.tap(`button[data-rid="${R._id}"]`);  // stale button
  const sb = await G2.waitScreen(/开一间/, { timeout: 30000 }).catch((e) => e.lastText || '');
  rep.log('b) taken -> G2 sees:', flat(sb).slice(0, 140));
  // c) gone: G1 + host: host leaves via reload (pagehide), G2 had a stale list entry from a new room
  await Hh.page.reload({ waitUntil: 'domcontentloaded' }); await Hh.page.waitForFunction(() => !!(window.HansenPkRoomUI && window.HANSEN_VOCAB_ALL), null, { timeout: 30000 }); await sleep(1500);
  await G1.waitScreen(/对手已离场|对手刚才没进来|你赢了|这局输了|打平/, { timeout: 20000 }).catch(() => '');
  rep.log('c0) host reloaded mid-battle -> guest G1 sees:', flat(await G1.screen()).slice(0, 120));
  await G1.tap('#prBack2').catch(() => {}); await sleep(600);
  await ensureLobby(Hh);
  const R2 = await openRoom(env.emu, Hh, 'C');
  await listAndWait(G2, R2._id);
  await Hh.tap('#prBack');                       // host closes the room
  await sleep(1500);
  await G2.tap(`button[data-rid="${R2._id}"]`);
  const sc = await G2.waitScreen(/开一间/, { timeout: 30000 }).catch((e) => e.lastText || '');
  rep.log('c) gone -> G2 sees:', flat(sc).slice(0, 140));
  // d) self: same account on a second phone
  await ensureLobby(Hh);
  await Hh.tap('#prPriv'); await Hh.tap('.pr_mode[data-mode="C"]');
  await Hh.waitScreen(/把这个码发给好友/, { timeout: 15000 });
  const code = await Hh.eval(() => (document.getElementById('prCodeBig') || {}).textContent || '');
  const Twin = await env.phone('同号', { nick: '房主蜂', login: false });
  await H.loginPhone(Twin, Hh.number);
  await toLobby(Twin);
  await sleep(1500);
  rep.log('d) same account, 2nd phone lobby:', flat(await Twin.screen()).slice(0, 160));
  await Twin.eval(() => { const d = document.querySelector('details'); if (d) d.open = true; return true; });
  await Twin.tap('#prCode'); await Twin.type(code); await Twin.tap('#prJoinCode');
  await sleep(4500);
  rep.log(`d) 2nd phone enters its own code ${code}:`, flat(await Twin.eval(() => (document.getElementById('prCodeTip') || {}).textContent || '')));
  await Twin.close();
  // e) network lost while a lobby room waits
  await Hh.page.reload({ waitUntil: 'domcontentloaded' }); await Hh.page.waitForFunction(() => !!(window.HansenPkRoomUI && window.HANSEN_VOCAB_ALL), null, { timeout: 30000 }); await sleep(1500);
  await ensureLobby(Hh);
  await openRoom(env.emu, Hh, 'C');
  const cut = env.emu.fault({ uid: Hh.cloudUid, db: true, do: 'abort' });
  const se = await Hh.waitScreen(/连不上网络|网络/, { timeout: 40000 }).catch((e) => e.lastText || '');
  rep.log('e) lobby room, network gone ->', flat(se).slice(0, 180));
  cut.remove();
  await Hh.tap('#prBack').catch(() => {}); await sleep(500);
  // f) network lost while a ranked room waits
  for (const b of ['#prBack', '#prBack']) { await G2.tap(b, { timeout: 1500 }).catch(() => {}); await sleep(500); }
  await G2.tap('#pkLadder'); await G2.waitScreen(/开始排位/, { timeout: 8000 });
  await G2.tap('#ldGo');
  await G2.waitScreen(/等对手进来/, { timeout: 40000 });
  const cut2 = env.emu.fault({ uid: G2.cloudUid, db: true, do: 'abort' });
  const seen = []; const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const s = flat(await G2.screen()).slice(0, 70);
    if (!seen.length || seen[seen.length - 1].s !== s.replace(/已等 \d+ 秒/, '已等 N 秒')) seen.push({ t: Date.now() - t0, s: s.replace(/已等 \d+ 秒/, '已等 N 秒') });
    if (/连不上网络/.test(s) && /技术信息|重新找对手/.test(flat(await G2.screen()))) break;
    await sleep(400);
  }
  rep.log('f) ranked room, network gone -> screens:', seen.map((x) => `+${Math.round(x.t / 1000)}s 「${x.s}」`).join('  →  '));
  cut2.remove();
  await G2.tap('#ldCancel').catch(() => {});
  // a) slow: every DB request hangs
  for (const b of ['#prBack2', '#prBack', '#prBack']) { await G1.tap(b, { timeout: 1500 }).catch(() => {}); await sleep(500); }
  await G1.tap('#pkLadder').catch(() => {}); await G1.waitScreen(/开始排位/, { timeout: 8000 });
  const hang = env.emu.fault({ uid: G1.cloudUid, db: true, do: 'hang', ms: 30000 });
  await G1.tap('#ldGo');
  const seenA = []; const t1 = Date.now();
  while (Date.now() - t1 < 90000) {
    const s = flat(await G1.screen()).replace(/已等 \d+ 秒/, '已等 N 秒').slice(0, 90);
    if (!seenA.length || seenA[seenA.length - 1].s !== s) seenA.push({ t: Date.now() - t1, s });
    if (/连不上网络|这次没成功/.test(s)) break;
    await sleep(500);
  }
  rep.log('a) slow -> screens:', seenA.map((x) => `+${Math.round(x.t / 1000)}s 「${x.s}」`).join('  →  '));
  rep.log('a) final:', flat(await G1.screen()).slice(0, 220));
  hang.remove();
  for (const p of [Hh, G1, G2]) rep.log(`[${p.name}] errors`, p.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
