import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
const REPO = '/home/claude/work/repo';
const MODE = process.env.MODE || 'perm';   // what the fake DB server returns
const log = [];
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('console', m => log.push('[console.' + m.type() + '] ' + m.text().slice(0, 300)));
page.on('pageerror', e => log.push('[pageerror] ' + e.message));
const TEST_HTML = `<!doctype html><meta charset=utf-8><body><script type=module>
window.__run = async function(){
  const out = {};
  const mod = await import('/vendor_cloudbase_esm_v965.js');
  const cb = mod.default || mod;
  const app = cb.init({ env: 'ambitious-d0g1d26xm740dc3d6', region: 'ap-shanghai' });
  const auth = app.auth({ persistence: 'local' });
  const step = async (name, fn) => {
    try { const v = await fn(); out[name] = { resolved: true, value: JSON.parse(JSON.stringify(v === undefined ? null : v)) }; }
    catch (e) { out[name] = { rejected: true, type: Object.prototype.toString.call(e), message: e && e.message, json: (()=>{try{return JSON.stringify(e)}catch(_){return null}})() }; }
  };
  const db0 = app.database();
  await step('beforeLogin_get', () => db0.collection('hansen_pk_rooms').doc('x').get());
  await step('signInAnonymously', () => auth.signInAnonymously());
  await step('getLoginState', async () => { const s = await auth.getLoginState(); return s ? Object.keys(s) : null; });
  await new Promise(r => setTimeout(r, 2500));
  const db = app.database();
  const C = db.collection('hansen_pk_rooms');
  await step('getLoginState_afterExpiry', async () => { const s = await auth.getLoginState(); return s ? 'state-present' : null; });
  await step('getLoginState_afterFail', async () => { const s = await auth.getLoginState(); return s ? 'state-present' : null; });
  await step('ls', async () => Object.keys(localStorage));
  await step('add', () => C.add({ _id: 'rA1', status: 'open', guestId: '', createdAt: 1 }));
  await step('where_update', () => C.where({ _id: 'rA1', status: 'open', guestId: '' }).update({ status: 'playing', guestId: 'B' }));
  await step('doc_update', () => C.doc('rA1').update({ heartbeatAt: 2 }));
  await step('doc_remove', () => C.doc('rA1').remove());
  await step('doc_get', () => C.doc('rA1').get());
  await step('query_get', () => C.where({ status: 'open', isPrivate: false }).orderBy('createdAt', 'desc').limit(40).get());
  await step('count', () => C.where({ status: 'open' }).count());
  await step('doc_set', () => db.collection('sb_profile').doc('u1').set({ uid: 'u1', createdAt: db.serverDate() }));
  await step('update_with_id_key', () => C.doc('rA1').update({ _id: 'z' }));
  return out;
};
window.__ready = true;
</script>`;
const reqs = [];
await ctx.route('**/*', async (route) => {
  const req = route.request();
  const u = new URL(req.url());
  if (u.host === 'app.local') {
    if (u.pathname === '/t.html') return route.fulfill({ status: 200, contentType: 'text/html', body: TEST_HTML });
    const f = path.join(REPO, u.pathname);
    if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: f.endsWith('.js') || f.endsWith('.mjs') ? 'application/javascript' : 'text/plain', body: fs.readFileSync(f) });
    return route.fulfill({ status: 404, body: 'nf' });
  }
  let body = req.postData();
  let parsed = null; try { parsed = JSON.parse(body); } catch (e) {}
  reqs.push({ method: req.method(), url: req.url(), headers: Object.fromEntries(Object.entries(req.headers()).filter(([k]) => /auth|content-type|x-sdk|x-tcb|x-seqid|x-request|x-device/i.test(k))), body: parsed || body });
  const cors = { 'access-control-allow-origin': 'http://app.local', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (/signin\/anonymously/.test(u.pathname)) {
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ token_type: 'Bearer', access_token: 'AT.fake', refresh_token: 'RT.fake', expires_in: 1, scope: 'anonymous', sub: 'uidAnon123' }) });
  }
  if (/\/auth\/v1\/token/.test(u.pathname)) {
    return route.fulfill({ status: 400, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ error: 'invalid_grant', error_description: 'invalid refresh token. for it may be has been refreshed by other request' }) });
  }
  if (/\/auth\/v1\/user\/me/.test(u.pathname)) {
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ sub: 'uidAnon123', name: '', is_anonymous: true }) });
  }
  if (/tcb-api\.tencentcloudapi\.com\/web/.test(req.url())) {
    const action = parsed && parsed.action;
    if (MODE === 'perm') {
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied', requestId: 'req-' + action }) });
    }
    if (MODE === 'nocoll') {
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ code: 'DATABASE_COLLECTION_NOT_EXIST', message: 'Db or Table not exist: hansen_pk_rooms', requestId: 'req-' + action }) });
    }
    if (MODE === 'http500') {
      return route.fulfill({ status: 500, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ code: 'SYS_ERR', message: 'boom' }) });
    }
    if (MODE === 'cors') {
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: {} }) }); // no ACAO → CORS block
    }
    if (MODE === 'abort') return route.abort('failed');
    // ok mode: success shapes, updated:0 for where-update (simulating basic-permission silent filter)
    const okData = {
      'database.addDocument': { _id: 'rA1' },
      'database.updateDocument': { updated: 0, upserted_id: null },
      'database.deleteDocument': { deleted: 0 },
      'database.queryDocument': { list: [] },
      'database.countDocument': { total: 0 },
    }[action] || {};
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ data: okData, requestId: 'req-' + action }) });
  }
  return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({}) });
});
await page.goto('http://app.local/t.html');
await page.waitForFunction(() => window.__ready === true);
const out = await page.evaluate(() => window.__run());
console.log(JSON.stringify({ MODE, out }, null, 1));
console.log('=== REQUESTS ===');
for (const r of reqs) console.log(JSON.stringify(r).slice(0, 900));
console.log('=== LOG ===');
console.log(log.slice(0, 40).join('\n'));
await browser.close();
