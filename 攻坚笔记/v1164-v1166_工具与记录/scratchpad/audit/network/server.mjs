// Tiny static server with fault injection for SW / offline / update audits.
// Control: POST/GET /__ctl?json=<urlencoded JSON> merges into cfg; GET /__log returns + clears request log.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '': 'text/plain; charset=utf-8'
};

export function startServer(initialRoot, opts = {}) {
  const cfg = {
    root: initialRoot,
    version: null,          // null => read root/VERSION
    rules: [],              // [{re, delayMs, status, ctype, dispo, drop, body}]
    cacheMode: 'no-cache',  // 'no-cache' | 'heuristic' | 'none'
    ...opts
  };
  let log = [];
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/__ctl') {
      try {
        const j = JSON.parse(u.searchParams.get('json') || '{}');
        Object.assign(cfg, j);
      } catch (e) {}
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ...cfg }));
      return;
    }
    if (u.pathname === '/__log') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(log)); log = [];
      return;
    }
    const entry = { t: Date.now(), path: u.pathname + u.search, sw: req.headers['service-worker'] || '', dest: req.headers['sec-fetch-dest'] || '', mode: req.headers['sec-fetch-mode'] || '' };
    log.push(entry);
    const full = u.pathname + u.search;
    let rule = null;
    for (const r of cfg.rules) {
      if (!new RegExp(r.re).test(full)) continue;
      if (r.dest !== undefined && r.dest !== entry.dest) continue;
      if (r.remaining !== undefined) { if (r.remaining <= 0) continue; r.remaining--; }
      rule = r; break;
    }
    if (rule) entry.rule = rule.re;
    if (rule && rule.delayMs) await new Promise(r => setTimeout(r, rule.delayMs));
    if (rule && rule.drop) { req.socket.destroy(); entry.status = 'drop'; return; }
    if (rule && rule.status) {
      entry.status = rule.status;
      res.writeHead(rule.status, { 'content-type': rule.ctype || 'text/plain' });
      res.end(rule.body || ('fault ' + rule.status));
      return;
    }
    if (u.pathname === '/VERSION' && cfg.version != null) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' });
      res.end(String(cfg.version)); entry.status = 200; return;
    }
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const fp = path.join(cfg.root, path.normalize(p));
    if (!fp.startsWith(path.resolve(cfg.root))) { res.writeHead(403); res.end(); return; }
    let st;
    try { st = fs.statSync(fp); if (st.isDirectory()) throw new Error('dir'); } catch (e) {
      entry.status = 404;
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h1>404</h1>'); return;
    }
    const ext = path.extname(fp).toLowerCase();
    const etag = '"' + crypto.createHash('md5').update(cfg.root + fp + st.mtimeMs + st.size).digest('hex').slice(0, 16) + '"';
    const headers = { 'content-type': (rule && rule.ctype !== undefined) ? rule.ctype : (MIME[ext] || 'application/octet-stream'), etag };
    if (rule && rule.dispo) headers['content-disposition'] = rule.dispo;
    if (headers['content-type'] === '') delete headers['content-type'];
    if (cfg.cacheMode === 'no-cache') headers['cache-control'] = /\.(mp3|webp|png|jpg|gif|svg|woff2)$/i.test(ext) ? 'max-age=3600' : 'no-cache';
    else if (cfg.cacheMode === 'heuristic') headers['last-modified'] = new Date(st.mtimeMs).toUTCString();
    if (req.headers['if-none-match'] === etag && !(rule && rule.ctype !== undefined)) { entry.status = 304; res.writeHead(304, headers); res.end(); return; }
    entry.status = 200;
    // support Range for media
    const range = req.headers.range;
    if (range && /^bytes=/.test(range)) {
      const [a, b] = range.replace('bytes=', '').split('-');
      const start = Number(a) || 0; const end = b ? Number(b) : st.size - 1;
      headers['content-range'] = `bytes ${start}-${end}/${st.size}`;
      headers['accept-ranges'] = 'bytes';
      headers['content-length'] = end - start + 1;
      res.writeHead(206, headers);
      fs.createReadStream(fp, { start, end }).pipe(res);
      return;
    }
    headers['content-length'] = st.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    if (rule && rule.rateBps) {
      const buf = fs.readFileSync(fp); let off = 0; const chunk = Math.max(1, Math.round(rule.rateBps / 10));
      const iv = setInterval(() => {
        if (res.destroyed) { clearInterval(iv); entry.aborted = off; return; }
        const part = buf.subarray(off, off + chunk); off += part.length; res.write(part);
        if (off >= buf.length) { clearInterval(iv); res.end(); entry.doneMs = Date.now() - entry.t; }
      }, 100);
      res.on('close', () => { clearInterval(iv); if (off < buf.length) entry.aborted = off; });
      return;
    }
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    resolve({ server, port, cfg, origin: `http://127.0.0.1:${port}`,
      getLog: () => { const l = log; log = []; return l; }, peekLog: () => log.slice() });
  }));
}
