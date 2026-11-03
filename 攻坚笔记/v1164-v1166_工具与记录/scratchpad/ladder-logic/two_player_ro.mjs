// Two real browser pages share ONE fake room store (node side) — tests ladder matchmaking between two players.
// Usage: node two_player.mjs <offsetMs> <visDelayMs> <waitSec> <observeMs> [play]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/claude/work/repo';
const OFFSET = Number(process.argv[2] || 0);
const VIS = Number(process.argv[3] || 0);
const WAITSEC = Number(process.argv[4] || 20);
const OBS = Number(process.argv[5] || 40000);
const PLAY = process.argv[6] === 'play';
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

const rooms = new Map();          // shared "cloud"
const log = [];
const t0 = Date.now();
const L = (s) => { const m = `+${String(Date.now() - t0).padStart(6)}ms ${s}`; log.push(m); };
const clone = o => o == null ? null : JSON.parse(JSON.stringify(o));
function tx(who, op, a, b, c) {
  const now = Date.now();
  switch (op) {
    case 'add': { const d = clone(a); d.__visAt = now + VIS; rooms.set(d._id, d); L(`${who} ADD ${d._id} mode=${d.mode} rating=${d.hostRating}`); return { id: d._id }; }
    case 'listOpen': {
      const out = [...rooms.values()].filter(r => r.status === 'open' && r.isPrivate === false && !r.guestId && r.__visAt <= now);
      L(`${who} LISTOPEN -> [${out.map(r => r._id + '(' + r.hostId + ')').join(',')}]`);
      return clone(out);
    }
    case 'list': { const out = [...rooms.values()].filter(r => Object.keys(a || {}).every(k => r[k] === a[k])); return clone(out); }
    case 'claim': {
      const r = rooms.get(a); if (!r) { L(`${who} CLAIM ${a} -> no room`); return { updated: 0 }; }
      if (r.hostId !== who) { L(`${who} CLAIM ${a} -> denied (READONLY: not creator) updated:0`); return { updated: 0 }; }
      for (const k of Object.keys(b || {})) if (JSON.stringify(r[k]) !== JSON.stringify(b[k])) { if (!('round' in b)) L(`${who} CLAIM ${a} guard ${k} fail`); return { updated: 0 }; }
      Object.assign(r, clone(c)); if (!('round' in b)) L(`${who} CLAIM ${a} OK`); return { updated: 1 };
    }
    case 'patch': { const r = rooms.get(a); if (r && r.hostId === who) Object.assign(r, clone(b)); return true; }
    case 'remove': { L(`${who} REMOVE ${a}`); rooms.delete(a); return true; }
    case 'read': { const r = rooms.get(a); return r && r.__visAt <= now ? clone(r) : null; }
  }
}

async function openPage(id, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(u => {
    localStorage.setItem('hansen_auth_v1004', JSON.stringify({ uid: u.id, method: 'phone', signedAt: Date.now() }));
  }, { id });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  await pg.exposeFunction('__tx', (op, a, b, c) => tx(id, op, a, b, c));
  await pg.goto(`http://127.0.0.1:${port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4000);
  await pg.evaluate(o => {
    window.__hsnLadderWaitSec = o.w;
    HansenPkRoom._setMeForTest({ id: o.id, name: o.name });
    const T = {};
    ['add', 'listOpen', 'list', 'claim', 'patch', 'remove', 'read'].forEach(k => { T[k] = (a, b, c) => window.__tx(k, a, b, c); });
    HansenPkRoom._setTransportForTest(T);
  }, { w: WAITSEC, id, name });
  return { pg, errs, ctx, id };
}
const screen = pg => pg.evaluate(() => {
  const v = [...document.querySelectorAll('.pr_wrap,.ld_wrap')].filter(w => {
    const p = w.parentElement; return p && getComputedStyle(p).display !== 'none';
  });
  return v.map(w => (w.innerText || '').replace(/\s+/g, ' ').slice(0, 90)).join(' || ');
});

const A = await openPage('P1', '甲');
const B = await openPage('P2', '乙');
await A.pg.evaluate(() => HansenLadderUI.open());
await B.pg.evaluate(() => HansenLadderUI.open());
await A.pg.waitForTimeout(500);
L('A clicks 开始排位');
await A.pg.evaluate(() => document.getElementById('ldGo').click());
if (OFFSET) await A.pg.waitForTimeout(OFFSET);
L('B clicks 开始排位');
await B.pg.evaluate(() => document.getElementById('ldGo').click());

let autoplay = null;
if (PLAY) {
  const play = (pg, delay) => pg.evaluate(d => {
    if (window.__autoplay) return; window.__autoplay = 1;
    setInterval(() => {
      try {
        const st = HansenPkRoomUI._stateForTest(), rt = HansenPkRoomUI._rtForTest();
        const inp = document.getElementById('prIn');
        if (!st || !rt || !inp || rt.answered || inp.disabled) return;
        if (Date.now() - rt.t0 < d) return;
        const w = (st.words || [])[rt.idx]; if (!w) return;
        inp.value = w.en; inp.dispatchEvent(new Event('input'));
      } catch (e) {}
    }, 300);
  }, delay);
  await play(A.pg, 900); await play(B.pg, 2500);
}

const end = Date.now() + OBS;
let lastA = '', lastB = '';
while (Date.now() < end) {
  const sa = await screen(A.pg), sb = await screen(B.pg);
  const ka = sa.replace(/\d+/g,'#'), kb = sb.replace(/\d+/g,'#');
  if (ka !== lastA) { L('A screen: ' + sa); lastA = ka; }
  if (kb !== lastB) { L('B screen: ' + sb); lastB = kb; }
  await A.pg.waitForTimeout(700);
}
const recA = await A.pg.evaluate(() => { const s = HansenPkRecord.summary(); return { total: s.total, rating: s.rating, pg: s.placementGames }; });
const recB = await B.pg.evaluate(() => { const s = HansenPkRecord.summary(); return { total: s.total, rating: s.rating, pg: s.placementGames }; });
L('rooms in store: ' + JSON.stringify([...rooms.values()].map(r => ({ id: r._id, host: r.hostId, guest: r.guestId, status: r.status, round: r.round, hs: r.hostScore, gs: r.guestScore }))));
L('records A=' + JSON.stringify(recA) + ' B=' + JSON.stringify(recB));
L('pageerrors A=' + JSON.stringify(A.errs) + ' B=' + JSON.stringify(B.errs));
console.log(log.join('\n'));
await browser.close(); srv.close();
