// 静态服务器：根目录 = 仓库根目录（样稿用相对路径引用游戏里的真字体/真图片）。端口写到 argv[2]。
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.jpg':'image/jpeg'};
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p)); if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(fp, (e, st) => { if (e || !st.isFile()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' }); fs.createReadStream(fp).pipe(res); });
});
srv.listen(0, '127.0.0.1', () => { fs.writeFileSync(process.argv[2], String(srv.address().port)); });
