/* test_narrow_fit_v1165.mjs —— 窄屏手机上显示完整：打地鼠长中文、打字键盘底排、泡泡不出界
 *
 * v1163（390×844 和 360×640 实测）：
 *   · 打地鼠的中文只许一行、超出就「…」：「多少（钱/…」「多少（可…」—— how much / how many 分不清；
 *   · 360×640 打字大师键盘最下面一排在屏幕外 2px（页面锁着滚不下去）；
 *   · 泡泡右边界一律 80%，窄屏上大泡泡有一截在外面；「grandmother」比泡泡还宽。
 * 合同：
 *   ① island_question 打地鼠高级（390 和 360 宽）：每个词当目标时 9 张卡的中文都完整显示、没有被截断、不出卡片
 *   ② 360×640 打字大师高级：最下面一排键的底边 ≤ 640
 *   ③ 360×640 island_family 泡泡高级：飘 4 秒，每个泡泡都在泡泡区里、单词不比泡泡宽
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
  for (const w of [390, 360]) {
    const ctx = await newCtx({ width: w, height: w === 360 ? 640 : 844 });
    const { page, errs } = await open(ctx, 'island_question.html', "typeof startMoles === 'function'");
    const r = await page.evaluate(async () => {
      window.speak = function () {};
      startMoles(); startMolesLevel('hard'); await new Promise(r => setTimeout(r, 900));
      const bad = new Set(); let seen = 0;
      const pool = [...Array(allW.length).keys()].filter(MOLES_LEVELS.hard.filter);
      for (const i of pool) {
        molesTarget = allW[i]; molesAnimals = pickNineAnimals(molesTarget); renderMolesSlots(molesAnimals, false);
        await new Promise(r => setTimeout(r, 30));
        document.querySelectorAll('#molesGrid .mole-card').forEach(card => {
          const cn = card.querySelector('.mole-cn'); if (!cn) return; seen++;
          const a = cn.getBoundingClientRect(), c = card.getBoundingClientRect();
          if (cn.scrollWidth > cn.clientWidth + 1 || cn.scrollHeight > cn.clientHeight + 1 || a.left < c.left - 1 || a.right > c.right + 1 || a.bottom > c.bottom + 1) bad.add(cn.textContent + ` (${cn.scrollWidth}/${cn.clientWidth} × ${cn.scrollHeight}/${cn.clientHeight})`);
        });
      }
      stopMoles(); showScreen('home');
      return { bad: [...bad], seen };
    });
    ok(r.seen > 30 && r.bad.length === 0, `① ${w} 宽：打地鼠高级 ${r.seen} 张卡的中文都完整显示` + (r.bad.length ? '\n     ' + r.bad.slice(0, 8).join('\n     ') : ''));
    ok(errs.length === 0, '① 页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }
  {
    const ctx = await newCtx({ width: 360, height: 640 });
    const { page, errs } = await open(ctx, 'island_question.html', "typeof showTypingMenu === 'function'");
    await page.evaluate(() => { window.speak = function () {}; showScreen('home'); });
    await page.locator('#homeScreen .mode-card[onclick="showTypingMenu()"]').first().tap();
    await page.waitForTimeout(300);
    await page.locator('#typingContent [onclick="startTyping(3)"]').first().tap();
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => { const keys = [...document.querySelectorAll('.keyboard .key')]; return { lowest: Math.max(...keys.map(k => k.getBoundingClientRect().bottom)), h: innerHeight, n: keys.length, minH: Math.min(...keys.map(k => k.getBoundingClientRect().height)) }; });
    ok(r.n > 25 && r.lowest <= r.h, `② 360×640 打字大师高级：最下面一排键底边 ${r.lowest.toFixed(1)} ≤ ${r.h}（键高 ${r.minH}px）`);
    ok(r.minH >= 40, '② 按键还够大（≥40px）好点');
    ok(errs.length === 0, '② 页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }
  {
    const ctx = await newCtx({ width: 360, height: 640 });
    const { page, errs } = await open(ctx, 'island_family.html', "typeof startBubble === 'function'");
    const r = await page.evaluate(async () => {
      window.speak = function () {};
      startBubble(); startBubbleLevel('hard');
      const out = new Set(), wide = new Set(); let samples = 0;
      for (let t = 0; t < 40; t++) {
        await new Promise(r => setTimeout(r, 100));
        if (t === 20) { const p = bubblePool.slice(); nextBubble(); }
        const a = document.getElementById('bbArea').getBoundingClientRect();
        document.querySelectorAll('#bbArea .bubble').forEach(b => {
          samples++; const q = b.getBoundingClientRect();
          if (q.left < a.left - 1 || q.right > a.right + 1 || q.top < a.top - 1 || q.bottom > a.bottom + 1) out.add(b.textContent + ' 右边多出 ' + Math.round(q.right - a.right) + 'px');
          if (b.scrollWidth > b.clientWidth + 1) wide.add(b.textContent + ' ' + b.scrollWidth + '>' + b.clientWidth);
        });
      }
      stopBubble(); showScreen('home');
      return { out: [...out], wide: [...wide], samples };
    });
    ok(r.samples > 100 && r.out.length === 0, `③ 360 宽泡泡高级：飘的时候都在泡泡区里（${r.samples} 次采样）` + (r.out.length ? ' ' + r.out.slice(0, 6).join('；') : ''));
    ok(r.wide.length === 0, '③ 单词不比泡泡宽 ' + r.wide.slice(0, 6).join('；'));
    ok(errs.length === 0, '③ 页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 窄屏显示完整');
