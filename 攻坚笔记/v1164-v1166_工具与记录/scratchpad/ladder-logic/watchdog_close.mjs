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
async function scenario(name, page, fn) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('hansen_auth_v1004', JSON.stringify({ uid: 'U1', method: 'phone', signedAt: Date.now() - 3600e3 }));
  });
  const pg = await ctx.newPage();
  // headless pages can report hidden; force visible so the watchdog ticks like on a phone in foreground
  await pg.addInitScript(() => { try { Object.defineProperty(document, 'visibilityState', { get: () => 'visible' }); } catch (e) {} });
  await pg.goto(`http://127.0.0.1:${port}/${page}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  await pg.evaluate(fn);
  await pg.waitForTimeout(9000);
  const r = await pg.evaluate(() => ({ rescue: !!document.getElementById('pkRescue'),
    text: (document.getElementById('pkRescue') || {}).innerText, wd: window.HansenPkWatchdog && HansenPkWatchdog._stateForTest() }));
  console.log(name, JSON.stringify(r).slice(0, 300));
  await ctx.close();
}
await scenario('spelling_pk: open ladder then ×', 'spelling_pk.html', async () => {
  HansenLadderUI.open(); await new Promise(z => setTimeout(z, 500)); document.getElementById('ldX').click();
});
await scenario('island: PK screen → 天梯 → (hidden) ; then 返回 reveals ladder → ×', 'island_animal.html', async () => {
  openSpellPK(); await new Promise(z => setTimeout(z, 400)); document.getElementById('kLadder').click();
  await new Promise(z => setTimeout(z, 400)); document.getElementById('kBack').click();
  await new Promise(z => setTimeout(z, 400)); document.getElementById('ldX').click();
});
await scenario('spelling_pk: needLogin → 去登录', 'spelling_pk.html', async () => {
  HansenAuth.ensureSession = () => Promise.resolve({ ok: false, notReady: true, reason: '云端会话尚未就绪（已重试 5 次），请稍候再试' });
  HansenAuth._app = () => Promise.resolve({ database() { return {}; } });
  HansenLadderUI.open(); await new Promise(z => setTimeout(z, 400)); document.getElementById('ldGo').click();
  await new Promise(z => setTimeout(z, 2500));
  const b = document.getElementById('ldGoLogin'); window.__sawNeedLogin = !!b; if (b) b.click();
});
await browser.close(); srv.close();
