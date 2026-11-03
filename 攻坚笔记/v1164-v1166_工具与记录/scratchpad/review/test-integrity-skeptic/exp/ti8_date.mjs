import { createEmulator, ACL } from '/home/user/wordminiprogram/cloudbase_emulator.mjs';
const ENV='envtest-0000', HOST=`https://${ENV}.ap-shanghai.tcb-api.tencentcloudapi.com`;
const emu = createEmulator({ env: ENV, collections: { c: ACL.READONLY } });
async function call(path, body, headers={}) { const p = await emu.process({ method:'POST', url: HOST+path, headers:Object.assign({origin:'http://x'},headers), body: JSON.stringify(body) }); return JSON.parse(p.respond.body); }
const v = await call('/auth/v1/verification', { phone_number: '+86 13900000001' });
const t = await call('/auth/v1/signup', { phone_number: '+86 13900000001', verification_code: '123456', verification_id: v.verification_id });
const db = (action, extra) => call(`/web?env=${ENV}`, Object.assign({ action:'database.'+action, env:ENV, access_token:t.access_token, dataVersion:'2020-01-10' }, extra));
// SDK serialises a JS Date as {$date: ms}; serverDate() as {$date:{offset}}
await db('addDocument', { collectionName:'c', data:{ _id:'dateDoc', at:{ $date: 1000 } } });
await db('addDocument', { collectionName:'c', data:{ _id:'numDoc', at: 1000 } });
const numQ = await db('queryDocument', { collectionName:'c', queryType:'WHERE', query:{ at:{ $lt: 2000 } } });
const dateQ = await db('queryDocument', { collectionName:'c', queryType:'WHERE', query:{ at:{ $lt: { $date: 2000 } } } });
console.log('numeric $lt matches:', numQ.data.list.map(d=>d._id), ' (MongoDB would match only numDoc)');
console.log('Date $lt matches   :', dateQ.data.list.map(d=>d._id), ' (MongoDB would match only dateDoc)');
