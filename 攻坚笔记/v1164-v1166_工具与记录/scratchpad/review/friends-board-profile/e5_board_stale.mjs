/* E5: 排行榜只取「分数最高的 60 条」再在本地过滤掉 30 天没打的 ——
 *     老玩家分高、早就不玩了，会把正在玩的人整个挤出榜。
 * 服务端放 STALE 条「分数高、40 天前打过」的老资料 + 2 个本周在玩的同学，再让 A 打满定级赛上传。
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const STALE = Number(process.env.STALE || 60);
const READY = () => !!(window.HansenAuth && window.HansenLadderBoard && window.HansenLadderUI && window.HansenSbProfile && window.HansenPkRecord);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const j = (x) => JSON.stringify(x);
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 20 } });
  emu.seedUser({ username: 'alice', password: 'pw123456' });
  const day = 86400000, now = Date.now();
  for (let i = 0; i < STALE; i++) emu.seedDoc('sb_profile', { _id: 'old' + i, uid: 'old' + i, name: '老玩家' + i, cid: 100 + i, ladderRating: 1600 - i, ladderGames: 30, ladderAt: now - 40 * day }, 'old' + i, 40 * day);
  emu.seedDoc('sb_profile', { _id: 'act1', uid: 'act1', name: '本周活跃甲', cid: 90, ladderRating: 1120, ladderGames: 12, ladderAt: now - 2 * day }, 'act1', 2 * day);
  emu.seedDoc('sb_profile', { _id: 'act2', uid: 'act2', name: '本周活跃乙', cid: 91, ladderRating: 1080, ladderGames: 8, ladderAt: now - 1 * day }, 'act2', 1 * day);

  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
  await A.eval(() => window.HansenSbProfile.setName('小爱'));
  await H.loginPassword(A, 'alice', 'pw123456');
  const push = await A.eval(async () => {
    const R = window.HansenPkRecord;
    const G = (res) => ({ mode: 'A', result: res, oppName: '对手', myScore: 300, oppScore: 100, words: 5, correct: 4, totalMs: 7000, firstWins: 3, fastestMs: 800, oppRating: 1000 });
    [G('win'), G('win'), G('lose'), G('win')].forEach((g) => R.record(g));
    return { push: await window.HansenLadderBoard.push(), s: R.summary() };
  });
  console.log('[A] placed, rating', push.s.rating, 'push', j(push.push));
  const top = await A.eval(async () => { window.HansenLadderBoard._clearCacheForTest(); return window.HansenLadderBoard.fetchTop(); });
  console.log(`[A] fetchTop (STALE=${STALE}): ok=${top.ok} list=${j((top.list || []).map((x) => x.name + ':' + x.rating))} myRank=${top.myRank}`);
  const rough = await A.eval(() => window.HansenLadderBoard.myRoughRank());
  console.log('[A] myRoughRank:', j(rough));
  const ui = await A.eval(async () => {
    window.HansenLadderBoard._clearCacheForTest();
    window.HansenLadderUI.open();
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const el = document.getElementById('ldBoard');
      const tx = el ? el.innerText : '';
      if (tx && !/正在|加载|读取/.test(tx)) { await new Promise((r) => setTimeout(r, 1200)); return el.innerText.replace(/\s+/g, ' '); }
    }
    return '(timeout)';
  });
  console.log('[A] ladder page 排行榜 box says:', ui);
  await A.close();
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
