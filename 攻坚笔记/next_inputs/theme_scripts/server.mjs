import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
// Static server: serves ROOT (snapshot) and, under /__mock/, the mockups dir. OS-assigned port written to PORTFILE.
const ROOT = path.resolve(process.argv[2]);
const PORTFILE = process.argv[3];
const MOCK = path.resolve(process.argv[4] || ROOT);
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.ogg':'audio/ogg','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const srv = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200,{'content-type':'text/plain','cache-control':'no-store'}); return res.end('1163'); }
  let base = ROOT;
  if (p.startsWith('/__mock/')) { base = MOCK; p = p.slice('/__mock'.length); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(base, path.normalize(p));
  if (!fp.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.stat(fp,(e,st)=>{
    if (e || !st.isFile()) { res.writeHead(404,{'content-type':'text/plain'}); return res.end('nf'); }
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200,{'content-type': MIME[ext]||'application/octet-stream','cache-control':'no-cache','content-length':st.size});
    fs.createReadStream(fp).pipe(res);
  });
});
srv.listen(0,'127.0.0.1',()=>{ fs.writeFileSync(PORTFILE,String(srv.address().port)); });
