/* test_bee_pause_v1165.mjs —— 拼写蜂点 ✕ 停下来时机器人也停；「继续比赛」后机器人不会变成两倍快
 *
 * 事故（v1163 审计 MG-08 / MISSED#8）：
 *   · 「🔊 听单词…」还没念完就点 ✕：退出确认框开着，单词念完照样开赛 —— 机器人在确认框后面一直打字、计时也在走；
 *   · 再点「继续比赛」：又开一条机器人计时器，两条一起跑，机器人快一倍。
 *
 * 合同（拼写蜂直接打开，听读音模式、高级词（7 个字母以上），机器人「中等」= 每分钟 50 个字母 → 每个字母 0.94~1.46 秒；单词录音晚 2.5 秒才到）：
 *   1. 听单词时点 ✕，确认框开 4.5 秒：机器人一个字母都没打、计时器不走
 *   2. 点「继续比赛」：机器人只有一条，相邻两个字母至少隔 0.9 秒
 *   3. 比赛中点 ✕，确认框开 4 秒：机器人不打字、计时器不走；继续后照常打
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
  const send = () => fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(d); });
  if (/^\/words\//.test(p)) setTimeout(send, 2500); else send();   // 单词录音晚到：「听单词」那一段够长
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
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'spelling_bee.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.renderBot === 'function' && window.S, null, { timeout: 30000 });
  /* 记下机器人每打一个字母的时间 */
  await page.evaluate(() => {
    S.mode = 'listen'; S.bot = 'mid'; S.manualNext = true; S.diff = 'adv';   // 7 个字母以上的词：机器人一个词要打 8 秒多，几段都在同一个词里
    const orig = window.renderBot; window.__bot = []; let last = 0;
    window.renderBot = function () { if (window.botProg > last) window.__bot.push(Date.now()); last = window.botProg; return orig.apply(this, arguments); };
  });
  const state = () => page.evaluate(() => ({ prog: window.botProg, timer: document.getElementById('timer').textContent, stt: document.getElementById('sttBot').textContent, confirm: document.getElementById('exitConfirm').classList.contains('on'), steps: window.__bot.slice() }));

  console.log('\n▶ 1. 听单词时点 ✕，确认框开 4.5 秒');
  await page.click('#startBtn');
  await page.waitForFunction(() => /听单词/.test(document.getElementById('sttBot').textContent), null, { timeout: 5000 }).catch(() => {});
  const s0 = await state();
  ok(/听单词/.test(s0.stt), `开赛前在「${s0.stt}」`);
  await page.click('#exitBtn');
  await sleep(300);
  const a = await state();
  await sleep(4500);
  const b = await state();
  ok(a.confirm && b.confirm, '退出确认框一直开着');
  ok(b.prog === a.prog && b.steps.length === a.steps.length, `确认框开着时机器人一个字母都没打（${a.prog} → ${b.prog}）`);
  ok(b.timer === a.timer, `确认框开着时计时器不走（${a.timer} → ${b.timer}）`);

  console.log('\n▶ 2. 点「继续比赛」');
  await page.click('#exitNo');
  const n0 = (await state()).steps.length;
  await sleep(4200);
  const c = await state();
  const steps = c.steps.slice(n0), gaps = steps.slice(1).map((t, i) => t - steps[i]);
  ok(steps.length >= 2, `继续后机器人照常打字（打了 ${steps.length} 个字母）`);
  ok(gaps.length >= 1 && Math.min(...gaps) >= 900, `机器人只有一条：相邻两个字母至少隔 0.9 秒（${gaps.join('、')} ms）`);

  console.log('\n▶ 3. 比赛中点 ✕，确认框开 4 秒');
  await page.click('#exitBtn');
  await sleep(300);
  const d = await state();
  await sleep(4000);
  const e = await state();
  ok(e.prog === d.prog && e.timer === d.timer, `比赛中停下：机器人不打字、计时器不走（${d.prog}/${d.timer} → ${e.prog}/${e.timer}）`);
  await page.click('#exitNo');
  await sleep(3000);
  const f = await state();
  ok(f.steps.length > e.steps.length, `继续后机器人接着打（${e.prog} → ${f.prog}）`);
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 拼写蜂停下时机器人也停，继续后不会变快');
process.exit(fails ? 1 : 0);
