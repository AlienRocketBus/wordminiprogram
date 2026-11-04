#!/usr/bin/env node
/* test_cloudbase_emulator_v1164.mjs —— 模拟云端自己守不守规矩（不开浏览器，几秒跑完）
 *
 * 为什么要有它：以前的假传输层什么都让写，于是「客人改房主的房间」在测试里永远成功、
 *   真机上永远失败。端到端测试现在全靠 cloudbase_emulator.mjs —— 它要是哪天也变宽松了，
 *   那些测试就又会假绿。所以这里直接对着它发请求（和 SDK 发的形状一样），把规矩一条条钉住：
 *   ① 重复 _id 的 add 被拒（三种回法都对）  ② 「读取全部、修改本人」：别人的文档改不动、删不掉，
 *   legacy 静默 updated:0 / rules 报 PERMISSION_DENIED，而且都记进 foreign
 *   ③ ADMINONLY 什么都不让做、没建的集合报 NOT_EXIST  ④ 读有主从延迟、写永远落在最新状态上
 *   ⑤ refresh_token 只能用一次；吊销后换不到新令牌  ⑥ serverDate 由服务端填时间
 *   ⑦ 故障注入（断开/500/扣住）真的生效
 */
import assert from 'node:assert/strict';
import { createEmulator, ACL } from './cloudbase_emulator.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('模拟云端守规矩（v1164）\n');

const ENV = 'envtest-0000';
const HOST = `https://${ENV}.ap-shanghai.tcb-api.tencentcloudapi.com`;
function mk(knobs, collections) {
  return createEmulator({ env: ENV, collections: collections || { rooms: ACL.READONLY, locked: ACL.ADMINONLY }, knobs: Object.assign({ verificationCode: '123456' }, knobs || {}) });
}
async function call(emu, path, body, headers = {}) {
  const plan = await emu.process({ method: path.startsWith('GET ') ? 'GET' : 'POST', url: HOST + path.replace(/^GET /, ''), headers: Object.assign({ origin: 'http://127.0.0.1' }, headers), body: body ? JSON.stringify(body) : null });
  if (plan.abort) return { abort: plan.abort };
  let j = null; try { j = JSON.parse(plan.respond.body); } catch (e) { j = null; }
  return { status: plan.respond.status, json: j };
}
async function signup(emu, phone) {
  const v = await call(emu, '/auth/v1/verification', { phone_number: phone });
  const t = await call(emu, '/auth/v1/signup', { phone_number: phone, verification_code: '123456', verification_id: v.json.verification_id });
  return t.json;
}
const db = (emu, tok, action, extra) => call(emu, `/web?env=${ENV}`, Object.assign({ action: 'database.' + action, env: ENV, access_token: tok.access_token, dataVersion: '2020-01-10' }, extra));

for (const mode of ['legacy', 'rules']) {
  console.log(`── 权限回法：${mode} ──`);
  const emu = mk({ permissionMode: mode });
  const a = await signup(emu, '+86 13900000001'), b = await signup(emu, '+86 13900000002');
  ok(a && a.access_token && a.expires_in && a.refresh_token && b.sub !== a.sub, '手机号验证码注册：拿到带 expires_in 的令牌，两人 uid 不同');

  const add1 = await db(emu, a, 'addDocument', { collectionName: 'rooms', data: { _id: 'r1', status: 'open' } });
  ok(add1.json && add1.json.data && add1.json.data._id === 'r1', '甲 add 固定 _id 成功');
  const add2 = await db(emu, b, 'addDocument', { collectionName: 'rooms', data: { _id: 'r1', status: 'mine' } });
  ok(add2.status === 200 && add2.json.code === 'DATABASE_REQUEST_FAILED' && /E11000/.test(add2.json.message), `乙 add 同一个 _id 被拒（${add2.json && add2.json.code}）`);
  ok(emu.dump('rooms').length === 1 && emu.dump('rooms')[0]._openid === a.sub && emu.dump('rooms')[0].status === 'open', '库里还是甲那一条，创建者章是甲');

  const up = await db(emu, b, 'updateDocument', { collectionName: 'rooms', query: { _id: 'r1' }, queryType: 'DOC', multi: false, merge: true, data: { $set: { status: 'hacked' } } });
  if (mode === 'legacy') ok(up.json && up.json.data && up.json.data.updated === 0, '乙改甲的文档：legacy 静默 updated:0');
  else ok(up.json && up.json.code === 'DATABASE_PERMISSION_DENIED', '乙改甲的文档：rules 回 DATABASE_PERMISSION_DENIED');
  const rm = await db(emu, b, 'deleteDocument', { collectionName: 'rooms', query: { _id: 'r1' }, queryType: 'DOC', multi: false });
  ok(mode === 'legacy' ? (rm.json.data && rm.json.data.deleted === 0) : rm.json.code === 'DATABASE_PERMISSION_DENIED', '乙删甲的文档也不行');
  ok(emu.dump('rooms')[0].status === 'open' && emu.foreign.length === 2, `文档没被动，两次越权都记下了（foreign=${emu.foreign.length}）`);
  const mine = await db(emu, a, 'updateDocument', { collectionName: 'rooms', query: { _id: 'r1' }, queryType: 'DOC', multi: false, merge: true, data: { $set: { status: 'playing' } } });
  ok(mine.json.data && mine.json.data.updated === 1 && emu.dump('rooms')[0].status === 'playing', '甲改自己的文档成功');
  const multi = await db(emu, a, 'updateDocument', { collectionName: 'rooms', query: { status: 'playing' }, queryType: 'WHERE', multi: true, merge: true, data: { $set: { x: 1 } } });
  if (mode === 'rules') ok(multi.json.code === 'DATABASE_PERMISSION_DENIED', 'rules：where().update 条件没锁定 _openid → 拒');
  else ok(multi.json.data && multi.json.data.updated === 1, 'legacy：where().update 只动自己的');
  const rd = await db(emu, b, 'queryDocument', { collectionName: 'rooms', query: { _id: 'r1' }, queryType: 'DOC', multi: false });
  ok(rd.json.data && rd.json.data.list.length === 1, '「读取全部」：乙读得到甲的文档');
}

console.log('── 重复 _id 的另外两种回法 ──');
{
  const emu = mk({ duplicateStyle: 'duplicate_write' });
  const a = await signup(emu, '+86 13900000011');
  await db(emu, a, 'addDocument', { collectionName: 'rooms', data: { _id: 'd1' } });
  const r = await db(emu, a, 'addDocument', { collectionName: 'rooms', data: { _id: 'd1' } });
  ok(r.json && r.json.code === 'DATABASE_DUPLICATE_WRITE', 'duplicate_write → DATABASE_DUPLICATE_WRITE');
  emu.knobs.duplicateStyle = 'http500';
  const r2 = await db(emu, a, 'addDocument', { collectionName: 'rooms', data: { _id: 'd1' } });
  ok(r2.status === 500, 'http500 → HTTP 500（SDK 会当成 network request error）');
  ok(emu.dump('rooms').length === 1, '三种回法下都只有一条');
}

console.log('── 没权限 / 没建集合 ──');
{
  const emu = mk({}, { rooms: ACL.READONLY, locked: ACL.ADMINONLY });
  const a = await signup(emu, '+86 13900000021');
  const q = await db(emu, a, 'queryDocument', { collectionName: 'locked', query: {}, queryType: 'WHERE' });
  const w = await db(emu, a, 'addDocument', { collectionName: 'locked', data: { _id: 'x' } });
  ok(q.json.code === 'DATABASE_PERMISSION_DENIED' && w.json.code === 'DATABASE_PERMISSION_DENIED', 'ADMINONLY：读写都 DATABASE_PERMISSION_DENIED（HTTP 200 + code）');
  const m = await db(emu, a, 'queryDocument', { collectionName: 'nope', query: {}, queryType: 'WHERE' });
  ok(m.status === 200 && m.json.code === 'DATABASE_COLLECTION_NOT_EXIST' && /nope/.test(m.json.message), '没建的集合：DATABASE_COLLECTION_NOT_EXIST，消息里带集合名');
  const bad = await db(emu, { access_token: 'forged' }, 'queryDocument', { collectionName: 'rooms', query: {} });
  ok(bad.json.code === 'INVALID_ACCESS_TOKEN', '伪造令牌：INVALID_ACCESS_TOKEN');
  const pub = mk({}, { open: ACL.PUBLIC_TEST_ONLY });
  const p1 = await signup(pub, '+86 13900000022'), p2 = await signup(pub, '+86 13900000023');
  await db(pub, p1, 'addDocument', { collectionName: 'open', data: { _id: 'o1', v: 1 } });
  const pu = await db(pub, p2, 'updateDocument', { collectionName: 'open', query: { _id: 'o1' }, queryType: 'DOC', multi: false, merge: true, data: { $set: { v: 2 } } });
  ok(pu.json.data.updated === 1, 'PUBLIC_TEST_ONLY（反例，真云端没有）：谁都能改谁的');
}

console.log('── 主从延迟 ──');
{
  const emu = mk({ consistencyLagMs: 400 });
  const a = await signup(emu, '+86 13900000031');
  await db(emu, a, 'addDocument', { collectionName: 'rooms', data: { _id: 'l1', n: 1 } });
  const r0 = await db(emu, a, 'queryDocument', { collectionName: 'rooms', query: { _id: 'l1' }, queryType: 'DOC' });
  const c0 = await db(emu, a, 'countDocument', { collectionName: 'rooms', query: {} });
  ok(r0.json.data.list.length === 0 && c0.json.data.total === 0, '刚写进去马上读：读不到、数不到（最终一致）');
  const dup = await db(emu, a, 'addDocument', { collectionName: 'rooms', data: { _id: 'l1' } });
  ok(dup.json.code === 'DATABASE_REQUEST_FAILED', '但写永远看最新状态：同 _id 再 add 立刻被拒');
  await new Promise((r) => setTimeout(r, 450));
  const r1 = await db(emu, a, 'queryDocument', { collectionName: 'rooms', query: { _id: 'l1' }, queryType: 'DOC' });
  ok(r1.json.data.list.length === 1, '过了延迟就读到了');
}

console.log('── 令牌 ──');
{
  const emu = mk({});
  const a = await signup(emu, '+86 13900000041');
  const r1 = await call(emu, '/auth/v1/token', { client_id: ENV, grant_type: 'refresh_token', refresh_token: a.refresh_token });
  ok(r1.json && r1.json.access_token && r1.json.refresh_token !== a.refresh_token, '用 refresh_token 换到新令牌（也换了新的 refresh_token）');
  const r2 = await call(emu, '/auth/v1/token', { client_id: ENV, grant_type: 'refresh_token', refresh_token: a.refresh_token });
  ok(r2.json && r2.json.error === 'invalid_grant', '旧 refresh_token 再用 → invalid_grant（只能用一次）');
  const me = await call(emu, 'GET /auth/v1/user/me', null, { authorization: 'Bearer ' + r1.json.access_token });
  ok(me.json && me.json.sub === a.sub && me.json.phone_number === '+86 13900000041', '/user/me 拿得到 sub（SDK 靠它补 uid）');
  emu.revokeSessions(a.sub);
  const r3 = await call(emu, '/auth/v1/token', { client_id: ENV, grant_type: 'refresh_token', refresh_token: r1.json.refresh_token });
  const q = await db(emu, r1.json, 'queryDocument', { collectionName: 'rooms', query: {} });
  ok(r3.json.error === 'invalid_grant' && q.json.code === 'ACCESS_TOKEN_EXPIRED', '吊销后：刷新换不到、旧 access_token 也用不了');
  emu.knobs.omitExpiresIn = true;
  const pw = emu.seedUser({ username: 'u_pw', password: 'pw123456' });
  const s = await call(emu, '/auth/v1/signin', { username: 'u_pw', password: 'pw123456' });
  ok(s.json && s.json.access_token && s.json.expires_in === undefined && pw.uid, 'omitExpiresIn：登录响应缺 expires_in（SDK 会删凭证）');
  const wrong = await call(emu, '/auth/v1/signin', { username: 'u_pw', password: 'nope' });
  ok(wrong.json.error === 'invalid_password', '密码错：invalid_password');
}

console.log('── serverDate / 故障注入 ──');
{
  const emu = mk({});
  const a = await signup(emu, '+86 13900000051');
  const t0 = Date.now();
  await db(emu, a, 'addDocument', { collectionName: 'rooms', data: { _id: 's1', createdAt: { $date: { offset: 0 } } } });
  const d = emu.dump('rooms')[0];
  ok(d.createdAt && typeof d.createdAt.$date === 'number' && Math.abs(d.createdAt.$date - t0) < 2000, 'serverDate() 由服务端填成真时间');
  const f = emu.fault({ uid: a.sub, db: true, do: 'abort', times: 1 });
  const ab = await db(emu, a, 'queryDocument', { collectionName: 'rooms', query: {} });
  const after = await db(emu, a, 'queryDocument', { collectionName: 'rooms', query: {} });
  ok(ab.abort && after.json && f.hits === 1, '断开故障只生效指定次数');
  emu.fault({ db: true, do: 'http500', times: 1 });
  const e5 = await db(emu, a, 'queryDocument', { collectionName: 'rooms', query: {} });
  ok(e5.status === 500, 'HTTP 500 故障');
  const h = emu.hold({ uid: a.sub, db: true });
  let done = false;
  const p = db(emu, a, 'addDocument', { collectionName: 'rooms', data: { _id: 'held' } }).then((r) => { done = true; return r; });
  await new Promise((r) => setTimeout(r, 150));
  ok(!done && h.pending === 1 && !emu.dump('rooms').some((x) => x._id === 'held'), '扣住：请求停在半路，还没落库');
  h.release();
  const pr = await p;
  ok(pr.json && pr.json.data && emu.dump('rooms').some((x) => x._id === 'held'), '放开后照常处理、落库');
  emu.setOffline(true);
  const off = await call(emu, '/auth/v1/verification', { phone_number: '+86 13900000052' });
  emu.setOffline(false);
  ok(off.abort, '断网：登录和数据库请求都被掐断');
}

console.log(`\n${pass} 通过，${fail} 失败`);
assert.equal(fail, 0, `${fail} 条没过`);
