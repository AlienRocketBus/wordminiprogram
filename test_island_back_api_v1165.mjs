/* test_island_back_api_v1165.mjs —— 手机「返回」只退一步 + 岛被藏起来时游戏和声音要停
 *
 * 以前（v1163）：
 *   · 岛页没有任何「返回一步」的接口，外壳只能整岛关掉 → 孩子在游戏里按手机返回，直接回到首页地图；
 *   · 岛被藏起来（回首页）时，打地鼠还在读单词、极速60秒还在倒计时（声音从首页冒出来）。
 *
 * 合同（外壳 index.html 会调用这两个函数）：
 *   __hsnIslandBack()  ：先关模块登记的浮层（__hsnBackStack，返回 false 的跳过）→ 关弹窗 → 从游戏回本岛主页 → 返回 true；
 *                        已在本岛主页、没东西可关 → 返回 false（交给外壳退出这个岛）。
 *   __hsnIslandHidden()：停掉正在进行的游戏（回本岛主页）、停掉所有声音。
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

async function openIsland(file) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.addInitScript(() => {
    try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {}
    // 记下所有出声：mp3 播放 + 手机朗读
    window.__sounds = [];
    const P = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { try { window.__sounds.push({ t: Date.now(), src: String(this.src || '').split('/').pop() }); } catch (e) {} return P.apply(this, arguments); };
    try { const S0 = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = function (u) { window.__sounds.push({ t: Date.now(), tts: u && u.text }); return S0(u); }; } catch (e) {}
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof showScreen === 'function' && typeof startListen === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { try { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); } catch (e) {} });
  await page.waitForTimeout(300);
  return { ctx, page, errs };
}
const active = page => page.evaluate(() => (document.querySelector('.screen.active') || {}).id || '');

try {
  for (const file of ['island_animal.html', 'island_land1.html']) {
    console.log(`\n▶ ${file}`);
    const { ctx, page, errs } = await openIsland(file);
    const api = await page.evaluate(() => ({ back: typeof window.__hsnIslandBack, hidden: typeof window.__hsnIslandHidden, stack: Array.isArray(window.__hsnBackStack) }));
    ok(api.back === 'function' && api.hidden === 'function' && api.stack, '岛页提供 __hsnIslandBack / __hsnIslandHidden / __hsnBackStack ' + JSON.stringify(api));
    if (api.back !== 'function') { await ctx.close(); continue; }

    // ① 在本岛主页：没东西可关 → false（交给外壳退出这个岛）
    ok(await active(page) === 'homeScreen', '开始在本岛主页');
    ok(await page.evaluate(() => window.__hsnIslandBack()) === false, '① 本岛主页按返回 → false（外壳去退岛）');

    // ② 真点「听音辨义」卡片进游戏 → 返回 → 回本岛主页
    await page.locator('.mode-card', { hasText: '听音辨义' }).first().tap();
    await page.waitForTimeout(400);
    ok(await active(page) === 'listenScreen', '② 点卡片进了听音辨义');
    const r2 = await page.evaluate(() => window.__hsnIslandBack());
    await page.waitForTimeout(200);
    ok(r2 === true && await active(page) === 'homeScreen', `② 游戏里按返回 → true，回到本岛主页 (${r2}, ${await active(page)})`);

    // ③ 模块登记的浮层先关；关完就撤掉登记；返回 false 的关闭函数跳过
    const r3 = await page.evaluate(() => {
      const calls = [];
      const n0 = window.__hsnBackStack.length;
      window.__hsnPushBack(() => { calls.push('A'); });
      window.__hsnPushBack(() => { calls.push('B-已关'); return false; });
      showScreen('explore');
      const first = window.__hsnIslandBack();           // B 返回 false → 跳过 → A 关闭 → true
      const scr1 = (document.querySelector('.screen.active') || {}).id;
      const second = window.__hsnIslandBack();          // 登记都用完了 → 从探索单词回主页
      const scr2 = (document.querySelector('.screen.active') || {}).id;
      const undo = window.__hsnPushBack(() => { calls.push('C'); });
      undo();                                           // 撤销登记后不会被调用
      const third = window.__hsnIslandBack();           // 主页、没登记 → false
      return { calls, first, scr1, second, scr2, third, left: window.__hsnBackStack.length - n0 };
    });
    ok(r3.first === true && r3.scr1 === 'exploreScreen' && r3.calls.join(',') === 'B-已关,A', '③ 先调登记的关闭函数（后进先出，返回 false 的跳过），屏幕不动 ' + JSON.stringify(r3));
    ok(r3.second === true && r3.scr2 === 'homeScreen', '③ 登记用完后再按返回：从探索单词回主页');
    ok(r3.third === false && r3.left === 0 && !r3.calls.includes('C'), '③ 登记调用后已移除、撤销登记的不会被调用');

    // ④ 弹窗开着 → 先关弹窗
    const r4 = await page.evaluate(() => {
      showStreakInfo();
      const shown = document.getElementById('alertModal').classList.contains('show');
      const r = window.__hsnIslandBack();
      return { shown, r, still: document.getElementById('alertModal').classList.contains('show'), scr: (document.querySelector('.screen.active') || {}).id };
    });
    ok(r4.shown && r4.r === true && !r4.still && r4.scr === 'homeScreen', '④ 弹窗开着按返回 → 关掉弹窗 ' + JSON.stringify(r4));

    // ⑤ 岛被藏起来：打地鼠停下、12 秒内不再出声
    const r5a = await page.evaluate(async () => {
      startMoles(); startMolesLevel(Object.keys(MOLES_LEVELS).find(k => [...Array(allW.length).keys()].some(MOLES_LEVELS[k].filter)));
      await new Promise(r => setTimeout(r, 1500));
      const before = { active: molesActive, scr: (document.querySelector('.screen.active') || {}).id };
      window.__hsnIslandHidden();
      window.__sounds.length = 0; window.__mark = Date.now();
      return { before, after: { active: molesActive, scr: (document.querySelector('.screen.active') || {}).id } };
    });
    ok(r5a.before.active && r5a.before.scr === 'molesScreen', '⑤ 打地鼠开始了');
    ok(!r5a.after.active && r5a.after.scr === 'homeScreen', '⑤ 藏起来 → 打地鼠停了，回本岛主页 ' + JSON.stringify(r5a.after));
    await page.waitForTimeout(12000);
    const snd5 = await page.evaluate(() => window.__sounds.slice());
    ok(snd5.length === 0, '⑤ 藏起来后 12 秒没有任何声音 ' + JSON.stringify(snd5).slice(0, 200));

    // ⑥ 极速60秒：藏起来 → 倒计时停
    const r6 = await page.evaluate(async () => {
      startSpeed(); startSpeedLevel('easy');
      await new Promise(r => setTimeout(r, 2200));
      const t1 = spTime, a1 = spActive;
      window.__hsnIslandHidden(); window.__sounds.length = 0;
      await new Promise(r => setTimeout(r, 3200));
      return { a1, t1, a2: spActive, t2: spTime, timer: spTimer, scr: (document.querySelector('.screen.active') || {}).id, sounds: window.__sounds.length };
    });
    ok(r6.a1 && !r6.a2 && r6.timer === null && r6.t2 === r6.t1 && r6.scr === 'homeScreen' && r6.sounds === 0, '⑥ 极速60秒藏起来 → 停表、不再出题出声 ' + JSON.stringify(r6));

    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 岛页「返回一步」和「藏起来就停」：两个接口在常规岛和单词大陆都可用');
