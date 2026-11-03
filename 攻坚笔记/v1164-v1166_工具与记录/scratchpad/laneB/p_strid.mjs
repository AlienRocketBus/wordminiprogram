import { chromium } from '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt/playwright_loader.mjs';
import http from 'node:http';
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<html><body>x</body></html>'); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto(`http://127.0.0.1:${srv.address().port}/`);
const r = await p.evaluate(() => {
  const big = JSON.stringify({ a: Array.from({ length: 9000 }, (_, i) => ({ k: i, v: 'x' + i })) });
  localStorage.setItem('k', big);
  const T = (fn, n = 2000) => { const t0 = performance.now(); let z = 0; for (let i = 0; i < n; i++) z += fn() ? 1 : 0; return +((performance.now() - t0) / n * 1000).toFixed(2) + 'us'; };
  const g1 = localStorage.getItem('k');
  return {
    len: big.length,
    getItem: T(() => localStorage.getItem('k').length > 0),
    sameObjCompare: T(() => localStorage.getItem('k') === g1),
    vsStringify: T(() => localStorage.getItem('k') === big),
    twoGets: T(() => localStorage.getItem('k') === localStorage.getItem('k')),
    parse: T(() => !!JSON.parse(big), 200),
    sc: T(() => !!structuredClone(JSON.parse(big)), 100),
  };
});
console.log(r);
await b.close(); srv.close();
