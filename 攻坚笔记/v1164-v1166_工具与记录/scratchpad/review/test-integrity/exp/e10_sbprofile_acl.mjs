/* E10: emulator assumption "sb_profile = READONLY" (defaultCollections) flipped.
 * The handoff doc (交接_必读_给下一个对话.md:232) says the real permission of sb_profile was never seen.
 * Usage: node e10_sbprofile_acl.mjs <READONLY|PRIVATE|ADMINWRITE> */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
const ACLNAME = process.argv[2] || 'PRIVATE';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ collections: H.defaultCollections({ sb_profile: H.ACL[ACLNAME] }), knobs: { permissionMode: 'legacy', latencyMs: 40 } });
const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenLadderBoard && window.HansenSbProfile && window.HansenPkRecord);
const out = { ACL: ACLNAME, kids: [] };
try {
  const ph = [];
  for (const [i, nick] of [['1', '小一'], ['2', '小二'], ['3', '小三']]) {
    const p = await H.openPhone(browser, emu, srv.origin, { name: nick, ready: READY });
    const r = await H.loginPhone(p, '1380000095' + i);
    const prof = await p.eval(async (n) => {
      window.HansenSbProfile.setName(n);
      for (let k = 0; k < 40 && !(window.HansenSbProfile.readProfile() || {}).cid; k++) await new Promise((z) => setTimeout(z, 250));
      return window.HansenSbProfile.readProfile();
    }, nick);
    out.kids.push({ nick, login: r.ok, cid: prof && prof.cid });
    ph.push(p);
  }
  /* everyone finishes placement and uploads a score */
  for (const p of ph) out['push_' + p.name] = await p.eval(async () => {
    const R = window.HansenPkRecord;
    const G = (res) => ({ mode: 'A', result: res, oppName: '对手', myScore: 300, oppScore: 100, words: 5, correct: 4, totalMs: 7000, firstWins: 3, fastestMs: 800, oppRating: 1000 });
    [G('win'), G('win'), G('lose'), G('win')].forEach((g) => R.record(g));
    const x = await window.HansenLadderBoard.push(); return { ok: x.ok, kind: x.kind };
  });
  const top = await ph[2].eval(async () => { window.HansenLadderBoard._clearCacheForTest(); const r = await window.HansenLadderBoard.fetchTop(); return { ok: r.ok, names: (r.list || []).map((x) => x.name), myRank: r.myRank, kind: r.kind }; });
  out.boardSeenByKid3 = top;
  /* kid 1 tries to add kid 2 as a friend by kid 2's competition ID */
  const c2 = out.kids[1].cid;
  out.addFriend_1_to_2 = await ph[0].eval(async (c) => { await window.HansenFriends._beat(); const r = await window.HansenFriends.addFriend(c); return { ok: r.ok, reason: r.reason, name: r.name }; }, c2);
} catch (e) { out.err = String(e && e.stack || e).slice(0, 400); }
console.log(JSON.stringify(out, null, 1));
await browser.close(); srv.close(); process.exit(0);
