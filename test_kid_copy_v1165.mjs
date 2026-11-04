/* test_kid_copy_v1165.mjs —— 孩子看的界面上不再有开发术语（focused Bee、gem1、CPM、旧新词位、锁星）
 *
 * 事故（v1163 审计 VC-16 / TV-16 / OPT-6）：主题商店写「钻石来自 focused Bee 五星结晶、…gem1 成就；普通 Bee 的旧新词位里程碑已停用」，
 *   探索单词写「Bee 机器人 <50 CPM 需10次…锁1星」—— 7~10 岁的孩子看不懂。
 *
 * 合同（真岛页）：主题商店、探索单词总览、单词详情的可见文字里没有这些词；精确规则收在「规则」里，点开才看到（家长能查）；
 *   钻石不够时的提示也是孩子话。
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
const JARGON = /focused Bee|gem1|CPM|旧新词位|锁星/;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.HansenDiamondShop && typeof showScreen === 'function', null, { timeout: 30000 });
  await sleep(1500);
  await page.evaluate(() => { const b = document.querySelector('#alertModal.show .game-btn.gold'); if (b) b.click(); });

  console.log('\n▶ 主题商店');
  await page.evaluate(() => HansenDiamondShop.open());
  await sleep(600);
  let txt = await page.evaluate(() => (document.getElementById('diamondshopScreen') || document.body).innerText);
  ok(!JARGON.test(txt), `可见文字没有开发术语（${(txt.match(JARGON) || [''])[0] || '无'}）`);
  ok(/钻石怎么来/.test(txt), '写着「钻石怎么来」');
  const rulesShop = await page.evaluate(() => { const d = document.querySelector('#diamondshopScreen details.dia-rules'); if (!d) return null; d.querySelector('summary').click(); return d.open ? d.innerText : null; });
  ok(!!rulesShop && /聚焦拼写蜂/.test(rulesShop) && !JARGON.test(rulesShop), `点「规则」能看到精确来源（${(rulesShop || '').slice(0, 40)}…）`);
  // 钻石不够的提示（钱包 0 钻，直接买第一件）
  const toast = await page.evaluate(async () => { const b = [...document.querySelectorAll('#diamondshopScreen .dia-btn')].find(x => /💎|购买|买/.test(x.textContent) && !x.disabled); if (!b) return 'no-button'; b.click(); await new Promise(r => setTimeout(r, 300)); const t = document.querySelector('.dia-toast'); return t ? t.textContent : ''; });
  ok(toast !== '' && !JARGON.test(toast), `钻石不够的提示是孩子话（${toast.slice(0, 40)}）`);

  console.log('\n▶ 探索单词');
  await page.evaluate(() => { showScreen('explore'); try { renderExplore && renderExplore(); } catch (e) {} });
  await sleep(800);
  txt = await page.evaluate(() => document.getElementById('exploreScreen').innerText);
  ok(!JARGON.test(txt), `总览可见文字没有开发术语（${(txt.match(JARGON) || [''])[0] || '无'}）`);
  await page.evaluate(() => { const c = document.querySelector('#exploreScreen .exp-card'); if (c) c.click(); });
  await sleep(800);
  txt = await page.evaluate(() => { const p = document.getElementById('hxpWordProgress'); return p ? p.innerText : ''; });
  ok(txt.length > 0 && !JARGON.test(txt), `单词详情可见文字没有开发术语（${(txt.match(JARGON) || [''])[0] || '无'}）`);
  const rulesExp = await page.evaluate(() => { const d = document.querySelector('#hxpWordProgress details.hxp-rules') || document.querySelector('#exploreScreen details.hxp-rules'); if (!d) return null; d.querySelector('summary').click(); return d.open ? d.innerText : null; });
  ok(!!rulesExp && /赢 10 次/.test(rulesExp), `点「规则」能看到机器人速度和次数（${(rulesExp || '').slice(0, 40)}…）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 孩子看的界面没有开发术语');
process.exit(fails ? 1 : 0);
