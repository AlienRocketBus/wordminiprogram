// 主题 2.0 测试小工具：本地静态服务（MIME 正确、/VERSION 有值、外网一律拦）+ 浏览器 + 按规律找文件。
// 文件名里不写版本号：批量升版时不会被误改。
import fs from 'node:fs';
import http from 'node:http';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/* 按规律找唯一文件，比如 /^hansen_fx_v\d{4}\.js$/ */
export function findOne(re) {
  const f = fs.readdirSync(ROOT).filter(n => re.test(n)).sort();
  if (f.length !== 1) throw new Error(`应该正好有 1 个 ${re}，实际 ${f.length}: ${f.join(',')}`);
  return f[0];
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

/* pages: { '/__t2/xxx.html': '<html>…' } 测试自己拼的页面 */
export async function serve(pages = {}) {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (pages[u] != null) { res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' }); return res.end(pages[u]); }
    if (u === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(fs.readFileSync(path.join(ROOT, 'VERSION'))); }
    const f = path.join(ROOT, u.replace(/^\/+/, ''));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

/* 没设 HANSEN_PLAYWRIGHT_MODULE 时，自动去全局 npm 目录找（沙盒里 Playwright 装在那） */
function ensurePlaywrightEnv() {
  if (process.env.HANSEN_PLAYWRIGHT_MODULE) return;
  const cands = [];
  try { cands.push(path.join(execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(), 'playwright/index.mjs')); } catch (e) {}
  cands.push('/opt/node22/lib/node_modules/playwright/index.mjs', '/usr/local/lib/node_modules/playwright/index.mjs', '/usr/lib/node_modules/playwright/index.mjs');
  const hit = cands.find(p => p && fs.existsSync(p));
  if (hit) process.env.HANSEN_PLAYWRIGHT_MODULE = hit;
}
export async function browser() {
  ensurePlaywrightEnv();
  const { chromium } = await import(pathToFileURL(path.join(ROOT, 'playwright_loader.mjs')).href);
  return chromium.launch({ args: ['--no-sandbox', '--font-render-hinting=none'] });
}

/* 手机环境：390×844、触屏、外网全拦、SW 关 */
export async function phone(br, base, opts = {}) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference' });
  await ctx.route(/^(?!http:\/\/127\.0\.0\.1)/, r => r.abort());
  return ctx;
}

/* 简单计分 */
export function scorer(title) {
  let pass = 0, fail = 0; const fails = [];
  return {
    ok(cond, name, info) { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; fails.push(name); console.log('  ❌ ' + name + (info !== undefined ? '  → ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 600) : '')); } },
    done() { console.log(`\n${title}：${pass} 通过 / ${fail} 失败`); if (fail) console.log('失败项：' + fails.join('；')); return fail; }
  };
}
