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
  /* 🔴v1154：**假 localStorage 必须有 length / key()。**
     真的 localStorage 是有的，而模块里靠它们遍历键 ——
     mock 缺了这两个，模块看到的就是"一个键都没有"。
     v1154 加的红线"本机没学过的词就不上传"因此被误触发，
     这个测试当场变红。
     **mock 缺一个接口，测的就不是真实行为。** */
  get length(){ return store.size; },
  key(i){ return Array.from(store.keys())[i] ?? null; },
};
globalThis.window = globalThis;
globalThis.document = { readyState:'complete', addEventListener(){}, getElementById(){ return null; }, body:{} };
globalThis.setInterval = () => 1;
globalThis.confirm = () => true;
globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = s => Buffer.from(s, 'base64').toString('binary');
// Node 22 自带 globalThis.crypto(webcrypto) ✓

let restoredWith = null, exportCounter = 0, exportBody = 'BACKUP-CODE-v965-A';
globalThis.HansenBackup = {
  build: () => ({ appVersion: 965 }),
  exportCode: () => { exportCounter++; return exportBody; },
  parse: (code) => ({ appVersion: 965, __code: code }),
  restore: (parsed) => { restoredWith = parsed; return { ok: true }; },
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
  /* 🔴v1154：**先造一份本机进度再测上传。**
     v1154 给 syncNow 补了红线"本机没有学过的词就拒绝上传"
     （v1029 立过这条，但只写在登录对账里，
       而 v1134 的自动同步、v1145 的退出前上传都绕过了它，
       结果空白本机会把云端好档覆盖掉 —— 用户报的"进度乱七八糟"）。

     这个测试原来直接调 syncNow 而不造任何本机数据 ——
     **正好被新红线挡住**。补上数据后测的才是真实场景：
     有进度的设备把进度传上去。 */
  localStorage.setItem('wordIslandAnimal',
    JSON.stringify({ learned: [0, 1, 2], stats: {} }));
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
