// Privacy/safety review harness: own static server over the read-only v1163 snapshot.
// OS-assigned port, correct MIME types, GET /VERSION -> 1163. External requests are aborted and logged.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const SCR = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad';
export const ROOT = SCR + '/v1163_snapshot';
export const OUT = SCR + '/allround/privacy-safety/out';
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8'
};

export async function startServer() {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    if (p === '/VERSION') { r.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }); r.end('1163'); return; }
    const fp = path.join(ROOT, p);
    if (!fp.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
    fs.readFile(fp, (e, d) => {
      if (e) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
      r.end(d);
    });
  });
  await new Promise(res => srv.listen(0, '127.0.0.1', res));
  return { srv, base: `http://127.0.0.1:${srv.address().port}` };
}

export async function launch() {
  return chromium.launch({ headless: true, args: ['--no-sandbox'] });
}

export async function newCtx(browser, ext) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'zh-CN',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.47(0x18002f2f) NetType/WIFI Language/zh_CN'
  });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => {
    try { const u = new URL(rt.request().url()); ext && ext.push({ host: u.host, path: u.pathname.slice(0, 60), type: rt.request().resourceType() }); } catch (e) {}
    return rt.abort();
  });
  return ctx;
}
