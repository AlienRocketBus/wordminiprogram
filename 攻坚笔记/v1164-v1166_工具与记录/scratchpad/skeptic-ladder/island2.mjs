// Island entry: 拼写大PK screen (HansenSbPK) → 天梯排位 (kLadder). Is the ladder screen visible?
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  localStorage.setItem('hansen_auth_v1004', JSON.stringify({ uid: 'U1', method: 'phone', signedAt: Date.now() }));
});
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
await pg.goto(`http://127.0.0.1:${port}/island_animal.html`, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(5000);
const topChain = () => pg.evaluate(() => { const e0 = document.elementFromPoint(195, 400); const c = []; let e = e0; while (e && c.length < 6) { c.push(e.id ? '#' + e.id : e.tagName); e = e.parentElement; } return c.join('<'); });
await pg.evaluate(() => {
  HansenPkRoom._setMeForTest({ id: 'U1', name: '甲' });
  const store = { r1: { _id: 'r1', status: 'open', isPrivate: false, mode: 'A', hostRating: 1000, hostId: 'H', guestId: '', heartbeatAt: Date.now(), createdAt: Date.now() } };
  HansenPkRoom._setTransportForTest({
    add: d => ({ id: d._id }), list: () => [], listOpen: () => Object.values(store).map(x => ({ ...x, heartbeatAt: Date.now() })),
    claim: () => ({ updated: 0 }), patch: () => true, remove: () => true, read: id => store[id] || null });
  window.__hsnLadderWaitSec = 3;
  openSpellPK();
});
await pg.waitForTimeout(400);
await pg.evaluate(() => document.getElementById('kLadder').click());
await pg.waitForTimeout(600);
console.log('after kLadder top:', await topChain());
await pg.evaluate(() => document.getElementById('ldGo').click());   // programmatic: matching starts hidden
await pg.waitForTimeout(2500);
console.log('after ldGo (programmatic) top:', await topChain(), ' prwrap:', await pg.evaluate(() => { const w = document.querySelector('.pr_wrap'); return w ? w.innerText.replace(/\s+/g, ' ').slice(0, 60) : null; }));
await pg.evaluate(() => { const b = document.getElementById('prReMatch'); if (b) b.click(); });
await pg.waitForTimeout(800);
console.log('after 再找一次对手 top:', await topChain(), ' ladderOn:', await pg.evaluate(() => document.getElementById('hsn_ladder_screen').classList.contains('on')));
console.log('pageerrors', JSON.stringify(errs));
await browser.close(); srv.close();
