// 🔴v965 匿名云存档回归：密钥/加密零知识/同步节律/回档/自检 全链路（Node+mock provider）
import assert from 'node:assert/strict';
import fs from 'node:fs';

let fails = 0;
const ok = (c, n) => { console.log(c ? '  ✅ ' + n : '  ❌ ' + n); if(!c) fails++; };

/* ── 环境 mock ── */
const store = new Map();
globalThis.localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
globalThis.window = globalThis;
globalThis.document = { readyState:'complete', addEventListener(){}, getElementById(){ return null; }, body:{} };
globalThis.setInterval = () => 1;
globalThis.confirm = () => true;
globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = s => Buffer.from(s, 'base64').toString('binary');
// Node 22 自带 globalThis.crypto(webcrypto) ✓

let restoredWith = null, restoreCounter = 0, exportCounter = 0, exportBody = 'BACKUP-CODE-v965-A';
globalThis.HansenBackup = {
  build: () => ({ appVersion: 965 }),
  exportCode: () => { exportCounter++; return exportBody; },
  parse: (code) => ({ appVersion: 965, __code: code }),
  restore: (parsed) => { restoreCounter++; restoredWith = parsed; return { ok: true }; },
};
const cloud = new Map();
globalThis.__HSN_CLOUD_MOCK_PROVIDER = {
  name: 'mock',
  put: async (id, data) => { cloud.set(id, JSON.parse(JSON.stringify(data))); return { ok: 1 }; },
  get: async (id) => cloud.has(id) ? JSON.parse(JSON.stringify(cloud.get(id))) : null,
};
globalThis.HANSEN_CLOUD_CONFIG = { envId: '', region: '' };

eval(fs.readFileSync(new URL('./hansen_cloud_save_v965.js', import.meta.url), 'utf8'));
const M = globalThis.HansenCloudSave, D = M._debug;
ok(!!M, '模块加载');

/* T1 密钥体系 */
console.log('T1 密钥');
const k = M.ensureKey();
ok(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{16}$/.test(k), '16位 Crockford 字符集(无ILOU)');
ok(M.ensureKey() === k, '幂等：不重复生成');
ok(D.prettyKey(k) === k.slice(0,4)+'-'+k.slice(4,8)+'-'+k.slice(8,12)+'-'+k.slice(12,16), '四段展示');
ok(D.normalizeKey(' abcd-efgh-jklm-npqr '.replace('a','o')) === 'ABCD'.replace('A','0')+'EFGHJKLMNPQR'.replace('I','1').replace('L','1') ? true : D.normalizeKey('obcd-efgh-jklm-npqr') === '0BCDEFGHJK1MNPQR', '归一化：小写/横线/O→0/L→1');
ok(D.normalizeKey('short') === null && D.normalizeKey(k + 'X') === null, '非法长度拒绝');

/* T2 零知识加密 */
console.log('T2 加密');
{
  const env = await D.sealPayload(k, 'secret-plain');
  ok(env.v === 1 && env.iv && env.ct && !JSON.stringify(env).includes('secret-plain'), '信封只含密文');
  ok(await D.openPayload(k, env) === 'secret-plain', '正确密钥解开');
  let bad = false;
  try{ await D.openPayload(D.genKey(), env); }catch(e){ bad = /密钥不对|损坏/.test(String(e.message)); }
  ok(bad, '错误密钥解不开且报友好错误');
  const id1 = await D.docIdOf(k), id2 = await D.docIdOf(D.genKey());
  ok(/^[0-9a-f]{64}$/.test(id1) && id1 !== id2, '文档ID=SHA256十六进制且互异');
}

/* T3 同步：上云/去重/冷却 */
console.log('T3 同步');
{
  const r1 = await M.syncNow({ force: true });
  ok(r1.ok === true, '首次上云成功');
  const id = await D.docIdOf(k);
  const row = cloud.get(id);
  ok(!!row && row.payload && row.payload.ct && !JSON.stringify(row).includes(exportBody), '云端仅存密文(零知识)');
  /* 🔴v1060 更正过期契约：v1039 特意规定 **force 一律真写**。
     原因是原逻辑"内容指纹未变就跳过，连 force 也跳"——
     地址算法或账号变更后，用户点「立刻上传」看到成功、实际一字未写。
     所以这里 force 第二次必须**不跳过**；而"内容未变才跳过"只适用于非 force。 */
  const r2 = await M.syncNow({ force: true });
  ok(r2.ok === true && r2.skipped !== true, 'force 必须真写，绝不因指纹未变而跳过(v1039)');
  /* v1039 的原话是「force 只绕过冷却，不制造重复流量」。
     紧跟一次 force 之后的非 force 同步应当被**冷却**挡下 —— 这才是防刷流量的那道闸。 */
  const rSkip = await M.syncNow({});
  ok(rSkip.ok === false && rSkip.reason === 'cooldown', '非 force 同步受冷却保护，不制造重复流量');
  exportBody = 'BACKUP-CODE-v965-B';
  const r3 = await M.syncNow({});
  ok(r3.ok === false && r3.reason === 'cooldown', '45s 冷却生效(非强制)');
  const r4 = await M.syncNow({ force: true });
  ok(r4.ok === true && !r4.skipped, '内容变化+强制→重新上云');
}

/* T3b 自动同步许可 + UID/generation 竞态 */
console.log('T3b 身份切换与迟到写保护');
{
  let currentUid = 'U-ACCOUNT-1';
  let sessionState = 'signed_in', requiresCleanup = false;
  const auth = {
    isSignedIn: () => !!currentUid,
    readLocal: () => currentUid ? ({ uid: currentUid, phone: '+86 15550836896' }) : ({}),
    currentUser: () => currentUid ? ({ uid: currentUid }) : null,
    ensureSession: async expectedUid => ({
      ok: !!currentUid && expectedUid === currentUid,
      uid: currentUid
    }),
    sessionStatus: () => ({ state: sessionState }),
    operationStatus: () => ({ requiresCleanup })
  };
  globalThis.HansenAuth = auth;
  M.resetApp();

  const blocked = await M.syncNow({});
  ok(blocked.ok === false && blocked.reason === 'not-enabled-for-current-identity',
     '旧恢复码自动同步许可不能继承给正式账号');
  const explicit = await M.syncNow({ force: true });
  ok(explicit.ok === true && /^account:u:U-ACCOUNT-1$/.test(D.readState().enabledIdentity || ''),
     '同一账号 UID 复验成功后允许明确上传');

  currentUid = 'U-ACCOUNT-2';
  M.resetApp();
  const switched = await M.syncNow({});
  ok(switched.ok === false && switched.reason === 'not-enabled-for-current-identity',
     '切换账号后旧 UID 许可立即失效，后台钩子零写入');

  restoredWith = null;
  const sameAccountRestore = await M.restoreWithKey(k, { expectedUid: 'U-ACCOUNT-2' });
  ok(sameAccountRestore.ok === true && restoredWith,
     '同账号 UID+generation 一致时允许真实恢复');

  restoredWith = null;
  let wrongAccountRestore = '';
  try{ await M.restoreWithKey(k, { expectedUid: 'U-ACCOUNT-1' }); }
  catch(e){ wrongAccountRestore = String(e && e.message || e); }
  ok(/账号|会话/.test(wrongAccountRestore) && restoredWith === null,
     '当前已是 U2 时，U1 恢复在读取/覆盖前失败关闭');

  const providerMock = globalThis.__HSN_CLOUD_MOCK_PROVIDER;
  const originalPut = providerMock.put;
  const originalGet = providerMock.get;
  let putCalls = 0, getCalls = 0;
  const countedPut = async (id, data) => {
    putCalls++;
    return originalPut(id, data);
  };
  providerMock.put = countedPut;
  providerMock.get = async id => {
    getCalls++;
    return originalGet(id);
  };
  function deferred(){ let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

  /* 认证模块存在时，匿名路径只能在“明确 signed_out 且无 cleanup”边界运行。
     unknown / mismatch / cleanup 任一状态都必须失败关闭：不 put、不 get、
     不调用 HansenBackup.restore，也不能悄悄改本地同步账本。 */
  const anonymousFenceCases = [
    { name:'unknown', state:'unknown', cleanup:false },
    { name:'mismatch', state:'mismatch', cleanup:false },
    { name:'cleanup', state:'signed_out', cleanup:true }
  ];
  for (const c of anonymousFenceCases) {
    currentUid = '';
    sessionState = c.state;
    requiresCleanup = c.cleanup;
    M.resetApp();
    restoredWith = null;
    const puts0 = putCalls, gets0 = getCalls, restores0 = restoreCounter;
    const local0 = JSON.stringify(D.readState());

    const fencedSync = await M.syncNow({ force:true });
    const fencedSelf = await M.selfTest();
    const fencedRound = await M.roundTrip();
    let fencedFetchError = '', fencedRestoreError = '';
    try{ await M.fetchWithKey(k); }catch(e){ fencedFetchError = String(e && e.message || e); }
    try{ await M.restoreWithKey(k); }catch(e){ fencedRestoreError = String(e && e.message || e); }

    ok(fencedSync.ok === false && fencedSync.reason === 'stale-account'
         && fencedSelf.ok === false && fencedRound.step === 'write-failed'
         && /账号|会话|认证/.test(fencedFetchError)
         && /账号|会话|认证/.test(fencedRestoreError),
       '匿名边界 '+c.name+'：同步/自检/往返/读取/恢复全部失败关闭');
    ok(putCalls === puts0 && getCalls === gets0 && restoreCounter === restores0
         && restoredWith === null && JSON.stringify(D.readState()) === local0,
       '匿名边界 '+c.name+'：云端零读写、本地零恢复且同步账本零改写');
  }
  currentUid = 'U-ACCOUNT-1';
  sessionState = 'signed_in';
  requiresCleanup = false;
  M.resetApp();

  /* U1 上传在加密/算地址期间迟到；切 U2 + reset generation 后不得调用 put。 */
  currentUid = 'U-ACCOUNT-1';
  M.resetApp();
  const putsBeforeLateUpload = putCalls;
  const lateUploadPromise = M.syncNow({ force: true });
  currentUid = 'U-ACCOUNT-2';
  M.resetApp();
  const lateUpload = await lateUploadPromise;
  ok(lateUpload.ok === false && lateUpload.reason === 'stale-account'
       && putCalls === putsBeforeLateUpload,
     'U1→U2：迟到上传在 put 前失败关闭且零写');

  /* U1 的 put 已经发出才切到 U2：网络请求无法撤回，但迟到完成绝不能
     把 U1 的 lastUpAt/lastHash/lastDocId/enabledIdentity 写进当前本地账本。 */
  currentUid = 'U-ACCOUNT-1';
  M.resetApp();
  exportBody = 'BACKUP-CODE-v1076-PUT-ISSUED';
  const issuedGate = deferred();
  let issuedPutStarted;
  const issuedPutSeen = new Promise(r => { issuedPutStarted = r; });
  providerMock.put = (id, data) => {
    putCalls++;
    issuedPutStarted();
    return issuedGate.promise.then(() => originalPut(id, data));
  };
  const issuedU1Promise = M.syncNow({ force:true });
  await issuedPutSeen;
  currentUid = 'U-ACCOUNT-2';
  M.resetApp();
  const localAfterSwitch = JSON.stringify(D.readState());
  issuedGate.resolve();
  const issuedU1 = await issuedU1Promise;
  ok(issuedU1.ok === false && issuedU1.reason === 'stale-account'
       && JSON.stringify(D.readState()) === localAfterSwitch,
     'U1 put 已发后切 U2：U1 迟到完成不写本地同步状态');
  providerMock.put = countedPut;

  /* 代际忙锁：U1 put 永久悬挂不能卡死 U2；U1 随后迟到 settle 也不能释放
     正在进行的 U2 token，因此第三个 U2 同步在 U2 settle 前必须返回 busy。 */
  currentUid = 'U-ACCOUNT-1';
  M.resetApp();
  const u1BusyKey = D.normalizeKey(M.ensureKey()) || M.ensureKey();
  const u1BusyId = await D.docIdOf(u1BusyKey);
  currentUid = 'U-ACCOUNT-2';
  M.resetApp();
  const u2BusyKey = D.normalizeKey(M.ensureKey()) || M.ensureKey();
  const u2BusyId = await D.docIdOf(u2BusyKey);
  currentUid = 'U-ACCOUNT-1';
  M.resetApp();

  const u1BusyGate = deferred(), u2BusyGate = deferred();
  let u1BusyStarted, u2BusyStarted;
  const u1BusySeen = new Promise(r => { u1BusyStarted = r; });
  const u2BusySeen = new Promise(r => { u2BusyStarted = r; });
  providerMock.put = (id, data) => {
    putCalls++;
    if(id === u1BusyId) {
      u1BusyStarted();
      return u1BusyGate.promise.then(() => originalPut(id, data));
    }
    if(id === u2BusyId) {
      u2BusyStarted();
      return u2BusyGate.promise.then(() => originalPut(id, data));
    }
    return originalPut(id, data);
  };

  exportBody = 'BACKUP-CODE-v1076-U1-HANG';
  const u1BusyPromise = M.syncNow({ force:true });
  await u1BusySeen;
  currentUid = 'U-ACCOUNT-2';
  M.resetApp();
  exportBody = 'BACKUP-CODE-v1076-U2-INFLIGHT';
  const u2BusyPromise = M.syncNow({ force:true });
  await u2BusySeen;
  const localWhileBothPending = JSON.stringify(D.readState());

  u1BusyGate.resolve();
  const u1BusyResult = await u1BusyPromise;
  const thirdU2 = await M.syncNow({ force:true });
  ok(u1BusyResult.ok === false && u1BusyResult.reason === 'stale-account'
       && thirdU2.ok === false && thirdU2.reason === 'busy'
       && JSON.stringify(D.readState()) === localWhileBothPending,
     'U1 悬挂不阻塞 U2；U1 迟到 settle 不能清除 U2 busy token');

  u2BusyGate.resolve();
  const u2BusyResult = await u2BusyPromise;
  ok(u2BusyResult.ok === true
       && D.readState().enabledIdentity === 'account:u:U-ACCOUNT-2',
     'U2 settle 后只提交 U2 本地同步状态并释放自身 busy token');
  providerMock.put = countedPut;

  /* 让读取真正悬挂到切号之后；二次 UID/generation 复验必须挡住 restore。 */
  const primaryId = await D.docIdOf(k);
  const primaryRow = cloud.get(primaryId);
  const restoreGate = deferred();
  let restoreReadStarted;
  const restoreReadSeen = new Promise(r => { restoreReadStarted = r; });
  providerMock.get = async id => {
    if (id === primaryId) {
      restoreReadStarted();
      return restoreGate.promise;
    }
    return originalGet(id);
  };
  currentUid = 'U-ACCOUNT-1';
  M.resetApp();
  restoredWith = null;
  const lateRestorePromise = M.restoreWithKey(k, { expectedUid: 'U-ACCOUNT-1' });
  await restoreReadSeen;
  currentUid = 'U-ACCOUNT-2';
  M.resetApp();
  restoreGate.resolve(JSON.parse(JSON.stringify(primaryRow)));
  let lateRestoreError = '';
  try{ await lateRestorePromise; }catch(e){ lateRestoreError = String(e && e.message || e); }
  ok(/账号|会话/.test(lateRestoreError) && restoredWith === null,
     'U1→U2：迟到读取不能执行 HansenBackup.restore');

  /* 命中旧地址后，迁移 put 必须 await 并再次复验；切号时 canonical 地址零写。 */
  providerMock.get = originalGet;
  const migrationKey = D.genKey();
  const migrationRaw = D.prettyKey(migrationKey);
  const migrationOldId = await D.docIdOf(migrationRaw);
  const migrationNewId = await D.docIdOf(migrationKey);
  const migrationEnvelope = await D.sealPayload(migrationRaw, 'LEGACY-MIGRATION-CODE');
  const migrationRow = { payload: migrationEnvelope, updatedAt: Date.now(), app:'wordadventure' };
  cloud.set(migrationOldId, JSON.parse(JSON.stringify(migrationRow)));
  cloud.delete(migrationNewId);
  const migrationGate = deferred();
  let migrationReadStarted;
  const migrationReadSeen = new Promise(r => { migrationReadStarted = r; });
  providerMock.get = async id => {
    if (id === migrationOldId) {
      migrationReadStarted();
      return migrationGate.promise;
    }
    return originalGet(id);
  };
  currentUid = 'U-ACCOUNT-1';
  M.resetApp();
  const putsBeforeMigration = putCalls;
  const migrationPromise = M.fetchWithKey(migrationRaw);
  await migrationReadSeen;
  currentUid = 'U-ACCOUNT-2';
  M.resetApp();
  migrationGate.resolve(JSON.parse(JSON.stringify(migrationRow)));
  let migrationError = '';
  try{ await migrationPromise; }catch(e){ migrationError = String(e && e.message || e); }
  ok(/账号|会话/.test(migrationError)
       && putCalls === putsBeforeMigration && !cloud.has(migrationNewId),
     'U1→U2：历史地址迁移不 fire-and-forget，迟到迁移 put 零写');

  providerMock.put = originalPut;
  providerMock.get = originalGet;
  delete globalThis.HansenAuth;
  M.resetApp();
}

/* T4 换机回档 */
console.log('T4 回档');
{
  // 模拟新手机：清空本地状态，仅凭密钥
  store.delete('hansen_cloud_state_v965');
  const got = await M.fetchWithKey(D.prettyKey(k).toLowerCase());
  ok(got.code === 'BACKUP-CODE-v965-B', '小写带横线密钥也能取回明文');
  const r = await M.restoreWithKey(k);
  ok(r.ok === true && restoredWith && restoredWith.__code === 'BACKUP-CODE-v965-B', '走 HansenBackup.parse+restore 官方链路');
  ok(D.readState().key === k, '恢复后本机采用该密钥');
  let miss = '';
  try{ await M.fetchWithKey(D.genKey()); }catch(e){ miss = String(e.message); }
  ok(/没有这把密钥/.test(miss), '不存在的密钥→明确提示');
}

/* T5 自检与未配置态 */
console.log('T5 自检/未配置');
{
  const st = await M.selfTest();
  ok(st.ok === true, '自检读写+加解密闭环');
  delete globalThis.__HSN_CLOUD_MOCK_PROVIDER;   // 摘掉测试缝且 envId 为空
  const rn = await M.syncNow({ force: true });
  ok(rn.ok === false && rn.reason === 'not-configured', 'envId 未配置→优雅待开通,不报错');
  const st2 = await M.selfTest();
  ok(st2.ok === false && /开通指南/.test(st2.msg), '自检给出开通指引');
}

console.log('');
if(fails){ console.log('❌ 失败', fails); process.exit(1); }
console.log('cloud save v965: key charset/normalize + zero-knowledge AES + dedup/cooldown sync + key-only restore via official backup chain + self-test + graceful unconfigured ✅');
