/* 会话真的死了（refresh_token 被服务端作废，SDK 删凭证）之后，一次普通的 ensureSession 会怎样：
   本机登录记录、天梯战绩、资料名还在不在；重新登录后能不能找回 */
import { H } from './meas_lib.mjs';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 30, consistencyLagMs: 0 } });
const PK_READY = () => !!(window.HansenAuth && window.HansenPkRoom && window.HansenSbProfile && window.HansenPkRecord && window.HansenCloudSave);
const p = await H.openPhone(browser, emu, srv.origin, { name: 'kid', ready: PK_READY });
const NUM = '13512345678';
const r = await H.loginPhone(p, NUM);
console.log('① 登录', r.ok, r.uid);
const setup = await p.eval(async () => {
  window.HansenSbProfile.setName('小明');
  for (let i = 0; i < 40 && !(window.HansenSbProfile.readProfile() || {}).cid; i++) await new Promise((z) => setTimeout(z, 250));
  localStorage.setItem('hansen_pk_record_v1', JSON.stringify({ rating: 1080, peakRating: 1080, placementGames: 3, wins: 3, losses: 1, history: [] }));
  /* 本机得有点进度，云存档才肯上传（本机空的拒绝上传） */
  localStorage.setItem('hansen_wallet_coins', '345');
  const up = await window.HansenCloudSave.syncNow({ force: true });
  return { up, prof: window.HansenSbProfile.readProfile(), rec: window.HansenPkRecord.summary() };
});
console.log('② 打过定级赛、上传云存档：', JSON.stringify(setup.up), 'cid=', setup.prof.cid, 'rating=', setup.rec.rating);
console.log('   等 62 秒（过了「刚登录 60 秒」保护期）…');
await H.sleep(62000);
/* 会话死掉：服务端作废这个人的 refresh_token；本机 access_token 到期 → SDK 去刷新 → invalid_grant → SDK 删凭证 */
emu.revokeSessions(p.cloudUid);
await p.eval(() => {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (/^credentials/.test(k)) { const o = JSON.parse(localStorage.getItem(k)); o.expires_at = Date.now() - 5000; localStorage.setItem(k, JSON.stringify(o)); }
  }
});
const after = await p.eval(async () => {
  const s = await window.HansenAuth.ensureSession();
  await new Promise((z) => setTimeout(z, 1500));
  return { s: { ok: s.ok, kind: s.kind, reason: s.reason }, signed: window.HansenAuth.isSignedIn(), local: window.HansenAuth.readLocal(),
           rec: localStorage.getItem('hansen_pk_record_v1'), owner: localStorage.getItem('hansen_pk_record_owner_v1156'),
           prof: window.HansenSbProfile.readProfile(), creds: Object.keys(localStorage).filter((k) => /^credentials/.test(k)).length,
           trace: String(window.HansenAuth._trace()).split('\n').slice(-8).join('\n') };
});
console.log('③ 会话死后一次 ensureSession：', JSON.stringify(after.s));
console.log('   本机还算登录着：', after.signed, ' 本机登录记录 uid=', after.local.uid, ' 凭证键：', after.creds);
console.log('   天梯战绩 hansen_pk_record_v1 =', after.rec, ' 归属 =', JSON.stringify(after.owner));
console.log('   资料：name=', after.prof.name, 'cid=', after.prof.cid);
console.log('   轨迹（最后几行）：\n' + after.trace.split('\n').map((l) => '     ' + l).join('\n'));
/* 重新登录：同一个手机号 */
const r2 = await H.loginPhone(p, NUM);
console.log('④ 重新登录', r2.ok, r2.uid);
await H.sleep(6000);
try { await p.page.waitForFunction(PK_READY, null, { timeout: 30000 }); } catch (e) {}
const back = await p.eval(() => ({ rec: localStorage.getItem('hansen_pk_record_v1'), sum: window.HansenPkRecord && window.HansenPkRecord.summary(), prof: window.HansenSbProfile.readProfile(), coins: localStorage.getItem('hansen_wallet_coins') }));
console.log('⑤ 重新登录后：天梯战绩 =', back.rec, ' rating=', back.sum && back.sum.rating, ' 资料 name=', back.prof && back.prof.name, 'cid=', back.prof && back.prof.cid, ' coins=', back.coins);
console.log('页面报错：', p.errors.slice(0, 3).join(' | ') || '无');
await p.close(); srv.close(); await browser.close();
