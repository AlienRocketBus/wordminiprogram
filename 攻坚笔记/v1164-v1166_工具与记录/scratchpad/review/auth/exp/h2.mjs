/* helper: same as the repo harness but can serve an arbitrary root (e.g. the v1163 snapshot) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
export * from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
export async function startStaticAt(ROOT) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let p = decodeURIComponent(u.pathname);
    if (p === '/' || p.endsWith('/')) p += 'index.html';
    const fp = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.stat(fp, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('404'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-store' });
      fs.createReadStream(fp).pipe(res);
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  srv.origin = `http://127.0.0.1:${srv.address().port}`;
  return srv;
}
export const V1163 = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
export const REPO = '/home/user/wordminiprogram';
