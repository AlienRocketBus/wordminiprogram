/* XJ: small semantic probes of the emulator vs real MongoDB-backed CloudBase (BSON type bracketing). */
import { createEmulator, ACL } from '/home/user/wordminiprogram/cloudbase_emulator.mjs';
const ENV = 'envtest-0000', HOST = `https://${ENV}.ap-shanghai.tcb-api.tencentcloudapi.com`;
const emu = createEmulator({ env: ENV, collections: { c: ACL.READONLY } });
async function call(path, body) { const p = await emu.process({ method: 'POST', url: HOST + path, headers: { origin: 'x' }, body: JSON.stringify(body) }); return JSON.parse(p.respond.body); }
const v = await call('/auth/v1/verification', { phone_number: '+86 13900000001' });
const a = await call('/auth/v1/signup', { phone_number: '+86 13900000001', verification_code: '123456', verification_id: v.verification_id });
const db = (action, extra) => call(`/web?env=${ENV}`, Object.assign({ action: 'database.' + action, env: ENV, access_token: a.access_token }, extra));
await db('addDocument', { collectionName: 'c', data: { _id: 'd1', createdAt: { $date: { offset: 0 } } } });   // serverDate() → Date-typed field
const now = Date.now() + 1000;
const qNum = await db('queryDocument', { collectionName: 'c', query: { createdAt: { $lt: now } } });
const qDate = await db('queryDocument', { collectionName: 'c', query: { createdAt: { $lt: { $date: now } } } });
console.log(JSON.stringify({
  'Date-typed field vs NUMBER in $lt (real MongoDB: no match — different BSON types)': qNum.data.list.length,
  'Date-typed field vs Date in $lt (real: match)': qDate.data.list.length,
}));
