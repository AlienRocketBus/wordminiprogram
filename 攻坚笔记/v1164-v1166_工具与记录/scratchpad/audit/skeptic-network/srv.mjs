// Skeptic's own static server with fault injection (independent of the auditor's).
// roots: [primary, ...fallbacks] — files missing in primary are served from the next root.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};
const GZ = new Set(['.html', '.htm', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt']);

export function start(roots, opts = {}) {
  const cfg = { roots: Array.isArray(roots) ? roots : [roots], version: null, rules: [], gzip: false, ...opts };
  const gzCache = new Map();
  let log = [];
  function resolveFile(p) {
    for (const r of cfg.roots) {
      const fp = path.join(r, path.normalize(p));
      if (!fp.startsWith(path.resolve(r))) return null;
      try { const st = fs.statSync(fp); if (st.isFile()) return { fp, st, root: r }; } catch (e) {}
    }
    return null;
  }
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const full = u.pathname + u.search;
    const e = { t: Date.now(), path: full, dest: req.headers['sec-fetch-dest'] || '', mode: req.headers['sec-fetch-mode'] || '', sw: req.headers['service-worker'] || '', purpose: req.headers['sec-purpose'] || req.headers['purpose'] || '', ref: (req.headers.referer || '').replace(/^https?:\/\/[^/]+/, '') };
    log.push(e);
    let rule = null;
    for (const r of cfg.rules) {
      if (!new RegExp(r.re).test(full)) continue;
      if (r.dest !== undefined && r.dest !== e.dest) continue;
      if (r.ref !== undefined && !new RegExp(r.ref).test(req.headers.referer || '')) continue;
      if (r.remaining !== undefined) { if (r.remaining <= 0) continue; r.remaining--; }
      rule = r; break;
    }
    if (rule) e.rule = rule.re;
    if (rule && rule.delayMs) await new Promise(r => setTimeout(r, rule.delayMs));
    if (rule && rule.drop) { req.socket.destroy(); e.status = 'drop'; return; }
    if (rule && rule.status) {
      e.status = rule.status;
      res.writeHead(rule.status, { 'content-type': rule.ctype || 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(rule.body || ('<h1>' + rule.status + ' fault</h1>'));
      return;
    }
    if (u.pathname === '/VERSION') {
      let v = cfg.version;
      if (v == null) { const f = resolveFile('/VERSION'); v = f ? fs.readFileSync(f.fp, 'utf8').trim() : ''; }
      e.status = 200;
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' });
      res.end(String(v));
      return;
    }
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = resolveFile(p);
    if (!f) { e.status = 404; res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); res.end('<h1>404 Not Found</h1>'); return; }
    const ext = path.extname(f.fp).toLowerCase();
    const etag = '"' + crypto.createHash('md5').update(f.fp + f.st.mtimeMs + f.st.size).digest('hex').slice(0, 16) + '"';
    const headers = { etag };
    const ct = (rule && rule.ctype !== undefined) ? rule.ctype : (MIME[ext] || 'application/octet-stream');
    if (ct !== '') headers['content-type'] = ct;
    if (rule && rule.dispo) headers['content-disposition'] = rule.dispo;
    headers['cache-control'] = /\.(mp3|webp|png|jpg|gif|svg|woff2)$/i.test(ext) ? 'max-age=3600' : 'no-cache';
    if (req.headers['if-none-match'] === etag && !rule) { e.status = 304; res.writeHead(304, headers); res.end(); return; }
    let body = fs.readFileSync(f.fp);
    const wantGz = cfg.gzip && GZ.has(ext) && /gzip/.test(req.headers['accept-encoding'] || '');
    if (wantGz) {
      const k = f.fp + ':' + f.st.mtimeMs;
      if (!gzCache.has(k)) gzCache.set(k, zlib.gzipSync(body, { level: 6 }));
      body = gzCache.get(k); headers['content-encoding'] = 'gzip'; headers['vary'] = 'Accept-Encoding';
    }
    e.status = 200; e.size = body.length;
    headers['content-length'] = body.length;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    if (rule && rule.rateBps) {
      let off = 0; const tick = 100; const chunk = Math.max(1, Math.round(rule.rateBps * tick / 1000));
      const iv = setInterval(() => {
        if (res.destroyed) { clearInterval(iv); return; }
        const part = body.subarray(off, off + chunk); off += part.length; res.write(part);
        if (off >= body.length) { clearInterval(iv); res.end(); e.doneMs = Date.now() - e.t; }
      }, tick);
      res.on('close', () => { clearInterval(iv); if (off < body.length) { e.aborted = off; e.abortedMs = Date.now() - e.t; } });
      return;
    }
    res.end(body);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    resolve({ server, port, cfg, origin: `http://127.0.0.1:${port}`,
      take: () => { const l = log; log = []; return l; }, peek: () => log.slice(),
      close: () => new Promise(r => { server.closeAllConnections && server.closeAllConnections(); server.close(() => r()); }) });
  }));
}
