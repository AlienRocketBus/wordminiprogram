/* test_boss_settings_slow_v1165.mjs —— 网慢时打开设置页，不再为「Boss 特效调节」这一行下 3MB
 *
 * 复查（v1165 第 1 轮 SH5，即优化清单 (c)）：设置页一打开，Boss 管理入口桥就加载整个 1.2MB 的 Boss 引擎，
 *   只为画「🔒 Boss 特效调节 · 通关全部 boss 解锁 x/360」这一行；引擎一执行又预下约 20 张攻击图。
 *   3G 实测：打开设置 15 秒下了 3.2MB（30 个请求）。孩子只想调个音量。
 *
 * 合同（island_animal；网络报 3G；动物岛已打赢 Lv1、Lv2）：
 *   ① 打开设置页：「Boss 特效调节」这一行照样有，写着「通关全部 boss 解锁 2/360」；引擎没加载、引擎文件和攻击图一个都没下
 *   ② 真点这一行：这时才加载引擎，弹出和以前一样的「Boss 特效调节 · 尚未解锁」提示；
 *      换成引擎自己画的那一行，文字和轻量行一字不差（两份进度算法对得上）
 *   ③ 快网（4G）照旧：打开设置页马上加载引擎、画引擎自己的那一行（见 test_boss_lazy_v1165 L3）
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
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
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
const SPRITE = /bosses\/(?:mechfist_real|sunball_real|chaoswave_real|alienbeam_real|vfang_|shuriken|hammer_real|rexclaw_|rexjaw_|zb_|zf_|tl_bolt)|bossfx\//;

async function tap(page, selector) {
  await page.evaluate(sel => { const el = document.querySelector(sel); if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' }); }, selector);
  await page.waitForTimeout(250);
  const p = await page.evaluate(sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, hit: !!hit && (hit === el || el.contains(hit)) }; }, selector);
  if (!p) return false;
  await page.touchscreen.tap(p.x, p.y);
  return p.hit;
}

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('__s')) {
        localStorage.clear(); localStorage.setItem('hansen_onboarded', '1');
        sessionStorage.setItem('__s', '1');
      }
    } catch (e) {}
    /* 网络报 3G（和 test_preload_budget_v1165 的 P6 一样） */
    const c = { effectiveType: '3g', saveData: false, downlink: 1.2, rtt: 300, addEventListener() {}, removeEventListener() {} };
    try { Object.defineProperty(Navigator.prototype, 'connection', { get: () => c, configurable: true }); } catch (e) {}
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const reqs = []; page.on('request', r => reqs.push(r.url().replace(BASE, '')));
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.startBoss === 'function' && typeof window.__hansenBossFXReady === 'function' && document.readyState === 'complete' && window.S, null, { timeout: 30000 });
  await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) { b.click(); return true; } return false; }, null, { timeout: 2500, polling: 100 }).catch(() => {});
  /* 动物岛已打赢 Lv1、Lv2（进度 2/360） */
  await page.evaluate(() => { S.bossWins = Object.assign({}, S.bossWins || {}, { 1: 1, 2: 1 }); save(); });
  await page.waitForTimeout(1500);

  console.log('\n▶ ① 3G 打开设置页');
  const n0 = reqs.length;
  ok(await tap(page, '.util-card[onclick*="settings"]'), '真点「设置」');
  await page.waitForTimeout(5000);
  const st = await page.evaluate(() => { const e = document.getElementById('hbafxEntry'); return { loaded: !!window.__hansenBossFXLoaded, scriptTag: !!document.querySelector('script[src*="hansen_boss_attack"]'), entry: e ? e.textContent.replace(/\s+/g, ' ').trim() : '', stub: !!(e && e.hasAttribute('data-hsn-stub')) }; });
  const got = reqs.slice(n0);
  console.log('     ' + JSON.stringify({ ...st, reqs: got.length, engineReq: got.filter(u => /hansen_boss_attack/.test(u)).length, sprites: got.filter(u => SPRITE.test(u)).length }));
  ok(/Boss 特效调节/.test(st.entry) && /2\/360/.test(st.entry), `「Boss 特效调节」这一行照样有：「${st.entry}」`);
  ok(!st.loaded && !st.scriptTag, `引擎没加载（loaded=${st.loaded} script=${st.scriptTag}）`);
  ok(!got.some(u => /hansen_boss_attack/.test(u)) && !got.some(u => SPRITE.test(u)), `引擎文件、攻击图一个都没下（引擎 ${got.filter(u => /hansen_boss_attack/.test(u)).length}、攻击图 ${got.filter(u => SPRITE.test(u)).length}）`);

  console.log('\n▶ ② 真点这一行');
  const before = st.entry;
  ok(await tap(page, '#hbafxEntry'), '真点「Boss 特效调节」');
  await page.waitForFunction(() => !!window.__hansenBossFXLoaded && document.getElementById('hbafx-ovl'), null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(600);
  const st2 = await page.evaluate(() => { const e = document.getElementById('hbafxEntry'), o = document.getElementById('hbafx-ovl'); return { loaded: !!window.__hansenBossFXLoaded, tip: o ? o.textContent.replace(/\s+/g, ' ').trim() : '', entry: e ? e.textContent.replace(/\s+/g, ' ').trim() : '', stub: !!(e && e.hasAttribute('data-hsn-stub')), n: document.querySelectorAll('#hbafxEntry').length }; });
  console.log('     ' + JSON.stringify(st2));
  ok(st2.loaded, '点了以后才加载引擎');
  ok(/Boss 特效调节 · 尚未解锁/.test(st2.tip) && /2\s*\/\s*360/.test(st2.tip), `弹出和以前一样的未解锁提示（「${st2.tip.slice(0, 40)}」）`);
  /* 关掉提示，看引擎自己画的那一行 */
  await page.evaluate(() => { const o = document.getElementById('hbafx-ovl'); if (o) o.remove(); });
  const real = await page.evaluate(() => { const e = document.getElementById('hbafxEntry'); return { txt: e ? e.textContent.replace(/\s+/g, ' ').trim() : '', stub: !!(e && e.hasAttribute('data-hsn-stub')), n: document.querySelectorAll('#hbafxEntry').length }; });
  ok(!real.stub && real.n === 1, `换成了引擎自己的那一行（只有 ${real.n} 行）`);
  ok(real.txt === before, `两行文字一字不差（轻量行「${before}」 / 引擎「${real.txt}」）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 网慢时打开设置页不再下 Boss 引擎和攻击图；点了才加载');
process.exit(fails ? 1 : 0);
