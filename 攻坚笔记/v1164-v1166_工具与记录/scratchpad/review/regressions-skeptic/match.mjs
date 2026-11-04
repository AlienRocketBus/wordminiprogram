/* Skeptic: cloud calls per phone per phase for one game, classified by WHAT is read.
 * MODE=A (ladder) | B | C (public room)   HOSTWAIT=s   PACE=ms (first answer after word shows)   LAT=ms */
const H = await import(process.env.HARNESS || '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs');
const MODE = process.env.MODE || 'A';
const HOSTWAIT = Number(process.env.HOSTWAIT || 20) * 1000;
const PACE = Number(process.env.PACE || 5000);
const LAT = Number(process.env.LAT || 80);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: LAT, jitterMs: 80, consistencyLagMs: 400 } });
const log = [];   /* my own request log, one row per real (non-OPTIONS) Tencent request */
function attachLog(p) {
  p.ctx.on('request', (q) => {
    try {
      const u = new URL(q.url());
      if (!/tencentcloudapi\.com$/.test(u.hostname) || q.method() === 'OPTIONS') return;
      let b = {}; try { b = JSON.parse(q.postData() || '{}'); } catch (e) {}
      let qq = b.query; if (typeof qq === 'string') { try { qq = JSON.parse(qq); } catch (e) {} }
      const a = String(b.action || ('AUTH ' + u.pathname)).replace('database.', '');
      let cls = a + ' ' + (b.collectionName || '');
      if (a === 'queryDocument' || a === 'countDocument') {
        if (qq && typeof qq._id === 'string') {
          const id = qq._id;
          cls = 'READ ' + (/_s\d+$/.test(id) ? 'seat' : /_w\d+$/.test(id) ? 'win' : (b.collectionName === 'hansen_pk_rooms' ? 'room' : b.collectionName)) + '(id)';
        } else {
          const ks = Object.keys(qq || {}).sort().join(',');
          cls = 'READ where[' + ks + '] ' + b.collectionName;
        }
      } else if (a === 'updateDocument') cls = 'WRITE update ' + b.collectionName + (qq && qq._id ? (/_s\d+$/.test(qq._id) ? ' seat' : /_w\d+$/.test(qq._id) ? ' win' : ' room') : '');
      else if (a === 'addDocument') cls = 'WRITE add ' + b.collectionName;
      else if (a === 'deleteDocument') cls = 'WRITE remove ' + b.collectionName;
      log.push({ t: Date.now(), who: p.name, cls });
    } catch (e) {}
  });
}
const PK_READY = () => !!(window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI && window.HansenLadderUI && window.HansenSbProfile && window.HANSEN_VOCAB_ALL);
async function phone(name, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, { name, ready: PK_READY });
  const r = await H.loginPhone(p, '1350000' + String(Math.floor(Math.random() * 9000) + 1000));
  await p.eval(async (n) => { window.HansenSbProfile.setName(n); for (let i = 0; i < 60 && !(window.HansenSbProfile.readProfile() || {}).cid; i++) await new Promise((z) => setTimeout(z, 250)); }, nick);
  p.nick = nick;
  if (!(r && r.ok)) console.log('login fail', JSON.stringify(r));
  await p.page.reload({ waitUntil: 'domcontentloaded' });
  await p.page.waitForFunction(PK_READY, null, { timeout: 45000 });
  await H.sleep(3000);
  attachLog(p);
  return p;
}
function summary(who, t0, t1, label) {
  const rows = log.filter((x) => x.who === who && x.t >= t0 && x.t < t1);
  const secs = (t1 - t0) / 1000, by = {};
  let rd = 0, wr = 0, au = 0;
  for (const x of rows) { by[x.cls] = (by[x.cls] || 0) + 1; if (/^READ/.test(x.cls)) rd++; else if (/^WRITE/.test(x.cls)) wr++; else au++; }
  console.log(`\n--- ${label} [${who}] ${secs.toFixed(0)} s: reads=${rd} (${(rd / secs).toFixed(2)}/s) writes=${wr} (${(wr / secs).toFixed(2)}/s) other=${au}`);
  for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log('     ', String(v).padStart(4), k, `(${(v / secs).toFixed(2)}/s)`);
  return { rd, wr, au, secs };
}
const A = await phone('host', '小蜂房主'), B = await phone('guest', '小蜂客人');
const T = {};
if (MODE === 'A') {
  await A.tap('#pkLadder'); await H.answerNameIfAsked(A, A.nick); await A.waitScreen(/开始排位/, { timeout: 8000 });
  T.aGo = Date.now(); await A.tap('#ldGo');
  await A.waitScreen(/等对手进来/, { timeout: 60000 }); T.aHost = Date.now();
  await H.sleep(HOSTWAIT); T.bGo = Date.now();
  await B.tap('#pkLadder'); await H.answerNameIfAsked(B, B.nick); await B.waitScreen(/开始排位/, { timeout: 8000 });
  T.bTap = Date.now(); await B.tap('#ldGo');
} else {
  await A.tap('#pkRooms'); await H.answerNameIfAsked(A, A.nick); await A.waitScreen(/开一间/, { timeout: 8000 });
  T.aGo = Date.now(); await A.tap('#prNew'); await A.tap(`.pr_mode[data-mode="${MODE}"]`);
  await A.waitScreen(/等对手进来/, { timeout: 15000 }); T.aHost = Date.now();
  await H.sleep(HOSTWAIT); T.bGo = Date.now();
  await B.tap('#pkRooms'); await H.answerNameIfAsked(B, B.nick); await B.waitScreen(/开一间/, { timeout: 8000 });
  T.bTap = Date.now();
  const rid = (H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid && d.status === 'open') || {})._id;
  await H.until(async () => { const h = await B.hitTest(`button[data-rid="${rid}"]`, { timeout: 400 }); if (h.ok) return h; await B.tap('#prRef').catch(() => {}); return null; }, { timeout: 25000, interval: 1000 });
  await B.tap(`button[data-rid="${rid}"]`);
}
await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: 60000, interval: 250 });
T.battle = Date.now();
const room = H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid && d.status !== 'done');
const words = await H.wordsOfRoom(A, room);
const ok = words.map((w, i) => (H.typeable(w) ? i : -1)).filter((i) => i >= 0);
/* first typer alternates; in B/C the other side types 2.5 s after */
const typed = { host: new Set(), guest: new Set() }, seen = { host: {}, guest: {} }, done = {};
const P = { host: A, guest: B };
let last = {};
const tq0 = Date.now();
while (Date.now() - tq0 < 400000) {
  const v = { host: await H.battleView(A), guest: await H.battleView(B) };
  if (!v.host && !v.guest && (last.host || last.guest)) break;
  for (const s of ['host', 'guest']) {
    const x = v[s]; if (x) last[s] = x;
    if (!x || x.round < 0 || x.disabled) continue;
    const w = words[x.round]; const k = ok.indexOf(x.round);
    if (!w || k < 0 || typed[s].has(x.round)) continue;
    if (!seen[s][x.round]) seen[s][x.round] = Date.now();
    const first = k % 2 ? 'guest' : 'host';
    const go = (first === s && Date.now() - seen[s][x.round] >= PACE) || (first !== s && MODE !== 'A' && done[x.round] && Date.now() - done[x.round] >= 2500);
    if (!go) continue;
    typed[s].add(x.round);
    try { await H.typeWord(P[s], w.en); } catch (e) { console.log('type fail', s, x.round, e.message.slice(0, 60)); }
    if (first === s) done[x.round] = Date.now();
  }
  await H.sleep(150);
}
T.end = Date.now();
const rH = await H.waitResult(A, 60000), rG = await H.waitResult(B, 60000);
T.result = Date.now();
await H.sleep(20000); T.after = Date.now();
console.log(`==== MODE ${MODE} LAT ${LAT} PACE ${PACE} words ${words.length} typeable ${ok.length}; battle ${((T.end - T.battle) / 1000).toFixed(0)} s; result host ${rH && rH.mine}:${rH && rH.theirs} guest ${rG && rG.mine}:${rG && rG.theirs}`);
summary('host', T.aGo, T.aHost, MODE === 'A' ? 'host ladder matching (tap → own room)' : 'host create room');
summary('host', T.aHost, T.bGo, 'host waiting alone');
summary('guest', T.bTap, T.battle, 'guest find + join + ack');
summary('host', T.bGo, T.battle, 'host while guest joins');
const bh = summary('host', T.battle, T.end, 'BATTLE');
const bg = summary('guest', T.battle, T.end, 'BATTLE');
summary('host', T.end, T.after, 'result + 20 s after');
summary('guest', T.end, T.after, 'result + 20 s after');
const totH = log.filter((x) => x.who === 'host' && x.t >= T.aGo && x.t < T.after).length;
const totG = log.filter((x) => x.who === 'guest' && x.t >= T.bGo && x.t < T.after).length;
console.log(`\nTOTAL calls this game: host ${totH}, guest ${totG}, both ${totH + totG}`);
/* per-second trace of the host for the first 12 s of battle */
const tr = log.filter((x) => x.who === 'host' && x.t >= T.battle + 6000 && x.t < T.battle + 18000);
console.log('\nhost trace (battle +6..+18 s):');
for (const x of tr) console.log('   +' + ((x.t - T.battle) / 1000).toFixed(2), x.cls);
/* emulator-side cross-check: count by uid from the emulator log for the battle window */
const emuCount = (uid) => emu.log.filter((e) => e.uid === uid && e.method !== 'OPTIONS' && e.t >= T.battle && e.t < T.end && e.path === '/web').length;
console.log(`emulator cross-check battle window: host ${emuCount(A.cloudUid)} vs my log ${bh.rd + bh.wr}; guest ${emuCount(B.cloudUid)} vs my log ${bg.rd + bg.wr}`);
console.log('errors', A.errors.concat(B.errors).slice(0, 3).join(' | ') || 'none', 'leaks', A.leaks.length + B.leaks.length);
await A.close(); await B.close(); srv.close(); await browser.close();
