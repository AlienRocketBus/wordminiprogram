// End-to-end: real SDK 2.30.0 + real hansen_pk_room_v1065.js (realTransport via _setDbForTest)
// against a FAKE in-memory CloudBase /web endpoint that simulates permission models.
// PERM=readonly  -> basic permission 「读取全部数据，修改本人数据」 as documented (writes implicitly filtered by _openid; no error)
// PERM=readonly_err -> same but non-owner writes return {code:'DATABASE_PERMISSION_DENIED'} (alternative server behavior)
// PERM=rule_auth -> custom rule {read:true, write:"auth != null"}
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path';
const REPO = '/home/claude/work/repo';
const PERM = process.env.PERM || 'readonly';
const docs = new Map(); // _id -> doc
const tokenUid = { 'AT.A': 'uidA', 'AT.B': 'uidB' };
const match = (d, q) => Object.entries(q || {}).every(([k, v]) => (v && typeof v === 'object' && '$lt' in v) ? d[k] < v.$lt : (v && typeof v === 'object' && '$gt' in v) ? d[k] > v.$gt : d[k] === v);
const reqlog = [];
function handle(body) {
  const uid = tokenUid[body.access_token];
  if (!uid) return { code: 'INVALID_ACCESS_TOKEN', message: 'bad token' }; if (PERM==='alldeny') return { code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied' };
  const a = body.action;
  if (a === 'database.addDocument') {
    const d = { ...body.data, _openid: uid };
    if (!d._id) d._id = 'auto' + Math.random().toString(36).slice(2, 8);
    if (docs.has(d._id)) return { code: 'DATABASE_REQUEST_FAILED', message: 'E11000 duplicate key' };
    docs.set(d._id, d); return { data: { _id: d._id }, requestId: 'r' };
  }
  if (a === 'database.queryDocument') {
    let list = [...docs.values()].filter(d => match(d, body.query));
    for (const o of (body.order || []).slice().reverse()) list.sort((x, y) => (o.direction === 'desc' ? -1 : 1) * ((x[o.field] > y[o.field]) - (x[o.field] < y[o.field])));
    return { data: { list: list.slice(0, body.limit || 100) }, requestId: 'r' };
  }
  if (a === 'database.countDocument') return { data: { total: [...docs.values()].filter(d => match(d, body.query)).length }, requestId: 'r' };
  if (a === 'database.updateDocument' || a === 'database.deleteDocument') {
    let hits = [...docs.values()].filter(d => match(d, body.query));
    const notMine = hits.filter(d => d._openid !== uid);
    if (PERM === 'readonly') hits = hits.filter(d => d._openid === uid);           // implicit _openid filter
    if (PERM === 'readonly_err' && notMine.length) return { code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied' };
    if (body.multi === false) hits = hits.slice(0, 1);
    if (a === 'database.deleteDocument') { hits.forEach(d => docs.delete(d._id)); return { data: { deleted: hits.length }, requestId: 'r' }; }
    hits.forEach(d => Object.assign(d, body.data.$set || {}));
    return { data: { updated: hits.length }, requestId: 'r' };
  }
  return { code: 'UNKNOWN_ACTION' };
}
const browser = await chromium.launch();
async function mkPage(who) {
  const ctx = await browser.newContext();
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const cors = { 'access-control-allow-origin': 'http://app.local', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
    if (u.host === 'app.local') {
      if (u.pathname === '/t.html') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset=utf-8><body>' });
      const f = path.join(REPO, u.pathname);
      return fs.existsSync(f) ? route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: '' });
    }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (/signin\/anonymously/.test(u.pathname)) return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ token_type: 'Bearer', access_token: 'AT.' + who, refresh_token: 'RT.' + who, expires_in: 7200, sub: 'uid' + who }) });
    if (/user\/me/.test(u.pathname)) return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ sub: 'uid' + who }) });
    if (/\/web/.test(u.pathname)) { if (PERM==='netfail') return route.abort('failed'); const b = JSON.parse(req.postData()); const r = handle(b); reqlog.push(who + ' ' + b.action + ' q=' + JSON.stringify(b.query || b.data).slice(0, 90) + ' -> ' + JSON.stringify(r).slice(0, 110)); return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(r) }); }
    return route.fulfill({ status: 200, headers: cors, body: '{}' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => reqlog.push(who + ' [pageerror] ' + e.message));
  await page.goto('http://app.local/t.html');
  await page.evaluate(async (who) => {
    window.HANSEN_VOCAB_ALL = { a: [{ en: 'apple', cn: '苹果' }, { en: 'bee', cn: '蜜蜂' }, { en: 'cat', cn: '猫' }] };
    const mod = await import('/vendor_cloudbase_esm_v965.js'); const cb = mod.default || mod;
    const app = cb.init({ env: 'ambitious-d0g1d26xm740dc3d6', region: 'ap-shanghai' });
    const auth = app.auth({ persistence: 'local' });
    try { await auth.signInAnonymously(); } catch (e) {}
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/hansen_pk_room_v1065.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    HansenPkRoom._setDbForTest(app.database());
    HansenPkRoom._setMeForTest({ id: 'user' + who, name: '玩家' + who });
  }, who);
  return page;
}
const A = await mkPage('A'), B = await mkPage('B');
const res = {};
res.A_create = await A.evaluate(() => HansenPkRoom.createRoom({ mode: 'A', hostRating: 1000 }).then(r => ({ ok: r.ok, roomId: r.roomId, reason: r.reason })));
res.B_list = await B.evaluate(() => HansenPkRoom.listRooms().then(r => ({ ok: r.ok, n: (r.rooms || []).length, ids: (r.rooms || []).map(x => x._id) })));
const rid = res.A_create.roomId;
res.B_read = await B.evaluate((rid) => new Promise(r=>setTimeout(r,10)).then(()=>HansenPkRoom.findByCode('ABCD')));
res.B_join = await B.evaluate((rid) => HansenPkRoom.joinRoom(rid).then(r => ({ ok: r.ok, taken: r.taken, reason: r.reason })), rid);
res.docAfterJoin = docs.get(rid) && { status: docs.get(rid).status, guestId: docs.get(rid).guestId, _openid: docs.get(rid)._openid };
res.B_claimRound0 = await B.evaluate((rid) => HansenPkRoom.claimRound(rid, 0).then(r => ({ ok: r.ok, won: r.won, reason: r.reason })), rid);
res.docRound = docs.get(rid) && { round: docs.get(rid).round, winners: docs.get(rid).winners };
await A.evaluate(() => HansenPkRoom.stopHeartbeat()); await B.evaluate(() => HansenPkRoom.stopHeartbeat());
console.log(JSON.stringify({ PERM, res }, null, 1));
console.log(reqlog.join('\n'));
await browser.close();
