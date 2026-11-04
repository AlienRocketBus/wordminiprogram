/* skeptic helper (session-auth, round 1): repo harness + emulator from the v1164 snapshot (cur),
 * static files served from either the v1164 snapshot (cur) or the v1163 snapshot (old, = 73e1b69). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
export * from '../cur/cloudbase_e2e_harness.mjs';
import * as H from '../cur/cloudbase_e2e_harness.mjs';

export const BASE = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/session-auth-sk1';
export const CUR = BASE + '/cur';
export const OLD = BASE + '/old';
export const ROOTSEL = process.env.OLD ? OLD : CUR;
export const VER = process.env.OLD ? 'v1163' : 'v1164';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
/* static server over an arbitrary root; hook(req,res)->true to take over a request (fault injection on static files) */
export async function serve(root, hook) {
  const hits = [];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    hits.push(u.pathname + u.search);
    if (hook && hook(req, res, u)) return;
    let p = decodeURIComponent(u.pathname);
    if (p === '/' || p.endsWith('/')) p += 'index.html';
    const fp = path.join(root, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!fp.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.stat(fp, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('404'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-store' });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(fp).pipe(res);
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  srv.origin = `http://127.0.0.1:${srv.address().port}`;
  srv.hits = hits;
  return srv;
}

export const PK_READY = () => !!(window.HansenAuth && window.HansenPkRecord && window.HansenCloudSave && window.HANSEN_VOCAB_ALL);
export const INDEX_READY = () => !!(window.HansenAuth && document.getElementById('islandFrame'));

/* write local learned words for a fake island key + a few ladder records */
export async function seedProgress(ph, { key = 'wordIsland_kidX', learned = 5, wins = 0 } = {}) {
  return ph.eval(([k, n, w]) => {
    localStorage.setItem(k, JSON.stringify({ learned: Array.from({ length: n }, (_, i) => i + 1) }));
    for (let i = 0; i < w; i++) window.HansenPkRecord && HansenPkRecord.record({ result: 'win', mode: 'A', oppRating: 1000, words: 10, correct: 9 });
    return true;
  }, [key, learned, wins]);
}
export async function kidState(ph, key = 'wordIsland_kidX') {
  return ph.eval((k) => {
    const w = JSON.parse(localStorage.getItem(k) || '{}');
    const s = window.HansenPkRecord ? HansenPkRecord.summary() : null;
    const lc = window.HansenAuth ? HansenAuth.readLocal() : null;
    return { signed: !!(window.HansenAuth && HansenAuth.isSignedIn()), uid: lc && lc.uid, method: lc && lc.method,
      learned: (w.learned || []).length, wins: s && s.wins, total: s && s.total, rating: s && s.rating,
      owner143: localStorage.getItem('hansen_local_progress_owner_v1143'), pkOwner: localStorage.getItem('hansen_pk_record_owner_v1156') };
  }, key);
}
export function out(obj) { console.log(JSON.stringify(obj, null, 2)); }
export { H };
