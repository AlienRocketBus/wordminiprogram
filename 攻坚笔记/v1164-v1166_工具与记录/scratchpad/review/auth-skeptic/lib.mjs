/* skeptic helper: repo harness + serve any root (repo = v1164 tree, SNAP = v1163 snapshot) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
export * from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
export const REPO = '/home/user/wordminiprogram';
export const SNAP = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
/* hook(req,res,p) may return true to take over the response */
export async function serve(root, hook) {
  const log = [];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let p = decodeURIComponent(u.pathname);
    if (p === '/' || p.endsWith('/')) p += 'index.html';
    log.push({ t: Date.now(), p, q: u.search });
    if (hook && hook(req, res, p, u)) return;
    const fp = path.join(root, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!fp.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.stat(fp, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('404'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-store' });
      fs.createReadStream(fp).pipe(res);
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  srv.origin = `http://127.0.0.1:${srv.address().port}`;
  srv.reqlog = log;
  return srv;
}
export const ROOTSEL = () => (process.env.OLD ? SNAP : REPO);
