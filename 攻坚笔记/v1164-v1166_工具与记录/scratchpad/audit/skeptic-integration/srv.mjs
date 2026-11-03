import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
export const ROOT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
export function serve(opts = {}) {
  const reqs = [];
  const state = { version: opts.version || '1163' };
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://h');
    let p = decodeURIComponent(u.pathname);
    let bytes = 0;
    const rec = { t: Date.now(), url: req.url, path: p, bytes: 0 };
    reqs.push(rec);
    if (p === '/VERSION') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end(String(state.version)); return; }
    if (p.endsWith('/')) p += 'index.html';
    let fp = path.join(ROOT, path.normalize(p));
    if (opts.override && opts.override[p]) fp = opts.override[p];
    else if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.stat(fp, (err, st) => {
      if (err || !st.isFile()) { rec.status = 404; res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
      const ext = path.extname(fp).toLowerCase();
      const h = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size };
      if (opts.cache) h['Cache-Control'] = opts.cache;
      rec.status = 200; rec.bytes = st.size;
      res.writeHead(200, h);
      fs.createReadStream(fp).pipe(res);
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port, reqs, state })));
}
