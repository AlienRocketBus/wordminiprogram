/* test_bee_result_pause_v1165.mjs —— 拼写蜂：一题刚结束（「你赢了」那 1.5 秒）点 ✕，下一题不会在确认框后面开赛
 *
 * 复查（v1165 第 2 轮 R2-SB1）：✕ 只在比赛进行中才停下。一题刚结束、自动跳下一题的计时还在走 —— 确认框开着，
 *   下一题照样念完开赛：孩子的计时在走、机器人在框后面把下一题拼完（8 秒后 scoreBot 0→1），「继续比赛」也不管用（没停过）。
 *   机器人赢了那一题（2.6 秒）、聚焦拼写蜂（finishFocused）一样。
 *
 * 合同（拼写蜂直接打开，汉译英模式（不用等读音）、机器人「中等」，默认自动跳下一题）：
 *   ① 拼对第一个词 → 300ms 内点 ✕，确认框开 8 秒：还是第 1 题、机器人一个字母都没打、计时器不走
 *   ② 点「继续比赛」：马上到第 2 题、正常开赛，机器人只有一条（相邻两个字母至少隔 0.9 秒）
 *   ③ 机器人赢下一题（孩子不拼）→ 结果出来马上点 ✕，开 6 秒：不跳题、不开赛；点「退出」回到设置页，之后也不再冒出下一题
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__seeded', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'spelling_bee.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.renderBot === 'function' && window.S && document.getElementById('startBtn'), null, { timeout: 30000 });
  await page.evaluate(() => {
    S.mode = 'cn'; S.bot = 'mid'; S.manualNext = false; S.diff = 'adv';   // 汉译英：中文一出来就开赛；高级词（7 个字母以上）
    const orig = window.renderBot; window.__bot = []; let last = 0;
    window.renderBot = function () { if (window.botProg > last) window.__bot.push(Date.now()); last = window.botProg; return orig.apply(this, arguments); };
  });
  const st = () => page.evaluate(() => ({ q: qIdx, over: raceOver, started: raceStarted, paused, botProg, scoreBot, scoreYou, target, timer: document.getElementById('timer').textContent,
    confirm: document.getElementById('exitConfirm').classList.contains('on'), res: document.getElementById('laneRes').classList.contains('on'), game: document.getElementById('game').classList.contains('on'), steps: window.__bot.length }));
  await page.click('#startBtn');
  await page.waitForFunction(() => !raceOver && raceStarted && typeof target === 'string' && target.length > 0, null, { timeout: 10000 });
  await sleep(300);

  console.log('\n▶ ① 拼对第一个词，结果一出来就点 ✕');
  const s0 = await st();
  for (const ch of s0.target) await page.locator(`#kb .key[data-k="${ch}"]`).first().tap();
  await page.waitForFunction(() => raceOver && document.getElementById('laneRes').classList.contains('on'), null, { timeout: 5000 });
  await sleep(150);
  await page.locator('#exitBtn').tap();
  await sleep(150);
  const a = await st();
  await sleep(8000);
  const b = await st();
  console.log('    点 ✕ 后：' + JSON.stringify(a) + '\n    8 秒后：' + JSON.stringify(b));
  ok(a.confirm && b.confirm, '确认框一直开着');
  ok(b.q === s0.q && b.q === a.q, `还停在第 ${a.q + 1} 题（8 秒后 qIdx ${a.q} → ${b.q}）`);
  ok(b.botProg === 0 && b.steps === a.steps && b.scoreBot === a.scoreBot, `机器人一个字母都没打（字母 ${a.steps} → ${b.steps}，机器人得分 ${a.scoreBot} → ${b.scoreBot}）`);
  ok(b.timer === a.timer, `计时器不走（${a.timer} → ${b.timer}）`);

  console.log('\n▶ ② 点「继续比赛」');
  await page.click('#exitNo');
  await sleep(300);
  const c = await st();
  ok(!c.confirm && c.q === s0.q + 1 && c.started && !c.over, `马上到第 ${c.q + 1} 题、开赛了（${JSON.stringify({ q: c.q, started: c.started, over: c.over })}）`);
  const n0 = (await st()).steps;
  await sleep(4200);
  const steps = await page.evaluate(() => window.__bot.slice());
  const mine = steps.slice(n0), gaps = mine.slice(1).map((t, i) => t - mine[i]);
  ok(mine.length >= 2 && Math.min(...gaps) >= 900, `机器人照常打、只有一条：打了 ${mine.length} 个字母，相邻至少隔 ${gaps.length ? Math.min(...gaps) : '-'}ms（≥ 900）`);

  console.log('\n▶ ③ 机器人赢下这一题，结果一出来就点 ✕，再点「退出」');
  await page.waitForFunction(() => raceOver && document.getElementById('laneRes').classList.contains('on'), null, { timeout: 30000 });
  await sleep(150);
  await page.locator('#exitBtn').tap();
  await sleep(150);
  const d = await st();
  await sleep(6000);
  const e = await st();
  ok(e.confirm && e.q === d.q && e.botProg === d.botProg && e.timer === d.timer, `确认框开着 6 秒：不跳题（${d.q} → ${e.q}）、不开赛（机器人 ${d.botProg} → ${e.botProg}，计时 ${d.timer} → ${e.timer}）`);
  await page.click('#exitYes');
  await sleep(4000);
  const f = await st();
  ok(!f.game && f.q === e.q, `点「退出」回到设置页，之后也没冒出下一题（比赛页 ${f.game}、qIdx ${e.q} → ${f.q}）`);
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 拼写蜂一题刚结束点 ✕ 也停下');
