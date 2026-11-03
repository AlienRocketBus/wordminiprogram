/* test_land_map_bosses_v1165.mjs —— 单词大陆地图上的 Boss 名单和岛里一致（⑧星火火山口 5 位，全图 40 位）
 *
 * 事故（v1163 审计 P2-04）：land_map.html 的 MAP_GROUPS 里 ⑧号岛只列 4 个 Boss（岛里有 5 个，守关的是
 *   星核帝皇·弗沙欧），打 4 个就显示 4/4 ✓；全部通关的文案还写死「39 位 Boss」。
 *
 * 合同：
 *   静态：8 个岛，地图列出的 Boss 名字（顺序一致）== island_landN.html 里 BOSSES 的名字
 *   运行时：land8_prog=4 → ⑧号岛面板写「已击败 4/5」、岛点不是已通关；8 岛全通 → 女帝面板写「40 位 Boss」
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };

console.log('\n▶ 静态：地图名单 == 岛里的 BOSSES');
const lm = fs.readFileSync(path.join(ROOT, 'land_map.html'), 'utf8');
const mg = JSON.parse(lm.match(/window\.MAP_GROUPS=(\[[\s\S]*?\]);/)[1]);
let total = 0;
for (let n = 1; n <= 8; n++) {
  const src = fs.readFileSync(path.join(ROOT, `island_land${n}.html`), 'utf8');
  const at = src.indexOf('const BOSSES=[');
  const block = src.slice(at, src.indexOf('];', at));
  const names = [...block.matchAll(/name:'([^']+)'/g)].map(m => m[1]);
  const g = mg.find(x => x.id === n);
  total += names.length;
  ok(g && JSON.stringify(g.bosses) === JSON.stringify(names), `${n} 号岛：地图 ${g ? g.bosses.length : 0} 位 / 岛里 ${names.length} 位${g && JSON.stringify(g.bosses) !== JSON.stringify(names) ? '（地图：' + g.bosses.join('、') + '）' : ''}`);
}
ok(total === 40, `全大陆共 ${total} 位 Boss`);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
async function open(seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(seed => { try { localStorage.clear(); for (const k in seed) localStorage.setItem(k, seed[k]); } catch (e) {} }, seed);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await page.goto(BASE + 'land_map.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('button.spot').length >= 8, null, { timeout: 15000 });
  return { ctx, page, errs };
}
try {
  console.log('\n▶ 运行时：⑧号岛打了 4 个');
  {
    const { ctx, page, errs } = await open({ land8_prog: '4' });
    const r = await page.evaluate(() => {
      const spots = [...document.querySelectorAll('button.spot:not(#empress)')];
      const s8 = spots.find(s => /星火火山口/.test(s.getAttribute('aria-label') || ''));
      s8.click();
      return { done: s8.classList.contains('done'), label: s8.getAttribute('aria-label'), head: (document.querySelector('#pboss .bt') || {}).textContent || '',
        marks: [...document.querySelectorAll('#pboss .brow .bst')].map(x => x.textContent).join('') };
    });
    ok(!r.done, '⑧号岛点不是「已通关」');
    ok(/已击败 4\/5/.test(r.head), `面板写「已击败 4/5」（${r.head}）`);
    ok(r.marks === '✓✓✓✓▶', `前 4 个打钩、守关的还在等你（${r.marks}）`);
    ok(/5位Boss/.test(r.label), `读屏文字也是 5 位（${r.label}）`);
    ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
    await ctx.close();
  }
  console.log('\n▶ 运行时：8 岛全通');
  {
    const seed = {}; for (let n = 1; n <= 8; n++) { seed['hsn_landmap_cleared_' + n] = '1'; seed['land' + n + '_prog'] = '5'; }
    const { ctx, page, errs } = await open(seed);
    const txt = await page.evaluate(() => { document.getElementById('empress').click(); return document.getElementById('pwords').textContent; });
    ok(/40 位 Boss/.test(txt) && !/39 位/.test(txt), `女帝面板：「${txt.slice(0, 40)}…」`);
    ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
    await ctx.close();
  }
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 单词大陆地图 Boss 名单和岛里一致');
process.exit(fails ? 1 : 0);
