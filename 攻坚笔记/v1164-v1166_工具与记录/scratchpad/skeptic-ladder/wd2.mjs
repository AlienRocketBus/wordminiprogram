// Does closing the ladder (×, 先不弄, 去登录) arm the watchdog and pop a false "这一步没能打开" rescue 6s later?
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
async function scenario(name, page, fn, post) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('hansen_auth_v1004', JSON.stringify({ uid: 'U1', method: 'phone', signedAt: Date.now() - 3600e3 }));
  });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => { try { Object.defineProperty(document, 'visibilityState', { get: () => 'visible' }); } catch (e) {} });
  await pg.goto(`http://127.0.0.1:${port}/${page}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  await pg.evaluate(fn);
  await pg.waitForTimeout(9000);
  const st = () => pg.evaluate(() => ({ rescue: !!document.getElementById('pkRescue'),
    text: ((document.getElementById('pkRescue') || {}).innerText||'').replace(/\s+/g,' ').slice(0,60) }));
  console.log(name, 'step1', JSON.stringify(await st()));
  if (post) {
    await pg.evaluate(post);
    await pg.waitForTimeout(1000);
    console.log(name, 'right after post', JSON.stringify(await st()));
    await pg.waitForTimeout(9000);
    console.log(name, 'post+10s', JSON.stringify(await st()));
  }
  await ctx.close();
}
await scenario('ladder × then rescue 回到大PK首页', 'spelling_pk.html', async () => {
  HansenLadderUI.open(); await new Promise(z => setTimeout(z, 500)); document.getElementById('ldX').click();
}, () => { const b = document.getElementById('pkRescueBack'); if (b) b.click(); });
await scenario('open friends UI', 'spelling_pk.html', async () => {
  if (window.HansenFriendsUI) HansenFriendsUI.open(); else window.__nofr = 1;
});
await scenario('island: open friends UI', 'island_animal.html', async () => {
  if (window.HansenFriendsUI) HansenFriendsUI.open();
});
await browser.close(); srv.close();
