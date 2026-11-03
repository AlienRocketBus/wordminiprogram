// Skeptic probe: real SDK + real room module; server returns coded errors with various HTTP statuses.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path';
const REPO = '/home/claude/work/repo';
const STATUS = Number(process.env.STATUS || 403);
const CODE = process.env.CODE || 'DATABASE_PERMISSION_DENIED';
const browser = await chromium.launch();
const ctx = await browser.newContext();
const log = [];
await ctx.route('**/*', async (route) => {
  const req = route.request(); const u = new URL(req.url());
  const cors = { 'access-control-allow-origin': 'http://app.local', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
  if (u.host === 'app.local') {
    if (u.pathname === '/t.html') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset=utf-8><body>' });
    const f = path.join(REPO, u.pathname);
    return fs.existsSync(f) ? route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: '' });
  }
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (/signin\/anonymously/.test(u.pathname)) return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ token_type: 'Bearer', access_token: 'AT.x', refresh_token: 'RT.x', expires_in: 7200, sub: 'uidX' }) });
  if (/user\/me/.test(u.pathname)) return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ sub: 'uidX' }) });
  if (/\/web/.test(u.pathname)) { const b = JSON.parse(req.postData()); log.push(b.action + ' -> HTTP ' + STATUS); return route.fulfill({ status: STATUS, headers: cors, body: JSON.stringify({ code: CODE, message: 'm', requestId: 'r' }) }); }
  return route.fulfill({ status: 200, headers: cors, body: '{}' });
});
const page = await ctx.newPage();
await page.goto('http://app.local/t.html');
const out = await page.evaluate(async () => {
  window.HANSEN_VOCAB_ALL = { a: [{ en: 'apple', cn: '苹果' }, { en: 'bee', cn: '蜜蜂' }] };
  const mod = await import('/vendor_cloudbase_esm_v965.js'); const cb = mod.default || mod;
  const app = cb.init({ env: 'ambitious-d0g1d26xm740dc3d6', region: 'ap-shanghai' });
  const auth = app.auth({ persistence: 'local' });
  try { await auth.signInAnonymously(); } catch (e) {}
  const r = {};
  try { r.raw_get = { resolved: await app.database().collection('hansen_pk_rooms').where({status:'open'}).get() }; }
  catch (e) { r.raw_get = { rejected: String(e && e.message || JSON.stringify(e)) }; }
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/hansen_pk_room_v1065.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  HansenPkRoom._setDbForTest(app.database());
  HansenPkRoom._setMeForTest({ id: 'userX', name: 'X' });
  const lr = await HansenPkRoom.listRooms();
  r.listRooms = { ok: lr.ok, reason: lr.reason, n: (lr.rooms||[]).length };
  const why = String(lr.reason || '');
  r.ladder_branch = lr.ok === false ? ((/登录|会话|session|unauthenticated|credential|未加载/i.test(why)) ? 'showNeedLogin' : 'netFail→showOffline after 4') : 'treated as ok (no rooms)';
  const cr = await HansenPkRoom.createRoom({ mode: 'A', hostRating: 1000 });
  r.createRoom = { ok: cr.ok, reason: cr.reason, roomId: cr.roomId };
  try { HansenPkRoom.stopHeartbeat(); } catch (e) {}
  return r;
});
console.log(JSON.stringify({ STATUS, CODE, out }, null, 1));
console.log(log.join('\n'));
await browser.close();
