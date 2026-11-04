// Skeptic probe: which rejection reasons lead the ladder to showOffline vs showNeedLogin (v1163 E() + ladder regex)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path';
const REPO = '/home/claude/work/repo';
const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.route('**/*', async (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === '/t.html') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset=utf-8><body>' });
  const f = path.join(REPO, u.pathname);
  return fs.existsSync(f) ? route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: '' });
});
const page = await ctx.newPage();
await page.goto('http://app.local/t.html');
const out = await page.evaluate(async () => {
  const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  await load('/hansen_auth_v1004.js');
  await load('/hansen_pk_room_v1065.js');
  const cases = {
    session_not_ready: () => Promise.reject(new Error('云端会话不可用：云端会话尚未就绪（已重试 5 次），请稍候再试')),
    sdk_net: () => Promise.reject(new Error('network request error')),
    oauth_invalid_grant: () => Promise.reject({ error: 'invalid_grant', error_description: 'invalid refresh token. for it may be has been refreshed by' }),
    throw_true_perm: () => Promise.reject(new Error('{"code":"OPERATION_FAIL","msg":"[DATABASE_PERMISSION_DENIED] Permission denied"}')),
    unauth_obj: () => Promise.reject({ error: 'unauthenticated', error_description: 'credentials not found' }),
    resolved_code: () => Promise.resolve([]),
  };
  const r = {};
  for (const [k, fn] of Object.entries(cases)) {
    HansenPkRoom._setTransportForTest({ listOpen: fn, list: () => Promise.resolve([]), remove: () => Promise.resolve(true) });
    HansenPkRoom._setMeForTest({ id: 'u', name: 'n' });
    const lr = await HansenPkRoom.listRooms();
    const why = String(lr.reason || '');
    r[k] = { ok: lr.ok, reason: why, ladder: lr.ok === false ? ((lr.expired || /登录|会话|session|unauthenticated|credential|未加载/i.test(why)) ? 'showNeedLogin' : 'showOffline(after 4)') : 'ok' };
  }
  return { HBErrText: typeof window.HBErrText, r };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
