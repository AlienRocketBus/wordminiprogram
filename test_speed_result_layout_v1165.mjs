/* test_speed_result_layout_v1165.mjs —— 极速60秒结算页：「📒 这次答错的词」在得分下面、按钮上面，不压在「时间到！」上面
 *
 * 复查（v1165 第 1 轮 G6）：别的玩法的结算按钮各自包在一排里，错词块插在那一排前面；
 *   极速60秒的三个按钮直接挂在整张结算卡上，错词块找到的「那一排」就是整张卡 → 插到了整张卡前面：
 *   360×640 的手机上孩子先看到错词，标题、星星和得分被挤到下面。
 *
 * 合同（island_animal 极速60秒初级，360×640，真点答错 2 题，然后让时间走完）：
 *   ① 结算页有「这次答错的词」，列着答错的那 2 个词
 *   ② 它在「时间到！」标题和得分的下面、第一个按钮的上面（页面顺序和屏幕上的位置都是）
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

try {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof startSpeed === 'function' && !!window.HansenMistakeLesson, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); }; showScreen('home'); });
  const card = page.locator('#homeScreen .mode-card[onclick="startSpeed()"]').first();
  await card.scrollIntoViewIfNeeded(); await card.tap();
  await page.waitForTimeout(400);
  const lvl = page.locator('#speedContent [onclick^="startSpeedLevel"]').first();
  await lvl.scrollIntoViewIfNeeded(); await lvl.tap();
  const missed = [];
  for (let n = 0; n < 2; n++) {
    await page.waitForFunction(() => spActive && document.getElementById('spOpts') && !document.getElementById('spOpts').dataset.done && !document.getElementById('hml_lesson'), null, { timeout: 15000 });
    await page.waitForTimeout(250);
    const q = await page.evaluate(() => ({ en: window._spCorrect, i: window._spOpts.findIndex(o => o.en !== window._spCorrect) }));
    missed.push(q.en);
    const opt = page.locator('#spOpts .boss-opt').nth(q.i);
    await opt.scrollIntoViewIfNeeded(); await opt.tap();
    await page.waitForFunction(() => document.getElementById('hml_lesson'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.locator('#hml_lesson').tap().catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => { spTime = 1; });   // 让 60 秒走完（钟每秒减 1，到 0 自己结算）
  await page.waitForFunction(() => !spActive && /时间到/.test(document.getElementById('speedContent').textContent || ''), null, { timeout: 8000 });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const host = document.getElementById('speedContent');
    const box = host.querySelector('.hml-result');
    const title = [...host.querySelectorAll('div')].find(d => d.children.length === 0 && /时间到/.test(d.textContent || ''));
    const btn = host.querySelector('.game-btn');
    if (!box || !title || !btn) return { box: !!box, title: !!title, btn: !!btn };
    window.scrollTo(0, 0);
    const pos = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const tb = title.getBoundingClientRect(), bb = box.getBoundingClientRect(), nb = btn.getBoundingClientRect();
    return { box: true, title: true, btn: true, words: [...box.querySelectorAll('.hml-r-word')].map(b => (b.textContent || '').replace('🔊', '').trim().split(' ')[0]),
      titleBefore: pos(title, box), btnAfter: pos(box, btn), titleTop: Math.round(tb.top), boxTop: Math.round(bb.top), btnTop: Math.round(nb.top) };
  });
  console.log('     ' + JSON.stringify({ missed, ...r }));
  ok(r.box && missed.every(w => (r.words || []).includes(w)), `① 结算页列出答错的词（${(r.words || []).join(', ') || '没有这一块'}）`);
  ok(r.titleBefore && r.btnAfter, '② 页面顺序：「时间到！」→ 这次答错的词 → 按钮');
  ok(r.boxTop > r.titleTop && r.boxTop < r.btnTop, `② 屏幕上：标题 ${r.titleTop}px < 错词块 ${r.boxTop}px < 按钮 ${r.btnTop}px`);
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 极速60秒结算：错词块在得分下面、按钮上面');
