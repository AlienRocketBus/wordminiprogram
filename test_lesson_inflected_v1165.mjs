/* test_lesson_inflected_v1165.mjs —— 完形填空答错小课：例句里亮的是句子自己的那个词形；亮色主题的错词标题不用禁色
 *
 * v1165 前半程：完形填空改成认变形词（eye → 例句里的 eyes、cook → cooks、fly → flown、cow → Cows），
 *   模板也把句子里真正的词形交给了小课（opts.hl = clozeQ.fill），可小课卡片只拿原词 w.en 去找，
 *   找不到就整句不亮 —— 孩子刚答错，最该看清的那个词反而没标出来。
 * 另外：结算页「这次答错的词」标题在亮色主题下用了 #92400e（棕橙色族，产品负责人点名封杀的文字色）。
 *
 * 合同：
 *   ① 4 个变形词（eyes / Cows / cooks / flown）在完形里答错 → 小课卡片例句里加粗的正是句子里的那个词形
 *   ② 原词就在句子里的词（如 cat）照旧加粗原词
 *   ③ 亮色主题下结算页错词标题的字色不是棕橙禁色，和卡片底色的对比度 ≥ 4.5
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });

// 棕橙禁色族（和 test_camel_color_ban_hf7_v946 同一张表）
const BANNED = new Set(['146,64,14', '120,53,15', '124,45,18', '154,52,18', '133,77,14', '113,63,18', '180,83,9', '161,98,7', '194,65,12']);

async function open(file) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof startCloze === 'function' && !!window.HansenMistakeLesson, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} });
  return { page, errs };
}

// 出指定那个词的完形题，真点一个错的选项，等小课卡片出来，读卡片例句里加粗的字
async function missOne(page, en) {
  const q = await page.evaluate((en) => {
    window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); };
    const i = allW.findIndex(w => w.en === en);
    const lv = Object.keys(CLOZE_LEVEL_IDX).find(k => CLOZE_LEVEL_IDX[k].includes(i)) || 'easy';
    startCloze(); startClozeLevel(lv);
    clozePool.length = 0; clozePool.push(i); clozeActive = true; nextClozeQ();
    return { asked: !!(clozeQ && clozeQ.word.en === en), wrong: clozeQ ? clozeQ.opts.findIndex(o => o.en !== en) : -1, ex: allW[i] && allW[i].ex };
  }, en);
  if (!q.asked || q.wrong < 0) return { asked: false, ex: q.ex };
  await page.locator('#clozeScreen .cloze-opt').nth(q.wrong).tap();
  await page.waitForSelector('#hml_lesson .hml-ex', { timeout: 6000 }).catch(() => {});
  const card = await page.evaluate(() => {
    const ex = document.querySelector('#hml_lesson .hml-ex');
    const b = ex && ex.querySelector('b');
    return { ex: ex ? ex.textContent : '', bold: b ? b.textContent : '' };
  });
  await page.evaluate(() => { try { const l = document.getElementById('hml_lesson'); if (l) l.remove(); stopCloze(); showScreen('home'); } catch (e) {} });
  return { asked: true, ...card, src: q.ex };
}

try {
  console.log('\n▶ ① 变形词：卡片亮句子里的那个词形');
  for (const [file, en, want] of [['island_body.html', 'eye', 'eyes'], ['island_animal.html', 'cow', 'Cows'], ['island_action.html', 'cook', 'cooks'], ['island_action.html', 'fly', 'flown']]) {
    const { page, errs } = await open(file);
    const r = await missOne(page, en);
    ok(r.asked && r.ex === r.src, `${en}：出了题、小课卡片带着整句例句（「${r.ex}」）`);
    ok(r.bold === want, `${en}：卡片例句里加粗的是「${r.bold}」（应为句子里的「${want}」）`);
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await page.close();
  }

  console.log('\n▶ ② 原词就在句子里：照旧亮原词');
  {
    const { page, errs } = await open('island_animal.html');
    const ex = await page.evaluate(() => (allW.find(w => w.en === 'cat') || {}).ex || '');
    const r = await missOne(page, 'cat');
    const want = (ex.match(/\bcat\b/i) || [''])[0];
    ok(r.asked && want && r.bold === want, `cat：加粗「${r.bold}」（句子「${ex}」）`);
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await page.close();
  }

  console.log('\n▶ ③ 亮色主题：结算页错词标题不用棕橙禁色、看得清');
  {
    const { page, errs } = await open('island_animal.html');
    const r = await page.evaluate(() => {
      document.documentElement.classList.add('hsn-pal-light');
      const M = window.HansenMistakeLesson;
      M.start('cloze'); M.miss('cloze', allW.findIndex(w => w.en === 'cat'));
      const host = document.createElement('div'); host.id = '__t_host';
      host.innerHTML = '<div><div><button class="game-btn">再来一次</button></div></div>';
      document.body.appendChild(host);
      M.attach('cloze', host);
      const t = host.querySelector('.hml-r-title'), card = host.querySelector('.hml-result');
      const rgb = s => (String(s).match(/[\d.]+/g) || []).slice(0, 4).map(Number);
      return { title: t ? t.textContent : '', color: t ? rgb(getComputedStyle(t).color) : [], bg: card ? rgb(getComputedStyle(card).backgroundColor) : [], page: rgb(getComputedStyle(document.body).backgroundColor) };
    });
    // 卡片是半透明白底：叠在页面底色上算出真正的底色，再算对比度
    const a = r.bg.length === 4 ? r.bg[3] : 1;
    const under = (r.page.length >= 3 && (r.page.length < 4 || r.page[3] > 0)) ? r.page : [255, 255, 255];
    const bg = [0, 1, 2].map(i => r.bg[i] * a + under[i] * (1 - a));
    const lum = c => { const v = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const L1 = lum(r.color.slice(0, 3)), L2 = lum(bg);
    const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    ok(!!r.title, '结算页错词块出来了：' + r.title);
    ok(!BANNED.has(r.color.slice(0, 3).join(',')), `标题字色 rgb(${r.color.slice(0, 3).join(',')}) 不是棕橙禁色`);
    ok(cr >= 4.5, `标题和卡片底色的对比度 ${cr.toFixed(2)} ≥ 4.5`);
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await page.close();
  }
} finally { await ctx.close(); await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 答错小课：变形词亮句子里的写法；亮色主题错词标题不用禁色');
