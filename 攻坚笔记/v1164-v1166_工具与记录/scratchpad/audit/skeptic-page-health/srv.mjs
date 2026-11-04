// Skeptic's own static server for the v1163 snapshot (read-only). listen(0).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
export const log = [];
export function startServer(opts = {}) {
  const cacheHeader = opts.cache || 'no-cache';
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      let u;
      try { u = new URL(req.url, 'http://x'); } catch { resp.writeHead(400); resp.end(); return; }
      let p; try { p = decodeURIComponent(u.pathname); } catch { p = u.pathname; }
      const rec = { t: Date.now(), p, q: u.search, st: 0, bytes: 0, ref: req.headers['referer'] || '', dest: req.headers['sec-fetch-dest'] || '', purpose: req.headers['sec-purpose'] || req.headers['purpose'] || '' };
      log.push(rec);
      if (p === '/VERSION') { rec.st = 200; rec.bytes = 4; resp.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }); resp.end('1163'); return; }
      if (p.endsWith('/')) p += 'index.html';
      const fp = path.join(ROOT, path.normalize(p));
      if (!fp.startsWith(ROOT)) { rec.st = 403; resp.writeHead(403); resp.end(); return; }
      fs.stat(fp, (err, st) => {
        if (err || !st.isFile()) { rec.st = 404; resp.writeHead(404, { 'content-type': 'text/plain' }); resp.end('404'); return; }
        const ext = path.extname(fp).toLowerCase();
        if (opts.patch && opts.patch[p]) {
          const body = Buffer.from(opts.patch[p](fs.readFileSync(fp, 'utf8')), 'utf8');
          rec.st = 200; rec.bytes = body.length; rec.patched = true;
          resp.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store', 'content-length': body.length });
          resp.end(body); return;
        }
        const etag = '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
        const headers = { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': cacheHeader, 'etag': etag, 'accept-ranges': 'bytes' };
        if (req.headers['if-none-match'] === etag) { rec.st = 304; resp.writeHead(304, { etag, 'cache-control': cacheHeader }); resp.end(); return; }
        const range = req.headers.range;
        if (range && /^bytes=\d*-\d*$/.test(range)) {
          let [a, b] = range.replace('bytes=', '').split('-');
          a = a ? parseInt(a) : 0; b = b ? parseInt(b) : st.size - 1; if (b >= st.size) b = st.size - 1;
          if (a >= st.size) { rec.st = 416; resp.writeHead(416); resp.end(); return; }
          rec.st = 206; rec.bytes = b - a + 1;
          resp.writeHead(206, { ...headers, 'content-length': b - a + 1, 'content-range': `bytes ${a}-${b}/${st.size}` });
          fs.createReadStream(fp, { start: a, end: b }).pipe(resp); return;
        }
        rec.st = 200; rec.bytes = st.size;
        resp.writeHead(200, { ...headers, 'content-length': st.size });
        if (req.method === 'HEAD') { resp.end(); return; }
        fs.createReadStream(fp).pipe(resp);
      });
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}
