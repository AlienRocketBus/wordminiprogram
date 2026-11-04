import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain'};
export const log = [];
export function start(opts={}){
  return new Promise(res=>{
    const srv = http.createServer((req,resp)=>{
      const u = new URL(req.url, 'http://x');
      let p = decodeURIComponent(u.pathname);
      log.push({t:Date.now(), url:req.url, p});
      if(p === '/VERSION'){ resp.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'}); resp.end(String(opts.version||globalThis.__VER||'1163')); return; }
      if(p.endsWith('/')) p += 'index.html';
      let fp = path.join(ROOT, path.normalize(p));
      if(opts.override && opts.override[p]) fp = opts.override[p]; // OVERRIDE
      if(!fp.startsWith(ROOT) && !(opts.override && opts.override[p])){ resp.writeHead(403); resp.end(); return; }
      fs.stat(fp,(err,st)=>{
        if(err || !st.isFile()){ resp.writeHead(404,{'Content-Type':'text/plain'}); resp.end('nf'); return; }
        const ext = path.extname(fp).toLowerCase();
        const h = {'Content-Type': MIME[ext]||'application/octet-stream','Content-Length':st.size};
        if(opts.cache) h['Cache-Control'] = opts.cache;
        resp.writeHead(200,h);
        fs.createReadStream(fp).pipe(resp);
      });
    });
    srv.listen(0,'127.0.0.1',()=>res({srv, port:srv.address().port}));
  });
}
