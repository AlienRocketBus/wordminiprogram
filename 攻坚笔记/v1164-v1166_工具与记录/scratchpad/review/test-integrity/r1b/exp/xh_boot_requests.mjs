/* XH: which Tencent requests does a signed-OUT island page make on load (v1163 vs v1164)?
 * The old test_ui_walkthrough fails on v1164 with ERR_TUNNEL_CONNECTION_FAILED (a real outbound request). Usage: node xh_boot_requests.mjs <root> */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const { chromium } = await import(path.join(ROOT, 'playwright_loader.mjs'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.css': 'text/css', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise((r) => srv.listen(0, r));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const out = {};
for (const file of ['island_animal.html', 'spelling_pk.html', 'index.html']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const reqs = [];
  await ctx.route((u) => !/^http:\/\/127\.0\.0\.1/.test(u.toString()), (r) => { const q = r.request(); let a = ''; try { a = (JSON.parse(q.postData() || '{}').action) || ''; } catch (e) {} reqs.push(new URL(q.url()).hostname.replace(/^[^.]+/, '<env>') + new URL(q.url()).pathname + (a ? ' ' + a : '')); r.abort().catch(() => {}); });
  const pg = await ctx.newPage();
  await pg.goto(`http://127.0.0.1:${srv.address().port}/${file}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(12000);
  out[file] = reqs;
  await ctx.close();
}
console.log(JSON.stringify(out));
await browser.close(); srv.close();
