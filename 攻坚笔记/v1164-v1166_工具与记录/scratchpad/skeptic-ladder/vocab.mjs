import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/claude/work/repo';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  if (p === '/VERSION') { r.writeHead(200); r.end('1163'); return; }
  fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
for (const pgName of ['island_animal.html', 'island_season.html', 'spelling_pk.html', 'index.html']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage(); pg.on('console', m => { if (/error/i.test(m.type())) console.log('  console', m.text().slice(0,120)); });
  await pg.goto(`http://127.0.0.1:${port}/${pgName}`, { waitUntil: 'domcontentloaded' }).catch(e => console.log('goto', e.message));
  await pg.waitForTimeout(5000);
  const r = await pg.evaluate(() => ({ vocabKeys: window.HANSEN_VOCAB_ALL ? Object.keys(HANSEN_VOCAB_ALL).length : null,
    words: (() => { try { let n = 0; for (const k in (window.HANSEN_VOCAB_ALL||{})) n += (HANSEN_VOCAB_ALL[k]||[]).length; return n; } catch (e) { return 'err'; } })(),
    sbpk: !!window.HansenSbPK, ladder: !!window.HansenLadderUI, frame: !!document.getElementById('islandFrame'), url: location.href.slice(-40), scripts: document.scripts.length }));
  console.log(pgName, JSON.stringify(r));
  await ctx.close();
}
await browser.close(); srv.close();
