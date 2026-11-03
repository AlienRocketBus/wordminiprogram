/* test_review2_shell_v1166.mjs —— 复习 2.0 跑在「首页外壳」里、岛页在 iframe 里（接线后的真实形态）
 *
 * 为什么单独测：真机上首页 index.html 是外壳，岛页开在 iframe#islandFrame 里而且一直活着。
 *   复习 2.0 在外壳里改了账本，iframe 里岛页内存的 S 还是旧的；它下一次 save() 会把旧的错题 / 旧的计划
 *   冲回账本（账本吸收当前页是「以本页为准」）。复习 2.0 写完会把同源页面框也同步一遍，这里验证它。
 *
 * 做法：测试专用的外壳页（只在测试里由路由给出，不是仓库文件）：装账本、金币、词表、复习 2.0，
 *   里面一个 iframe 开真的食物岛。外壳里真手指点完复习，再在 iframe 里真玩法答题、刷新，核对账本和金币。
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const SHELL = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>shell</title>
<script src="hansen_coin_wallet.js?v=${VERSION}"></script><script src="vocab_all.js?v=${VERSION}"></script>
<script src="hansen_canonical_progress.js?v=${VERSION}"></script><script src="hansen_review2_words_v1166.js?v=${VERSION}"></script>
<script src="hansen_review2_v1166.js?v=${VERSION}"></script><script src="hansen_review2_ui_v1166.js?v=${VERSION}"></script></head>
<body style="margin:0;background:#0f172a"><div id="entry"></div><iframe id="islandFrame" src="island_food.html" style="width:390px;height:600px;border:0"></iframe></body></html>`;
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(VERSION); }
  if (p === '/__review2_shell_test.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(SHELL); }
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };

const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
await ctx.addInitScript(() => {
  try {
    if (window.top !== window || localStorage.getItem('__r2seed')) return;
    localStorage.clear(); localStorage.setItem('__r2seed', '1'); localStorage.setItem('hansen_onboarded', '1');
    const ymd = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    localStorage.setItem('wordIslandFood', JSON.stringify({ learned: [0], wrongs: { 0: 2 }, srs: { 0: { box: 1, due: ymd(0), last: ymd(-2) } }, mc: {}, stats: {}, totalAnswers: 9, totalCorrect: 5, lastSaveTime: Date.now() - 86400000, _hsnMasteryV942: 1 }));
    localStorage.setItem('hansen_review_wrong_since_v963', JSON.stringify({ 'food:0': ymd(-3) }));
  } catch (e) {}
});
const errs = [];
const page = await ctx.newPage();
page.on('pageerror', e => errs.push(String(e.stack || e.message).slice(0, 200)));
page.on('dialog', d => d.dismiss().catch(() => {}));
await page.goto(BASE + '__review2_shell_test.html', { waitUntil: 'domcontentloaded' });
const frame = () => page.frames().find(f => /island_food\.html/.test(f.url()));
await page.waitForFunction(() => { const w = document.getElementById('islandFrame').contentWindow; return !!(w && w.HansenCanonical && w.S && w.HansenReviewRewardsV963 && typeof w.markAnswer === 'function'); }, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const T = await page.evaluate(() => HansenReview2.today());
const led = () => page.evaluate(() => { const p = HansenCanonical.read().islands.food; return { w: p.wrongs[0] || 0, box: p.srs[0] ? p.srs[0].box : null }; });
const fS = () => frame().evaluate(() => ({ w: S.wrongs[0] || 0, box: S.srs[0] ? S.srs[0].box : null }));
const rc = () => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hansen_coin_awards_v942') || '{}')).filter(k => /^rvrw/.test(k)).sort());

console.log('\n▶ 外壳里复习，iframe 里的岛页同步');
ok((await fS()).w === 2 && (await fS()).box === 1, '开始：岛页内存 apple 错 2 次、盒1');
await page.evaluate(() => HansenReview2UI.mountEntry(document.getElementById('entry')));
ok(/今天复习 1 个词/.test(await page.evaluate(() => document.querySelector('.hr2-entry').textContent)), '首页入口按钮写着「今天复习 1 个词」');
const box = await page.evaluate(() => { const r = document.querySelector('.hr2-entry').getBoundingClientRect(); return r.height; });
ok(box >= 44, '入口按钮 ≥44px 高 (' + Math.round(box) + ')');
const w0 = await page.evaluate(() => HansenCoins.get());
await page.tap('.hr2-entry');
await page.waitForSelector('#hr2_root .hr2-opt, #hr2_root .hr2-tile');
const q = await page.evaluate(() => { const s = HansenReview2UI._state().session, q = HansenReview2.current(s); return { mode: q.mode, en: q.en, a: q.answerIndex, tiles: q.tiles }; });
if (q.mode === 'spell') { const used = new Set(); for (const c of q.en.replace(/[^a-z]/g, '')) { const i = q.tiles.findIndex((t, k) => t === c && !used.has(k)); used.add(i); await page.tap(`#hr2_root .hr2-tile[data-i="${i}"]`); } }
else await page.tap(`#hr2_root .hr2-opt[data-i="${q.a}"]`);
await page.waitForSelector('#hr2_main .hr2-stats', { timeout: 8000 });
const w1 = await page.evaluate(() => HansenCoins.get());
ok(w1 - w0 === 22, '外壳里答对：+2 纠错金（错题 2→1，没有毕业金）+20 全部清零（外壳里没有 v963，复习 2.0 按同一张收据自己发）(' + (w1 - w0) + ')');
ok(JSON.stringify(await led()) === JSON.stringify({ w: 1, box: 2 }), '账本：错 1 次、盒2 ' + JSON.stringify(await led()));
ok(JSON.stringify(await fS()) === JSON.stringify({ w: 1, box: 2 }), 'iframe 岛页内存 S 也同步成错 1 次、盒2 ' + JSON.stringify(await fS()));

console.log('\n▶ 岛页之后照常存盘、玩游戏，不会把复习结果冲掉，也不会重复给钱');
await frame().evaluate(() => { (window.save || window.__hsnSaveNow)(); window.__hsnSaveNow(); HansenCanonical.absorbCurrent(); });
await page.evaluate(() => HansenCanonical._dropCache());
ok(JSON.stringify(await led()) === JSON.stringify({ w: 1, box: 2 }), '岛页 save() 之后账本还是错 1 次、盒2 ' + JSON.stringify(await led()));
// 岛里真玩法答对 apple：错题 1→0（岛里的 v963 发 +2 纠错 c2 和隔天毕业金；复习 2.0 发过的 c1 不会再发）
const w2 = await page.evaluate(() => HansenCoins.get());
await frame().evaluate(() => markAnswer(0, true));
await page.waitForTimeout(300);
const w3 = await page.evaluate(() => HansenCoins.get()), r = await rc();
ok(JSON.stringify(r) === JSON.stringify([`rvrw:${T}:food:0:c1`, `rvrw:${T}:food:0:c2`, `rvrw:${T}:food:0:grad`, `rvrw:${T}:todaydone`].sort()), '收据：复习 c1、清零 todaydone、岛里 c2、毕业 grad 各一张 ' + JSON.stringify(r));
// iframe 里的 v963 刷新：清零那张收据已经有了，不会再发 +20
const w2b = await page.evaluate(() => HansenCoins.get());
await frame().evaluate(() => HansenReviewRewardsV963.refresh());
ok((await page.evaluate(() => HansenCoins.get())) === w2b, 'iframe 里 v963 刷新：+20 不会再发一次');
ok(w3 - w2 >= 17, '岛里答对：+2 纠错 +15 毕业（岛里答题本身另有 +1 答题金）(' + (w3 - w2) + ')');
ok((await led()).w === 0 && (await led()).box === 2, '账本：错题清零、计划还在盒2（不到期不升）' + JSON.stringify(await led()));
// 再刷新岛页
await frame().evaluate(() => location.reload());
await page.waitForFunction(() => { const w = document.getElementById('islandFrame').contentWindow; return !!(w && w.HansenCanonical && w.S && w.document.readyState !== 'loading'); }, null, { timeout: 30000 });
await page.waitForTimeout(1200);
ok(JSON.stringify(await fS()) === JSON.stringify({ w: 0, box: 2 }), '刷新岛页：内存 S 错题 0、盒2 ' + JSON.stringify(await fS()));
// 外壳再开复习：没有到期词，不会再给钱
const w4 = await page.evaluate(() => HansenCoins.get());
await page.evaluate(() => { HansenReview2UI.close(); HansenReview2UI.open(); });
await page.waitForSelector('#hr2_root .hr2-card');
ok(/今天没有要复习的词/.test(await page.evaluate(() => document.getElementById('hr2_main').innerText)), '外壳再开：今天没有要复习的词');
ok((await page.evaluate(() => HansenCoins.get())) === w4, '一分钱没多给');
const mine = errs.filter(e => /review2/i.test(e));
ok(mine.length === 0, '复习 2.0 没有页面报错' + (mine.length ? '：' + mine.join(' | ') : ''));

await browser.close(); srv.close();
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 全部通过');
process.exit(fails ? 1 : 0);
