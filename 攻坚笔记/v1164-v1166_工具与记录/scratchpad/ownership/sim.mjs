/* Two-"phone" ladder simulation with a shared fake CloudBase DB enforcing
 * hansen_pk_rooms = all-read / creator-only-write (legacy READONLY semantics).
 *
 * The fake is injected with HansenPkRoom._setDbForTest(), which replaces ONLY
 * the `db()` return inside realTransport() -> so realTransport's add/list/
 * listOpen/claim/patch/remove/read code (and wrapTimeout) run unchanged.
 * Server-error shape mimics @cloudbase/database 2.30: errors are RESOLVED as
 * {code,message} (throwWhenRequestFail=false), never rejected.
 *
 * MODE env:
 *   legacy  : non-owner write -> {updated:0}/{deleted:0} (no error)
 *   rules   : non-owner write -> resolved {code:'DATABASE_PERMISSION_DENIED',...}
 *   claimok : like legacy, but the guest's join-claim (where-update that sets guestId) is allowed
 *             -> shows what still breaks downstream if only the join were fixed
 *   open    : no permission checks (control)
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/claude/work/repo';
const MODE = process.env.MODE || 'legacy';
const HOST_WAIT_TOTAL = Number(process.env.HOST_WAIT || 0);   // extra seconds to wait for host timeout
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const VER = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/VERSION') { r.writeHead(200, { 'content-type': 'text/plain' }); r.end(VER); return; }
  fs.readFile(path.join(ROOT, p), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    r.end(d);
  });
});
await new Promise(r => srv.listen(0, r));
const port = srv.address().port;

/* ── shared store ── */
const store = {};     // coll -> Map(id -> doc)
const log = [];
function coll(n) { return store[n] || (store[n] = new Map()); }
function match(doc, w) { return Object.keys(w || {}).every(k => JSON.stringify(doc[k]) === JSON.stringify(w[k])); }
const DENY = { code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied' };
function canWrite(who, doc, req) {
  if (MODE === 'open') return true;
  if (doc._openid === who) return true;
  if (MODE === 'claimok' && req.op === 'qupdate' && req.data && 'guestId' in req.data && req.data.status === 'playing') return true;
  return false;
}
let seq = 0;
function handle(who, req) {
  const C = coll(req.coll);
  const t = Date.now();
  let res;
  switch (req.op) {
    case 'add': {
      const id = req.data._id || ('auto' + (++seq));
      if (C.has(id)) { res = { code: 'DATABASE_DOC_EXISTS', message: 'duplicate _id' }; break; }
      C.set(id, Object.assign({}, req.data, { _id: id, _openid: who }));
      res = { id, requestId: 'x' }; break;
    }
    case 'qget': {
      let rows = [...C.values()].filter(d => match(d, req.where));
      if (req.order) for (const o of req.order.slice().reverse())
        rows.sort((a, b) => (o.direction === 'desc' ? -1 : 1) * ((a[o.field] > b[o.field]) - (a[o.field] < b[o.field])));
      res = { data: rows.slice(0, req.limit || 100).map(d => Object.assign({}, d)), requestId: 'x' }; break;
    }
    case 'qupdate': {
      const rows = [...C.values()].filter(d => match(d, req.where));
      const okRows = rows.filter(d => canWrite(who, d, req));
      if (MODE === 'rules' && okRows.length < rows.length) { res = DENY; break; }
      okRows.forEach(d => Object.assign(d, req.data));
      res = { updated: okRows.length, requestId: 'x' }; break;
    }
    case 'dget': { const d = C.get(req.id); res = { data: d ? [Object.assign({}, d)] : [], requestId: 'x' }; break; }
    case 'dupdate': {
      const d = C.get(req.id);
      if (!d) { res = { updated: 0, requestId: 'x' }; break; }
      if (!canWrite(who, d, req)) { res = MODE === 'rules' ? DENY : { updated: 0, requestId: 'x' }; break; }
      Object.assign(d, req.data); res = { updated: 1, requestId: 'x' }; break;
    }
    case 'dremove': {
      const d = C.get(req.id);
      if (!d) { res = { deleted: 0, requestId: 'x' }; break; }
      if (!canWrite(who, d, req)) { res = MODE === 'rules' ? DENY : { deleted: 0, requestId: 'x' }; break; }
      C.delete(req.id); res = { deleted: 1, requestId: 'x' }; break;
    }
    default: res = { code: 'UNSUPPORTED', message: req.op };
  }
  const brief = req.op === 'qget' ? `rows=${res.data ? res.data.length : res.code}` :
    (res.code ? res.code : JSON.stringify(res).slice(0, 60));
  if (req.op !== 'dget' || process.env.VERBOSE)
    log.push(`${new Date(t).toISOString().slice(14, 23)} ${who} ${req.op.padEnd(7)} ${req.coll} ${req.id || JSON.stringify(req.where || {}).slice(0, 70)} ${req.data ? JSON.stringify(req.data).slice(0, 90) : ''} => ${brief}`);
  return res;
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

async function phone(who, phoneNo, uid) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  // block anything not localhost (sandbox can't reach Tencent anyway)
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(`http://127.0.0.1:${port}/`)) return route.continue();
    return route.abort();
  });
  await ctx.exposeBinding('__fdb', (src, req) => handle(who, req));
  await ctx.addInitScript(([phoneNo, uid]) => {
    try {
      localStorage.clear();
      localStorage.setItem('hansen_auth_v1004', JSON.stringify({ uid, phone: phoneNo, method: 'phone', signedAt: Date.now() }));
    } catch (e) {}
    window.__makeFakeDb = function () {
      const call = (req) => window.__fdb(req);
      function Q(c, where, order, limit) {
        return {
          where: (w) => Q(c, Object.assign({}, where, w), order, limit),
          orderBy: (f, d) => Q(c, where, (order || []).concat([{ field: f, direction: d }]), limit),
          limit: (n) => Q(c, where, order, n),
          get: () => call({ op: 'qget', coll: c, where, order, limit }),
          update: (data) => call({ op: 'qupdate', coll: c, where, data }),
          count: () => call({ op: 'qget', coll: c, where }).then(r => ({ total: (r.data || []).length }))
        };
      }
      return {
        collection: (c) => Object.assign(Q(c, {}, [], 0), {
          add: (doc) => call({ op: 'add', coll: c, data: doc }),
          doc: (id) => ({
            get: () => call({ op: 'dget', coll: c, id }),
            update: (data) => call({ op: 'dupdate', coll: c, id, data }),
            remove: () => call({ op: 'dremove', coll: c, id })
          })
        })
      };
    };
  }, [phoneNo, uid]);
  const pg = await ctx.newPage();
  pg._errs = [];
  pg.on('pageerror', e => pg._errs.push(String(e.message).slice(0, 120)));
  pg.on('dialog', d => { pg._errs.push('DIALOG: ' + d.message()); d.dismiss().catch(() => {}); });
  pg.on('console', m => { if (/\[对战\]|\[房间\]/.test(m.text())) pg._errs.push('console: ' + m.text().slice(0, 140)); });
  await pg.goto(`http://127.0.0.1:${port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(6000);
  await pg.evaluate(() => {
    window.HansenPkRoom._setDbForTest(window.__makeFakeDb());
    window.__hsnLadderWaitSec = 3;
    if (window.__PER_WORD) window.HansenPkRoom.MODES.A.perWordSecs = window.__PER_WORD;
  });
  return pg;
}

function vis(pg) {
  return pg.evaluate(() => {
    const pick = (id) => { const el = document.getElementById(id); return el && el.classList.contains('on') ? el.innerText.replace(/\s+/g, ' ').trim().slice(0, 260) : null; };
    return { ladder: pick('hsn_ladder_screen'), room: pick('hsn_pkroom_screen') };
  });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const T0 = Date.now();
const ts = () => ((Date.now() - T0) / 1000).toFixed(1) + 's';

console.log(`MODE=${MODE}`);
const A = await phone('openid_A', '+86 13800000001', 'uidA');
const B = await phone('openid_B', '+86 13800000002', 'uidB');
if (process.env.PER_WORD) for (const p of [A, B]) await p.evaluate((n) => { window.HansenPkRoom.MODES.A.perWordSecs = n; }, Number(process.env.PER_WORD));

console.log(ts(), 'A taps 天梯排位 → 开始排位');
await A.evaluate(() => { window.HansenLadderUI.open(); document.getElementById('ldGo').click(); });
await sleep(7000);
console.log(ts(), 'A screen:', JSON.stringify(await vis(A)));

console.log(ts(), 'B taps 天梯排位 → 开始排位');
await B.evaluate(() => { window.HansenLadderUI.open(); document.getElementById('ldGo').click(); });
await sleep(4000);
console.log(ts(), 'B screen:', JSON.stringify(await vis(B)));
console.log(ts(), 'A screen:', JSON.stringify(await vis(A)));

if (MODE === 'legacy' || MODE === 'rules') {
  console.log(ts(), 'B taps 「⚡ 再找一次对手」 then 开始排位 again');
  await B.evaluate(() => { const b = document.getElementById('prReMatch'); if (b) b.click(); });
  await sleep(600);
  await B.evaluate(() => { const g = document.getElementById('ldGo'); if (g) g.click(); });
  await sleep(4000);
  console.log(ts(), 'B screen (2nd try):', JSON.stringify(await vis(B)));
}

if (MODE === 'claimok' || MODE === 'open') {
  // guest B types every answer correctly as fast as possible; host A types nothing.
  const until = Date.now() + Number(process.env.BATTLE_SECS || 70) * 1000;
  let lastIdx = -1;
  while (Date.now() < until) {
    const r = await B.evaluate(() => {
      const st = window.HansenPkRoomUI._stateForTest(), rt = window.HansenPkRoomUI._rtForTest();
      const inp = document.getElementById('prIn');
      if (!st || !rt || !inp || rt.answered) return { idx: rt && rt.idx };
      const w = (st.words || [])[rt.idx]; if (!w) return { idx: rt.idx };
      inp.value = w.en; inp.oninput && inp.oninput();
      return { idx: rt.idx, typed: w.en };
    });
    if (r && r.typed && r.idx !== lastIdx) {
      lastIdx = r.idx;
      await sleep(400);
      console.log(ts(), `B typed #${r.idx} "${r.typed}" → B:`, JSON.stringify((await vis(B)).room));
      console.log(ts(), `      A:`, JSON.stringify((await vis(A)).room));
    }
    await sleep(500);
  }
  console.log(ts(), 'A final:', JSON.stringify(await vis(A)));
  console.log(ts(), 'B final:', JSON.stringify(await vis(B)));
  for (const [n, p] of [['A', A], ['B', B]]) {
    console.log(n, 'pk record:', await p.evaluate(() => { const s = window.HansenPkRecord.summary(); return JSON.stringify({ w: s.wins, l: s.losses, d: s.draws, rating: s.rating, hist: s.history.slice(0, 2) }); }));
  }
}

if (HOST_WAIT_TOTAL) {
  console.log(ts(), `waiting ${HOST_WAIT_TOTAL}s for host's waitForOpponent timeout…`);
  await sleep(HOST_WAIT_TOTAL * 1000);
  console.log(ts(), 'A screen:', JSON.stringify(await vis(A)));
  console.log(ts(), 'B screen:', JSON.stringify(await vis(B)));
}

console.log('\n── store hansen_pk_rooms ──');
for (const d of coll('hansen_pk_rooms').values())
  console.log(JSON.stringify({ _id: d._id, _openid: d._openid, status: d.status, hostId: d.hostId, guestId: d.guestId, hostName: d.hostName,
    round: d.round, winners: d.winners, hostReady: d.hostReady, guestReady: d.guestReady, hostBeat: !!d.hostBeat, guestBeat: d.guestBeat, hostScore: d.hostScore, guestScore: d.guestScore, endedBy: d.endedBy }));
console.log('\n── op log (dget suppressed) ──');
console.log(log.slice(0, Number(process.env.LOGN || 80)).join('\n'));
console.log('\n── page errors/dialogs ──');
console.log('A:', A._errs.slice(0, 12));
console.log('B:', B._errs.slice(0, 12));
await browser.close(); srv.close();
