/* test_idle_motion_v1165.mjs —— 待机动画预算：孩子什么都不做时，页面不该一直占着手机
 *
 * 事故（v1163 实测，4 倍慢 CPU）：岛屿菜单什么都不做时主线程约 34~49% 在忙，首页 64~71%。
 *   · 岛屿：5 个装饰动画永远循环；其中宝箱柔光动 box-shadow、藏宝图金光动 filter，每帧重画；
 *     星空 twinkle 关键帧首尾都是 .45，什么都不改却每帧在跑；
 *   · 首页：视差循环每秒 60 次改两层全屏 transform（手机上根本没有鼠标）；80 颗星星等装饰永远在动；
 *     飞行演员的上下浮动改 margin-top，每帧重新排版。
 *
 * 合同（真浏览器）：
 *   M1 岛屿菜单待机 45 秒后，没有任何还在跑的动画
 *   M2 星空不再挂那个什么都不改的 twinkle 动画
 *   M3 岛屿菜单上的装饰动画只动 transform / opacity
 *   M4 系统「减少动态效果」打开时，岛屿菜单装饰一开始就不动
 *   M5 首页：12 秒没碰屏幕，星星等装饰歇着；主题演员照常飞（v943）；手指一碰就醒
 *   M6 首页：鼠标不动时视差循环一帧都不跑；鼠标动了才跑，追上就停
 *   M7 首页飞行演员的上下浮动不再改 margin（不排版）
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
const CHEAP = new Set(['transform', 'opacity', 'translate', 'scale', 'rotate', 'offset', 'easing', 'composite', 'computedOffset']);

async function open(file, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  /* 数首页视差循环（函数名 tick）每秒被排了几帧：只改同一个值时 style 不变，光看 DOM 变化看不出它在空转 */
  await ctx.addInitScript(() => { window.__tickFrames = 0; const raf = window.requestAnimationFrame; window.requestAnimationFrame = function (cb) { if (cb && cb.name === 'tick') window.__tickFrames++; return raf.call(window, cb); }; });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState === 'complete', null, { timeout: 30000 });
  return { ctx, page, errs };
}
const closeWelcome = page => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
const running = page => page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName || 'js'));

/* ── M1 / M2 / M3 岛屿菜单 ── */
console.log('\n▶ M1/M2/M3 美食岛菜单待机');
{
  const { ctx, page, errs } = await open('island_food.html');
  await page.waitForTimeout(1500); await closeWelcome(page); await page.waitForTimeout(1500);
  const early = await page.evaluate(cheap => {
    const out = [];
    for (const a of document.getAnimations()) {
      if (a.playState !== 'running' || !a.effect || !a.effect.getKeyframes) continue;
      const props = new Set(); for (const k of a.effect.getKeyframes()) for (const p of Object.keys(k)) if (!cheap.includes(p)) props.add(p);
      out.push({ name: a.animationName, iter: a.effect.getTiming().iterations, heavy: [...props] });
    }
    return out;
  }, [...CHEAP]);
  ok(early.length > 0, `开头几秒装饰照常动一动（${early.map(a => a.name).join(',')}）`);
  const heavy = early.filter(a => a.heavy.length);
  ok(heavy.length === 0, `装饰动画只动 transform/opacity（超标：${heavy.map(a => a.name + '→' + a.heavy.join('/')).join('，') || '无'}）`);
  const inf = early.filter(a => a.iter === Infinity);
  ok(inf.length === 0, `没有永远循环的装饰动画（永远循环：${inf.map(a => a.name).join(',') || '无'}）`);
  const star = await page.evaluate(() => ({ anim: getComputedStyle(document.body, '::after').animationName,
    noop: [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => r.type === 7 && r.name === 'twinkle'); } catch (e) { return false; } }) }));
  ok(star.anim === 'none' && !star.noop, `星空不再挂什么都不改的 twinkle（animation=${star.anim}，关键帧还在=${star.noop}）`);
  await page.waitForTimeout(42000);
  const late = await running(page);
  ok(late.length === 0, `待机 45 秒后没有还在跑的动画（还在跑：${late.join(',') || '无'}）`);
  const chest = await page.evaluate(() => { const c = document.getElementById('chestCard'); return c ? { pending: c.classList.contains('chest-pending'), op: getComputedStyle(c, '::after').opacity } : null; });
  ok(!chest || !chest.pending || +chest.op > 0, `宝箱没签到时停下来仍留着淡淡的光提醒（opacity=${chest && chest.op}）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ── M4 减少动态效果 ── */
console.log('\n▶ M4 系统打开「减少动态效果」');
{
  const { ctx, page, errs } = await open('island_food.html', { reduce: true });
  await page.waitForTimeout(1500); await closeWelcome(page); await page.waitForTimeout(1200);
  const r = await running(page);
  const deco = r.filter(n => /worldMapFloat|wmbGlowD|chestSlowGlow|hsnPetFloatSlow|pulseDot|twinkle/.test(n));
  ok(deco.length === 0, `菜单装饰一开始就不动（还在动：${deco.join(',') || '无'}）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ── M5 / M6 / M7 首页 ── */
console.log('\n▶ M5/M6/M7 首页待机');
{
  const { ctx, page, errs } = await open('index.html');
  await page.evaluate(() => {
    window.__parallaxWrites = 0;
    const st = document.getElementById('stars');
    new MutationObserver(l => { window.__parallaxWrites += l.length; }).observe(st, { attributes: true, attributeFilter: ['style'] });
  });
  const f0 = await page.evaluate(() => window.__tickFrames);
  await page.waitForTimeout(2000);
  const f1 = await page.evaluate(() => window.__tickFrames);
  ok(f1 - f0 === 0 && await page.evaluate(() => window.__parallaxWrites) === 0, `鼠标不动：视差循环一帧都不跑（2 秒内排了 ${f1 - f0} 帧）`);
  await page.mouse.move(100, 200); await page.mouse.move(260, 500, { steps: 6 });
  await page.waitForTimeout(300);
  const moving = await page.evaluate(() => window.__parallaxWrites);
  ok(moving > 0, `鼠标动了：视差照常跟着动（${moving} 次）`);
  /* 追上要几十帧；无头浏览器帧率不稳，给足 7 秒再看最后 1 秒 */
  await page.waitForTimeout(7000);
  const a = await page.evaluate(() => window.__parallaxWrites); await page.waitForTimeout(1000);
  const b = await page.evaluate(() => window.__parallaxWrites);
  ok(b === a, `鼠标停下、追上之后视差循环自己停（最后 1 秒改了 ${b - a} 次）`);
  const bob = await page.evaluate(() => {
    const out = new Set();
    for (const an of document.getAnimations()) if (/^bob/.test(an.animationName || '')) for (const k of an.effect.getKeyframes()) for (const p of Object.keys(k)) out.add(p);
    return [...out];
  });
  ok(!bob.some(p => /margin/i.test(p)), `飞行演员上下浮动不改 margin（关键帧属性：${bob.join(',') || '本主题没有'}）`);
  await page.waitForTimeout(5000);
  const rest = await page.evaluate(() => ({
    cls: document.documentElement.classList.contains('hsn-deco-rest'),
    starRunning: document.getAnimations().filter(x => x.playState === 'running' && x.effect && x.effect.target && x.effect.target.classList && x.effect.target.classList.contains('star')).length,
    flyerRunning: document.getAnimations().filter(x => x.playState === 'running' && x.effect && x.effect.target && x.effect.target.closest && x.effect.target.closest('.flyer')).length,
    taglineRunning: document.getAnimations().filter(x => x.playState === 'running' && x.effect && x.effect.target && x.effect.target.classList && x.effect.target.classList.contains('tagline')).length,
  }));
  ok(rest.taglineRunning === 0, `彩虹标语（每帧改背景位置 + 滤镜，最贵）也歇着（还在跑 ${rest.taglineRunning} 个）`);
  ok(rest.cls && rest.starRunning === 0, `12 秒没碰屏幕：星星等装饰歇着（还在闪的星星 ${rest.starRunning} 颗）`);
  ok(rest.flyerRunning > 0, `主题演员照常飞（${rest.flyerRunning} 个动画）`);
  const box = await page.evaluate(() => { const e = document.querySelector('.title-block') || document.body; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.max(10, r.y + 10) }; });
  await page.touchscreen.tap(box.x, box.y);
  await page.waitForTimeout(400);
  const awake = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('hsn-deco-rest'),
    starRunning: document.getAnimations().filter(x => x.playState === 'running' && x.effect && x.effect.target && x.effect.target.classList && x.effect.target.classList.contains('star')).length }));
  ok(!awake.cls && awake.starRunning > 0, `手指一碰：星星又动起来（${awake.starRunning} 颗）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

await browser.close(); srv.close();
console.log(fails ? `\n❌ 待机动画预算：${fails} 项失败` : '\n✅ 待机动画预算：岛屿菜单 45 秒后全静、只动 transform/opacity、减少动态效果、首页装饰歇着/视差只随鼠标/浮动不排版 全通过');
process.exit(fails ? 1 : 0);
