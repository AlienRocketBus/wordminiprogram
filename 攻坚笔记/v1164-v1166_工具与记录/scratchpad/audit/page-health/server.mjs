// Tiny static server for the v1163 snapshot (read-only). listen(0) → OS port.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'audio/ogg',
};
export const hits = []; // every request path + status
export function startServer() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      let u;
      try { u = new URL(req.url, 'http://x'); } catch { resp.writeHead(400); resp.end(); return; }
      let p = decodeURIComponent(u.pathname); const q = u.search;
      if (p === '/VERSION') { resp.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }); resp.end('1163'); hits.push([p + q, 200]); return; }
      if (p.endsWith('/')) p += 'index.html';
      const fp = path.join(ROOT, path.normalize(p));
      if (!fp.startsWith(ROOT)) { resp.writeHead(403); resp.end(); return; }
      fs.stat(fp, (err, st) => {
        if (err || !st.isFile()) { resp.writeHead(404, { 'content-type': 'text/plain' }); resp.end('404'); hits.push([p + q, 404]); return; }
        const ext = path.extname(fp).toLowerCase();
        const etag = '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
        const headers = { 'content-type': MIME[ext] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-cache', 'etag': etag, 'last-modified': st.mtime.toUTCString() };
        if (req.headers['if-none-match'] === etag) { resp.writeHead(304, { etag, 'cache-control': 'no-cache' }); resp.end(); hits.push([p + q, 304]); return; }
        // honour Range for audio
        const range = req.headers.range;
        if (range && /bytes=\d*-\d*/.test(range)) {
          let [a, b] = range.replace('bytes=', '').split('-');
          a = a ? parseInt(a) : 0; b = b ? parseInt(b) : st.size - 1;
          if (a >= st.size) { resp.writeHead(416); resp.end(); return; }
          resp.writeHead(206, { ...headers, 'content-length': b - a + 1, 'content-range': `bytes ${a}-${b}/${st.size}`, 'accept-ranges': 'bytes' });
          fs.createReadStream(fp, { start: a, end: b }).pipe(resp); hits.push([p + q, 206]); return;
        }
        resp.writeHead(200, headers);
        if (req.method === 'HEAD') { resp.end(); return; }
        fs.createReadStream(fp).pipe(resp); hits.push([p + q, 200]);
      });
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}
