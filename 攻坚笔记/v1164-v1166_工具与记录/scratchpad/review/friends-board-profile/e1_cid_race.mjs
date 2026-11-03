/* E1: 竞赛 ID（cid）在「同一秒注册 + 读延迟」下是否唯一、是否发得出来
 * 真页面 spelling_pk.html + 真 SDK + 模拟云端（只模拟网络）。
 * 环境变量：LAG（读延迟 ms）、N（同时登录几个孩子）、ROUNDS（重复几轮）
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const LAG = Number(process.env.LAG || 0);
const N = Number(process.env.N || 4);
const ROUNDS = Number(process.env.ROUNDS || 1);
const READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenFriendsUI && window.HansenSbProfile);

const srv = await H.startStatic();
const browser = await H.launchBrowser();
const summary = [];
try {
  for (let round = 0; round < ROUNDS; round++) {
    const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 60, consistencyLagMs: LAG, seed: 1164 + round } });
    if (process.env.LAGMODE === 'rand') {
      /* 每个请求随机落到一个落后 LAGMIN..LAGMAX 毫秒的副本上（同一个请求内看到的是一致的快照） */
      const lo = Number(process.env.LAGMIN || 300), hi = Number(process.env.LAGMAX || 1500);
      let cached = null, s = 99 + round;
      const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      emu.knobs.consistencyLagMs = () => { if (cached == null) { cached = lo + Math.floor(rng() * (hi - lo)); queueMicrotask(() => { cached = null; }); } return cached; };
    }
    const users = [];
    for (let i = 0; i < N; i++) { const u = 'kid' + round + '_' + i; emu.seedUser({ username: u, password: 'pw123456', name: u }); users.push(u); }
    const phones = await Promise.all(users.map((u, i) => H.openPhone(browser, emu, srv.origin, { name: 'P' + i, ready: READY })));
    await Promise.all(phones.map((p, i) => p.eval((n) => window.HansenSbProfile.setName(n), '小孩' + i)));
    /* 同一秒一起登录 */
    const t0 = Date.now();
    const res = await Promise.all(phones.map((p, i) => H.loginPassword(p, users[i], 'pw123456')));
    const ms = Date.now() - t0;
    const local = await Promise.all(phones.map((p) => p.eval(() => (window.HansenSbProfile.readProfile() || {}).cid || 0)));
    const prof = (emu.dump('sb_profile') || []).map((d) => ({ uid: d._id.slice(-4), cid: d.cid, createdAt: d.createdAt && d.createdAt.$date }));
    prof.sort((a, b) => a.createdAt - b.createdAt);
    const cids = prof.map((p) => p.cid);
    const nonzero = cids.filter((c) => c > 0);
    const dup = nonzero.filter((c, i) => nonzero.indexOf(c) !== i);
    const zeros = cids.filter((c) => !(c > 0)).length;
    console.log(`round ${round} LAG=${process.env.LAGMODE==='rand'?('rand '+(process.env.LAGMIN||300)+'-'+(process.env.LAGMAX||1500)):LAG} N=${N} login ${ms}ms ok=${res.map((r) => r && r.ok).join(',')}`);
    console.log('  local cids :', local.join(','));
    console.log('  sb_profile :', prof.map((p) => `${p.uid}:cid=${p.cid}@+${p.createdAt - prof[0].createdAt}ms`).join('  '));
    console.log(`  => duplicates=${JSON.stringify(dup)} zeros=${zeros}`);
    summary.push({ round, dup: dup.length, zeros });
    /* 发不到号的那个孩子：好友页说什么 */
    const zi = local.findIndex((c) => !c);
    if (zi >= 0) {
      const txt = await phones[zi].eval(async () => {
        window.HansenFriendsUI.open();
        await new Promise((r) => setTimeout(r, 3000));
        const el = document.getElementById('hsn_friends_screen');
        const signed = window.HansenAuth.isSignedIn();
        const t = el ? el.innerText.replace(/\s+/g, ' ').slice(0, 260) : '';
        window.HansenFriendsUI.close();
        return { signed, t };
      });
      console.log(`  P${zi} (cid=0) signedIn=${txt.signed} friends screen: ${txt.t}`);
    }
    for (const p of phones) await p.close();
  }
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
const anyDup = summary.filter((s) => s.dup > 0).length, anyZero = summary.filter((s) => s.zeros > 0).length;
console.log(`\nSUMMARY LAG=${LAG} N=${N}: rounds with duplicate cid = ${anyDup}/${summary.length}; rounds with a kid left without cid = ${anyZero}/${summary.length}`);
