// Shared harness: static server for the repo + Chromium contexts wired to an emulator.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

export const REPO = process.env.REPO || '/home/claude/work/repo';
export const ENV = 'ambitious-d0g1d26xm740dc3d6';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };

export const SDK_PAGE = `<!doctype html><meta charset="utf-8"><title>emu-poc</title><body>poc
<script type="module">
window.__ready = (async () => {
  const q = new URLSearchParams(location.search);
  const mod = await import('/vendor_cloudbase_esm_v965.js');
  const cb = mod && (mod.default || mod);
  const init = cb && (cb.init || (cb.default && cb.default.init));
  const region = q.get('region') || '';
  const app = init.call(cb, region ? { env: '${ENV}', region } : { env: '${ENV}' });
  const auth = app.auth ? app.auth({ persistence: 'local' }) : null;
  window.__app = app; window.__auth = auth;
  return { version: cb.version || null };
})();
</script>`;

export function startStatic(virtual = {}) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/__poc__/sdk.html') { res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' }); return res.end(SDK_PAGE); }
    if (virtual[u.pathname]) { const v = virtual[u.pathname]; res.writeHead(200, { 'content-type': v.type || MIME['.html'], 'cache-control': 'no-store' }); return res.end(v.body); }
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const fp = path.join(REPO, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!fp.startsWith(path.resolve(REPO))) { res.writeHead(403); return res.end(); }
    fs.stat(fp, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('404'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-store' });
      fs.createReadStream(fp).pipe(res);
    });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

export async function launch() { return chromium.launch({ headless: true }); }

export async function newCtx(browser, emu, origin, { tag = 'X', url = '/__poc__/sdk.html', verbose = !!process.env.POC_VERBOSE, waitReady = true, ctxOpts = {} } = {}) {
  const ctx = await browser.newContext(ctxOpts);
  const unrouted = [];
  if (emu) await emu.attach(ctx);
  await ctx.route((u) => { const h = new URL(u).hostname; return h !== '127.0.0.1' && !/(tencentcloudapi|tcloudbase|myqcloud|qcloud|cloudbase\.net)/.test(h); }, (r) => { unrouted.push(r.request().url()); r.abort(); });
  const page = await ctx.newPage();
  const consoleLines = [];
  page.on('console', (m) => { consoleLines.push(`${m.type()}: ${m.text()}`); if (verbose || m.type() === 'error') console.log(`  [${tag} console.${m.type()}] ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => { consoleLines.push('pageerror: ' + e.message); console.log(`  [${tag} pageerror] ${e.message}`); });
  page.on('requestfailed', (r) => { if (verbose) console.log(`  [${tag} requestfailed] ${r.method()} ${r.url()} ${r.failure() && r.failure().errorText}`); });
  await page.goto(origin + url);
  const info = waitReady ? await page.evaluate(() => window.__ready) : null;
  return { ctx, page, info, unrouted, consoleLines };
}
export const E = (page, fn, arg) => page.evaluate(fn, arg).catch((e) => ({ __thrown: String(e && e.message || e) }));
