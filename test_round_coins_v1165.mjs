/* test_round_coins_v1165.mjs —— 结算页的「🪙 金币 +N」等于这一局钱包里真正多出来的
 *
 * v1163：结算页只数「答对给的金币」，连胜奖励（连对 5 / 10 / 20… 题）直接进钱包却不算进来；
 *        同一批词一天最多给 3 次金币，第 4 局起结算写「+0」，钱包却因为连胜奖励在涨，孩子也不知道为什么是 0。
 * 合同（island_job 听音辨义初级，连玩 4 局、题题答对，真点）：
 *   ① 每一局结算写的金币数 = 这一局开始到结束钱包的变化；有连胜奖励时写出「含连胜奖励 +X」
 *   ② 第 4 局（这些词今天的金币已领满）写「今天这些词的金币领满啦，换个难度或明天再来～」
 *   ③ 难度卡上写「最多 +N」
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
async function newCtx(vp = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true });
  await ctx.addInitScript(() => { try { if (window.top === window && !sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  return ctx;
}
async function open(ctx, file, ready = "typeof showScreen === 'function'") {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(new Function("return document.readyState !== 'loading' && " + ready), null, { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} });
  return { page, errs };
}

try {
  const ctx = await newCtx();
  const { page, errs } = await open(ctx, 'island_job.html', "typeof startListen === 'function' && window.HansenCoins");
  await page.evaluate(() => { window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); }; showScreen('home'); });
  await page.locator('#homeScreen .mode-card[onclick="startListen()"]').first().tap();
  await page.waitForTimeout(300);
  const card = await page.evaluate(() => (document.querySelector('#listenContent [onclick^="startListenLevel"]') || {}).textContent || '');
  const anyCard = await page.evaluate(() => { startMoles(); const t = document.getElementById('molesContent').textContent; startListen(); return t; });
  ok(/最多 \+\d+/.test(anyCard), '③ 难度卡写「最多 +N」 ' + (anyCard.match(/🪙金币[^·]*/) || [''])[0]);
  const rounds = [];
  for (let round = 1; round <= 4; round++) {
    const w0 = await page.evaluate(() => HansenCoins.get());
    await page.locator('#listenContent [onclick^="startListenLevel"]', { hasText: '初级' }).first().tap();
    for (let k = 0; k < 80; k++) {
      const st = await page.evaluate(() => ({ active: listenActive, ready: !!(listenQ && !listenQ.answered && document.querySelectorAll('#listenScreen .listen-opts .boss-opt').length === 4), lesson: !!document.getElementById('hml_lesson') }));
      if (!st.active) break;
      if (st.lesson) { await page.locator('#hml_lesson').tap().catch(() => {}); await page.waitForTimeout(300); continue; }
      if (st.ready) { const i = await page.evaluate(() => listenQ.opts.findIndex(o => o.cn === listenQ.word.cn)); await page.locator('#listenScreen .listen-opts .boss-opt').nth(i).tap(); await page.waitForTimeout(1300); }
      else await page.waitForTimeout(200);
    }
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({ w: HansenCoins.get(), txt: (document.getElementById('listenContent').textContent || '').replace(/\s+/g, ' ') }));
    const m = r.txt.match(/🪙 金币 \+(\d+)(（含连胜奖励 \+(\d+)）)?/);
    rounds.push({ round, delta: r.w - w0, shown: m ? +m[1] : null, streak: m && m[3] ? +m[3] : 0, capped: /今天这些词的金币领满啦，换个难度或明天再来/.test(r.txt) });
    // 回到难度选择，接着下一局
    await page.evaluate(() => startListen());
    await page.waitForTimeout(300);
  }
  console.log('     ' + JSON.stringify(rounds));
  for (const x of rounds) ok(x.shown === x.delta, `① 第 ${x.round} 局：结算写 +${x.shown}${x.streak ? '（含连胜奖励 +' + x.streak + '）' : ''}，钱包实际 +${x.delta}`);
  ok(rounds.some(x => x.streak > 0), '① 连对时的连胜奖励写出来了');
  ok(rounds[3].capped && !rounds[0].capped, '② 第 4 局（今天这些词的金币已领满）告诉孩子为什么');
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 结算金币等于钱包实际变化');
