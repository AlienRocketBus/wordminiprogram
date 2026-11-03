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
const page = process.argv[2] || 'island_animal.html';
await pg.goto(`http://127.0.0.1:${port}/${page}`, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(5000);
const r = await pg.evaluate(async () => {
  const out = {};
  out.mods = { SbPK: !!window.HansenSbPK, LadderUI: !!window.HansenLadderUI, PkRoom: !!window.HansenPkRoom, PkRoomUI: !!window.HansenPkRoomUI, Rec: !!window.HansenPkRecord };
  if (typeof openSpellPK === 'function') openSpellPK(); else HansenSbPK.open();
  await new Promise(z => setTimeout(z, 500));
  const k = document.getElementById('kLadder');
  out.kLadder = !!k;
  if (k) k.click();
  await new Promise(z => setTimeout(z, 800));
  const top = document.elementFromPoint(195, 400);
  const chain = []; let e = top; while (e && chain.length < 12) { chain.push((e.id ? '#' + e.id : e.tagName) ); e = e.parentElement; }
  out.topAtCenter = chain.join(' < ');
  const ld = document.getElementById('hsn_ladder_screen'), pk = document.getElementById('hsn_pk_screen');
  out.ladderOn = ld ? ld.classList.contains('on') : null;
  out.ladderZ = ld ? getComputedStyle(ld).zIndex : null;
  out.pkOn = pk ? pk.classList.contains('on') : null;
  out.pkZ = pk ? getComputedStyle(pk).zIndex : null;
  out.activeEl = document.activeElement && (document.activeElement.id || document.activeElement.tagName);
  // Is the 开始排位 button actually hittable?
  const go = document.getElementById('ldGo');
  if (go) { const b = go.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); out.ldGoHittable = hit === go || go.contains(hit); out.ldGoHitInstead = hit && (hit.id || hit.className || hit.tagName); }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await pg.screenshot({ path: '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/skeptic-ladder/island_after.png' });
console.log('pageerrors', JSON.stringify(errs));
await browser.close(); srv.close();
