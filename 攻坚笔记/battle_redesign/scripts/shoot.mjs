// 给每个状态 × 主题 × 尺寸截图，并在同一次加载里量：逐像素文字对比度、点击区、横向溢出。
// 用法: node shoot.mjs   （环境变量 ONLY=state1,state2  THEMES=cosmos,cloud  SIZES=390x844,360x640,320x568  NOSHOT=1）
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HANSEN_PLAYWRIGHT_MODULE || 'playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.resolve(HERE, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pf = path.join(OUT, 'metrics', '.port'); try { fs.unlinkSync(pf); } catch {}
const srv = spawn(process.execPath, [path.join(HERE, 'server.mjs'), pf], { stdio: 'inherit' });
while (!fs.existsSync(pf)) await sleep(50);
const BASE = `http://127.0.0.1:${fs.readFileSync(pf, 'utf8')}/攻坚笔记/battle_redesign/mockups/`;
const THEMES = (process.env.THEMES || 'cosmos,cloud').split(',');
const SIZES = (process.env.SIZES || '390x844,360x640,320x568').split(',').map(s => s.split('x').map(Number));
const browser = await chromium.launch();

const COLLECT = () => {
  const out = [], vw = innerWidth, vh = innerHeight, seen = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const t = n.nodeValue; if (!t || !/[A-Za-z0-9一-鿿]/.test(t)) continue;
    const el = n.parentElement; if (!el || seen.has(el) || /^(SCRIPT|STYLE)$/.test(el.tagName)) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const rects = [...r.getClientRects()].filter(q => q.width > 2 && q.height > 4); if (!rects.length) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of rects) { x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom); }
    if (x1 <= 0 || y1 <= 0 || x0 >= vw || y0 >= vh) continue;
    let op = 1, e = el; while (e && e.nodeType === 1) { op *= parseFloat(getComputedStyle(e).opacity); e = e.parentElement; }
    const cs = getComputedStyle(el);
    const cx = Math.min(vw - 1, Math.max(0, (rects[0].left + rects[0].right) / 2)), cy = Math.min(vh - 1, Math.max(0, (rects[0].top + rects[0].bottom) / 2));
    const top = document.elementFromPoint(cx, cy); const onTop = !!top && (top === el || el.contains(top) || top.contains(el));
    seen.add(el);
    let pth = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
    let p = el.parentElement, d = 0; while (p && d < 3) { if (p.id || p.classList.length) { pth = (p.id ? '#' + p.id : '.' + p.classList[0]) + ' ' + pth; break; } p = p.parentElement; d++; }
    out.push({ text: t.trim().slice(0, 40), path: pth, x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(vw, x1), y1: Math.min(vh, y1), color: cs.color, fill: cs.webkitTextFillColor, size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight) || 400, op, onTop });
  }
  return out;
};
const GEOM = () => {
  const vw = innerWidth, res = { scrollW: document.documentElement.scrollWidth, vw, small: [], keys: [], offscreen: [], clipped: [] };
  for (const el of document.querySelectorAll('button,a[href],input,summary,[role=button],[role=radio],[role=textbox]')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cy > innerHeight + 2000) continue;
    // 被弹层盖住的东西点不到，不算
    const scrim = document.querySelector('.scrim'); if (scrim && !el.closest('.sheet') && !el.closest('.toast')) continue;
    const lab = (el.getAttribute('aria-label') || el.textContent || el.value || el.placeholder || '').trim().slice(0, 24);
    const item = { lab, w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: +r.left.toFixed(1) };
    if (el.closest('.kb')) { res.keys.push(item); continue; }
    if (r.width < 44 || r.height < 44) res.small.push(item);
    if (r.right > vw + 0.5 || r.left < -0.5) res.offscreen.push(item);
  }
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el); if (cs.position === 'fixed' && el.classList.contains('scrim')) continue;
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    if (r.right > vw + 0.5 && !el.closest('.fx-layer')) res.offscreen.push({ el: el.tagName + '.' + el.className, right: +r.right.toFixed(1) });
    if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow === 'ellipsis') res.clipped.push((el.textContent || '').trim().slice(0, 30));
  }
  res.offscreen = res.offscreen.slice(0, 20);
  return res;
};
const HIDE = `:is(#a#b#c#d,*),:is(#a#b#c#d,*)::before,:is(#a#b#c#d,*)::after,:is(#a#b#c#d,*)::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}`;

const states = await (async () => { const c = await browser.newContext(); const p = await c.newPage(); await p.goto(BASE + 'index.html'); const k = await p.evaluate(() => Object.keys(SCREENS).map(k => [k, SCREENS[k].g, SCREENS[k].n])); await c.close(); return k; })();
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const todo = states.filter(s => !only.length || only.includes(s[0]));
fs.writeFileSync(path.join(OUT, 'metrics', 'states.json'), JSON.stringify(states, null, 1));
const all = {};
for (const [W, H] of SIZES) {
  const dpr = W === 390 || W === 360 ? 2 : 1;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120 Mobile MicroMessenger/8.0.40', reducedMotion: 'reduce' });
  const dir = path.join(OUT, 'shots', `${W}x${H}`); fs.mkdirSync(dir, { recursive: true });
  for (const theme of THEMES) for (const [k] of todo) {
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('requestfailed', r => errs.push('REQFAIL ' + r.url()));
    pg.on('response', r => { if (r.status() >= 400) errs.push('HTTP' + r.status() + ' ' + r.url()); });
    await pg.goto(`${BASE}screen.html?s=${k}&theme=${theme}&freeze=1`, { waitUntil: 'load' });
    await pg.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))); });
    await sleep(60);
    const name = `${k}_${theme}`, shot = path.join(dir, name + '.png');
    if (!process.env.NOSHOT) await pg.screenshot({ path: shot });
    const geom = await pg.evaluate(GEOM);
    const fonts = await pg.evaluate(() => { const ok = new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '')));
      const used = new Set(); for (const el of document.querySelectorAll('body *')) { if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) continue; const f = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim(); used.add(f); }
      return ['CartoonBlack', 'Baloo2'].map(f => !used.has(f) || ok.has(f)); });  // 用到了这个字体就必须真的加载成功
    const m = { geom, errs, fonts };
    if (W !== 320) {
      const els = await pg.evaluate(COLLECT);
      const fg = path.join(OUT, 'metrics', '.fg.png'), bg = path.join(OUT, 'metrics', '.bg.png'), jf = path.join(OUT, 'metrics', '.els.json');
      await pg.screenshot({ path: fg });
      await pg.addStyleTag({ content: HIDE });
      // 彩色 emoji 不受 color 影响：隐藏文字那张图里把 emoji 也藏起来（visibility 不改版面），背景才是真背景
      await pg.evaluate(() => { const re = /(\p{Extended_Pictographic}\uFE0F?(\u200D\p{Extended_Pictographic}\uFE0F?)*)/gu; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const ns = []; let n; while ((n = w.nextNode())) if (re.test(n.nodeValue)) ns.push(n);
        for (const t of ns) { const sp = document.createElement('span'); sp.innerHTML = t.nodeValue.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(re, '<span style="visibility:hidden">$1</span>'); t.replaceWith(...sp.childNodes); } });
      await sleep(40); await pg.screenshot({ path: bg });
      fs.writeFileSync(jf, JSON.stringify(els));
      const r = JSON.parse(execFileSync('python3', ['-I', path.join(HERE, 'contrast.py'), jf, bg, fg, String(dpr)], { encoding: 'utf8', maxBuffer: 64e6 }));
      m.contrast = { n: r.n, fail: r.fail, minRatio: r.minRatio, worst: r.worst, minByType: { body: Math.min(...r.all.filter(x => !x.large).map(x => x.ratio)), large: Math.min(...r.all.filter(x => x.large).map(x => x.ratio)) } };
    }
    (all[`${W}x${H}`] ||= {})[name] = m;
    await pg.close();
  }
  await ctx.close();
}
const mf = path.join(OUT, 'metrics', only.length ? 'measure_partial.json' : 'measure.json');
fs.writeFileSync(mf, JSON.stringify(all, null, 1));
await browser.close(); srv.kill();
// 汇总
let sum = { states: todo.length, files: 0, contrastFail: 0, minBody: 9, minLarge: 9, small: 0, overflow: 0, errs: 0, fontMiss: 0 };
for (const sz in all) for (const n in all[sz]) { const m = all[sz][n]; sum.files++; if (m.contrast) { sum.contrastFail += m.contrast.fail; sum.minBody = Math.min(sum.minBody, m.contrast.minByType.body); sum.minLarge = Math.min(sum.minLarge, m.contrast.minByType.large); }
  sum.small += m.geom.small.length; sum.overflow += (m.geom.scrollW > m.geom.vw ? 1 : 0) + m.geom.offscreen.length; sum.errs += m.errs.length; sum.fontMiss += m.fonts.filter(x => !x).length; }
console.log(JSON.stringify(sum));
