// What does the ladder show for each failure reason, going through the REAL transport (realTransport/db()/E()/listRooms)?
// Only HansenAuth.ensureSession/_app and the SDK db object are faked.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = '/home/claude/work/repo';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/VERSION') { r.writeHead(200); r.end('1163'); return; }
  fs.readFile(path.join(ROOT, p), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d);
  });
});
await new Promise(r => srv.listen(0, r));
const port = srv.address().port;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

const CASES = {
  notReady:      { sess: { ok: false, notReady: true, expired: false, definite: false, reason: '云端会话尚未就绪（已重试 5 次），请稍候再试' } },
  sessImportErr: { sess: { ok: false, definite: false, reason: 'Failed to fetch dynamically imported module: https://x/vendor_cloudbase_esm_v965.js' } },
  sessExpired:   { sess: { ok: false, expired: true, definite: true, reason: 'credentials not found | unauthenticated' } },
  netErr:        { get: 'reject', err: { message: 'network request error' } },
  sdkTimeout:    { get: 'reject', err: { message: '[@cloudbase/js-sdk] 请求在15s内未完成，已中断' } },
  refreshTok:    { get: 'reject', err: { error: 'invalid_grant', error_description: 'invalid refresh token. for it may be has been refreshed by another' } },
  credNotFound:  { get: 'reject', err: { error: 'unauthenticated', error_description: 'credentials not found' } },
  noAuthInst:    { get: 'reject', err: { message: "you can't request without auth" } },
  permDenied:    { get: 'resolveCode', code: { code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied' } },
  collMissing:   { get: 'resolveCode', code: { code: 'DATABASE_COLLECTION_NOT_EXIST', message: 'Db or Table not exist: hansen_pk_rooms' } },
};
const which = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CASES);
const OBS = Number(process.env.OBS || 45000);

async function run(name) {
  const c = CASES[name];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('hansen_auth_v1004', JSON.stringify({ uid: 'U1', method: 'phone', signedAt: Date.now() - 3600e3 }));
  });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  await pg.goto(`http://127.0.0.1:${port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4000);
  await pg.evaluate(c => {
    window.__hsnLadderWaitSec = 6;
    window.__calls = [];
    HansenPkRoom._setMeForTest({ id: 'U1', name: '甲' });
    const A = window.HansenAuth;
    A.ensureSession = () => Promise.resolve(c.sess || { ok: true, uid: 'U1' });
    const store = {};
    const out = (kind) => {
      window.__calls.push(kind);
      if (c.get === 'reject') return Promise.reject(Object.assign(c.err.message ? new Error(c.err.message) : {}, c.err));
      if (c.get === 'resolveCode') return Promise.resolve(Object.assign({}, c.code));
      return null;
    };
    const Q = (coll) => {
      const q = {
        where() { return q; }, orderBy() { return q; }, limit() { return q; },
        get() { return out('get') || Promise.resolve({ data: [] }); },
        update() { return out('where.update') || Promise.resolve({ updated: 0 }); },
        count() { return out('count') || Promise.resolve({ total: 0 }); },
        add(d) { return out('add') || Promise.resolve({ id: d._id }); },
        doc(id) { return {
          get() { return out('doc.get') || Promise.resolve({ data: store[id] ? [store[id]] : [] }); },
          update() { return out('doc.update') || Promise.resolve({ updated: 1 }); },
          remove() { return out('doc.remove') || Promise.resolve({ deleted: 1 }); } }; },
      };
      return q;
    };
    const fakeApp = { database() { return { collection: Q, command: { gt: x => x } }; } };
    A._app = () => Promise.resolve(fakeApp);
  }, c);
  const t0 = Date.now();
  const lines = [];
  await pg.evaluate(() => HansenLadderUI.open());
  await pg.waitForTimeout(600);
  const board = await pg.evaluate(() => (document.getElementById('ldBoard') || {}).innerText);
  lines.push('board: ' + String(board).replace(/\s+/g, ' '));
  await pg.evaluate(() => document.getElementById('ldGo').click());
  let last = '';
  while (Date.now() - t0 < OBS) {
    const s = await pg.evaluate(() => [...document.querySelectorAll('.pr_wrap,.ld_wrap')].filter(w => getComputedStyle(w.parentElement).display !== 'none').map(w => w.innerText.replace(/\s+/g, ' ').slice(0, 160)).join(' || '));
    const k = s.replace(/\d+/g, '#');
    if (k !== last) { lines.push(`+${String(Date.now() - t0).padStart(6)}ms ${s}`); last = k; }
    await pg.waitForTimeout(400);
  }
  const calls = await pg.evaluate(() => window.__calls.length);
  console.log(`=== ${name}  (sdk calls=${calls}) pageerrors=${JSON.stringify(errs)}\n` + lines.join('\n'));
  await ctx.close();
}
await Promise.all(which.map(run));
await browser.close(); srv.close();
