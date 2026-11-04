/* E8: 结算后上传天梯分失败，代码注释说「下次打开天梯页会补传」——
 *     但只要这个页面里之前成功传过一次（_needPush=false），失败后就再也不补，榜上一直是旧分。
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const READY = () => !!(window.HansenAuth && window.HansenLadderBoard && window.HansenLadderUI && window.HansenSbProfile && window.HansenPkRecord);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const j = (x) => JSON.stringify(x);
try {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 20 } });
  emu.seedUser({ username: 'alice', password: 'pw123456' });
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A', ready: READY });
  await A.eval(() => window.HansenSbProfile.setName('小爱'));
  await H.loginPassword(A, 'alice', 'pw123456');
  const G = () => ({ mode: 'A', result: 'win', oppName: '对手', myScore: 300, oppScore: 100, words: 5, correct: 4, totalMs: 7000, firstWins: 3, fastestMs: 800, oppRating: 1000 });
  await A.eval((g) => { for (let i = 0; i < 3; i++) window.HansenPkRecord.record(g); }, G());
  /* 打开天梯页：第一次拉榜会顺手补传一次（成功） */
  const t1 = await A.eval(async () => { window.HansenLadderBoard._clearCacheForTest(); return window.HansenLadderBoard.fetchTop(); });
  const dbR = () => ((emu.dump('sb_profile') || [])[0] || {}).ladderRating;
  console.log('1) first board open: list', j((t1.list || []).map((x) => x.rating)), ' DB rating', dbR());
  /* 又打赢一局；结算时上传那一下网络掐断 */
  const f = emu.fault({ action: 'database.updateDocument', collection: 'sb_profile', do: 'abort', times: 1 });
  const p2 = await A.eval(async (g) => { window.HansenPkRecord.record(g); return { push: await window.HansenLadderBoard.push(), local: window.HansenPkRecord.summary().rating }; }, G());
  f.remove();
  console.log('2) after the next game: push', j({ ok: p2.push.ok, kind: p2.push.kind }), ' local rating', p2.local, ' DB rating', dbR());
  /* 过一会儿再开天梯页（缓存过期） */
  const before = emu.log.filter((e) => e.action === 'database.updateDocument' && e.collection === 'sb_profile').length;
  const t3 = await A.eval(async () => { window.HansenLadderBoard._clearCacheForTest(); return window.HansenLadderBoard.fetchTop(); });
  const after = emu.log.filter((e) => e.action === 'database.updateDocument' && e.collection === 'sb_profile').length;
  console.log('3) next board open: re-push attempts =', after - before, ' board shows', j((t3.list || []).map((x) => x.name + ':' + x.rating)), ' local rating', p2.local, ' DB rating', dbR());
  await A.close();
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
