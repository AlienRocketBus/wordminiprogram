import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const ROOT = process.argv[2];
const PORTFILE = process.argv[3];
const GZ = process.argv[4] !== 'nogz';
const CC = process.argv[5] === 'cache' ? 'public, max-age=86400' : 'no-cache';
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.ogg':'audio/ogg','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const TEXT = new Set(['.html','.js','.mjs','.css','.json','.svg','.webmanifest']);
const cache = new Map();
const srv = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200,{'content-type':'text/plain','cache-control':'no-store'}); return res.end('1163'); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(fp,(e,st)=>{
    if (e || !st.isFile()) { res.writeHead(404,{'content-type':'text/plain'}); return res.end('nf'); }
    const ext = path.extname(fp).toLowerCase();
    const h = {'content-type': MIME[ext]||'application/octet-stream','cache-control':CC,'last-modified':st.mtime.toUTCString()};
    if (GZ && TEXT.has(ext) && /gzip/.test(req.headers['accept-encoding']||'')) {
      let ck = fp + ":" + st.mtimeMs; let buf = cache.get(ck); if (!buf) { buf = zlib.gzipSync(fs.readFileSync(fp), {level:6}); cache.set(ck, buf); }
      res.writeHead(200,{...h,'content-encoding':'gzip','content-length':buf.length,'vary':'accept-encoding'}); return res.end(buf);
    }
    const range = req.headers.range;
    if (range && /^bytes=\d*-\d*$/.test(range)) {
      let [a,b] = range.slice(6).split('-'); a = a?+a:0; b = b?+b:st.size-1;
      res.writeHead(206,{...h,'content-length':b-a+1,'content-range':`bytes ${a}-${b}/${st.size}`,'accept-ranges':'bytes'});
      return fs.createReadStream(fp,{start:a,end:b}).pipe(res);
    }
    res.writeHead(200,{...h,'content-length':st.size,'accept-ranges':'bytes'}); fs.createReadStream(fp).pipe(res);
  });
});
srv.listen(0,'127.0.0.1',()=>{ fs.writeFileSync(PORTFILE,String(srv.address().port)); });
