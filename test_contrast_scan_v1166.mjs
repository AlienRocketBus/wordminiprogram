/* test_contrast_scan_v1166.mjs —— 「看得清」发布闸门：逐像素量每一段字和它脚下真实背景的对比度
 *
 * 为什么要有它：v1163 主题审查逐像素实测，每套主题 14~35% 的文字段不达标（听音辨义「1/20」亮色下 1.04，
 *   玩法卡白字压亮橙 2.08……）。这些是主题 2.0 要一点点消掉的；在那之前，至少不能再多、不能更差。
 *
 * 怎么量（和 攻坚笔记/next_inputs/theme_scripts/contrast_lib.mjs 同一个方法）：
 *   ① 先把动画全部定格（有限的快进到结束，无限的取消回到开头）——两次取景对得上，结果可重复；
 *   ② 记下每段字的位置、颜色（含 opacity 链、-webkit-text-fill-color）、字号字重、是否在最上层；
 *   ③ 用最高优先级把所有字（含行内 !important）、描边、text-shadow 设成透明，再截一张「只有背景」的图；
 *   ④ 每段字的背景 = 它方框里真实像素的亮度中位数（渐变、图片、canvas 都算在内；字已藏起来，没有抗锯齿边混进来）；
 *      前景 = CSS 颜色按 opacity 合成到这个背景上。大字（≥24px 或 ≥18.66px 且加粗）要 3:1，其他 4.5:1。
 *   渐变字（background-clip:text）量不了，跳过并计数；带描边/阴影的照常算（描边帮忙，但不算进比值，和主题脚本一致）。
 *   Math.random 换成固定种子，每次出的是同一批题，同一段字每次都在同一个位置。
 *
 * 合同：
 *   C1 每个画面都真的画出来了（量到的文字段数够）
 *   C2 不达标的字，必须已经写在 攻坚笔记/gates/contrast_baseline.json 里（新冒出来的 → 红）
 *   C3 基线里的字，对比度不许比基线再低 TOL 以上（变更差 → 红）
 *   已经修好的会提示「可以从基线删掉」，不算失败。
 *
 * 环境变量：CONTRAST_WRITE_BASELINE=1  重写基线（只在确认「新失败是有意的 / 旧失败修好了」之后用，见 GATES.md）
 *           CONTRAST_SHOTS=目录        同时存每个画面的截图（人工复核用）
 *           CONTRAST_JSON=文件         把全部测量写成 JSON
 *           CONTRAST_ONLY=cosmos,cloud 只跑部分主题（调试用；闸门里不要设）
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const BASELINE = path.join(ROOT, '攻坚笔记', 'gates', 'contrast_baseline.json');
const T_START = Date.now();
const TOL = 0.25;          // 同一段字两次量的差 ≤ 0.1（实测）；比基线低 0.25 以上才算「更差」
const MIN_RUNS = 4;        // 一个画面至少量到这么多段字，否则说明画面没出来
const PARALLEL = 3;

/* 主题：8 个免费配色（4 暗 4 亮）+ 付费代表：金币·樱花粉（暗 / 亮两种底色下）+ 画廊·童话镇 */
const PRESETS = {
  cosmos: { palette: 'cosmos' }, violet: { palette: 'violet' }, aurora: { palette: 'aurora' }, woods: { palette: 'woods' },
  cloud: { palette: 'cloud' }, sakura: { palette: 'sakura' }, cream: { palette: 'cream' }, mint: { palette: 'mint' },
  coin_pink_dark: { palette: 'cosmos', coinTheme: 'pink' }, coin_pink_light: { palette: 'cloud', coinTheme: 'pink' },
  gallery_fairy: { palette: 'cosmos', dia: 'theme_photo_fairytown', still: true },   // 画布主题：整套用「减少动态效果」，引擎只画静止帧、不再吃随机数
};
const ONLY = (process.env.CONTRAST_ONLY || '').split(',').filter(Boolean);
const WRITE = process.env.CONTRAST_WRITE_BASELINE === '1';
const SHOTS = process.env.CONTRAST_SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── 本地静态服务器 ── */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'cache-control': 'max-age=600' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH,
  args: ['--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1', '--autoplay-policy=no-user-gesture-required'] });

/* ── 小 PNG 解码器（Chromium 截图：8 位、RGB/RGBA、不隔行）── */
function decodePNG(buf) {
  let off = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('latin1', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12] !== 0 || (ct !== 2 && ct !== 6)) throw new Error('PNG 格式不支持'); }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    off += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * 3);
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { out[(y * w + x) * 3] = cur[x * bpp]; out[(y * w + x) * 3 + 1] = cur[x * bpp + 1]; out[(y * w + x) * 3 + 2] = cur[x * bpp + 2]; }
    [prev, cur] = [cur, prev];
  }
  return { w, h, px: out };
}
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const Lum = p => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
const CR = (a, b) => { let x = Lum(a), y = Lum(b); if (x < y) [x, y] = [y, x]; return (x + 0.05) / (y + 0.05); };
const parseC = c => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const v = m[1].replace('/', ',').split(/[,\s]+/).filter(Boolean).map(parseFloat); if (v.length === 3) v.push(1); return v; };
const hex = p => '#' + p.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

/* 页面里：定格动画 → 收集文字段 */
const FREEZE = async () => {
  for (const a of document.getAnimations()) { try { const t = a.effect && a.effect.getTiming(); if (t && t.iterations !== Infinity) a.finish(); else a.cancel(); } catch (e) { try { a.cancel(); } catch (_) {} } }
  const st = document.createElement('style'); st.id = '__cFreeze'; st.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(st);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
};
const COLLECT = () => {
  const out = [], vw = innerWidth, vh = innerHeight, seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = walker.nextNode())) {
    const t = n.nodeValue; if (!t || !t.trim() || !/[A-Za-z0-9一-鿿]/.test(t)) continue;
    const el = n.parentElement; if (!el || seen.has(el) || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|OPTION)$/.test(el.tagName)) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const rects = [...r.getClientRects()].filter(q => q.width > 2 && q.height > 4); if (!rects.length) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of rects) { x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom); }
    if (x1 <= 0 || y1 <= 0 || x0 >= vw || y0 >= vh) continue;
    let op = 1, e = el, hidden = false;
    while (e && e.nodeType === 1) { const c = getComputedStyle(e); op *= parseFloat(c.opacity); if (c.visibility === 'hidden' || c.display === 'none') hidden = true; e = e.parentElement; }
    if (hidden || op < 0.05) continue;
    const cs = getComputedStyle(el);
    const cx = Math.min(vw - 1, Math.max(0, (rects[0].left + rects[0].right) / 2)), cy = Math.min(vh - 1, Math.max(0, (rects[0].top + rects[0].bottom) / 2));
    const top = document.elementFromPoint(cx, cy);
    if (!(top && (top === el || el.contains(top) || top.contains(el)))) continue;   // 被盖住的不算
    seen.add(el);
    /* 稳定的路径：自己 tag#id.前两个 class，往上找最近的 id（最多 4 层），再带上中间层的 tag */
    const self = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].filter(c => !/^(show|active|correct|wrong|done|sel|on|playing)$/.test(c)).slice(0, 2).join('.') : '');
    let p = el.parentElement, depth = 0, mid = [], anchor = '';
    while (p && depth < 4 && !el.id) { if (p.id) { anchor = '#' + p.id; break; } mid.unshift(p.classList.length ? '.' + p.classList[0] : p.tagName.toLowerCase()); p = p.parentElement; depth++; }
    const path = (anchor ? anchor + ' ' : '') + (anchor ? mid.slice(-2).join('>') + (mid.length ? '>' : '') : '') + self;
    out.push({ text: t.trim().slice(0, 30), path, x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(vw, x1), y1: Math.min(vh, y1),
      color: cs.color, fill: cs.webkitTextFillColor, clip: cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text',
      size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight) || 400, op, shadow: cs.textShadow !== 'none' || parseFloat(cs.webkitTextStrokeWidth) > 0 });
  }
  return out;
};
/* 选择器加 5 个 id 的权重，压过页面里所有写法（行内 !important 另外处理） */
const SEL = ':is(#cA#cB#cC#cD#cE,*)';
const HIDE_CSS = `${SEL},${SEL}::before,${SEL}::after,${SEL}::placeholder,${SEL}::marker{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important;text-decoration-color:transparent!important}`;
const HIDE = css => {
  const st = document.createElement('style'); st.id = '__cHide';
  st.textContent = css;
  document.head.appendChild(st);
  window.__cSaved = [];
  for (const el of document.querySelectorAll('[style*="important"]')) { const s = el.getAttribute('style'); if (/color|text-shadow|text-stroke/i.test(s)) { window.__cSaved.push([el, s]); el.style.setProperty('color', 'transparent', 'important'); el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); el.style.setProperty('text-shadow', 'none', 'important'); el.style.setProperty('-webkit-text-stroke-width', '0', 'important'); } }
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
};

/* 量完把页面恢复原样（同一页接着玩下一步） */
const RESTORE = () => { for (const id of ['__cHide', '__cFreeze']) { const e = document.getElementById(id); if (e) e.remove(); } for (const [el, s] of (window.__cSaved || [])) el.setAttribute('style', s); window.__cSaved = null; };
async function measure(pg, id) {
  /* 画布背景（IMAX / 画廊主题的粒子一直在飘）：量的那一下切到「减少动态效果」，引擎会画一张静止帧，两次取景才对得上 */
  const canvasBg = await pg.evaluate(() => [...document.querySelectorAll('canvas')].some(c => { const r = c.getBoundingClientRect(); return r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9; }));
  if (canvasBg) { await pg.emulateMedia({ reducedMotion: 'reduce' }); await sleep(250); }
  await pg.evaluate(FREEZE);
  await sleep(150);
  const els = await pg.evaluate(COLLECT);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, id + '.png') });
  await pg.evaluate(HIDE, HIDE_CSS);
  const img = decodePNG(await pg.screenshot());
  await pg.evaluate(RESTORE);
  if (canvasBg && !pg.__still) await pg.emulateMedia({ reducedMotion: 'no-preference' });
  const res = []; let gradient = 0;
  for (const e of els) {
    const f = parseC(e.fill), c = parseC(e.color);
    const fc = f && f[3] > 0 ? f : c;
    if (e.clip || !fc || fc[3] === 0) { gradient++; continue; }
    const X0 = Math.round(e.x0), Y0 = Math.round(e.y0), X1 = Math.min(img.w - 1, Math.round(e.x1)), Y1 = Math.min(img.h - 1, Math.round(e.y1));
    if (X1 - X0 < 2 || Y1 - Y0 < 2) continue;
    const step = Math.max(1, Math.floor(Math.sqrt((X1 - X0) * (Y1 - Y0) / 4000)));
    const s = [];
    for (let y = Y0; y < Y1; y += step) for (let x = X0; x < X1; x += step) { const i = (y * img.w + x) * 3; s.push([img.px[i], img.px[i + 1], img.px[i + 2]]); }
    if (!s.length) continue;
    s.sort((a, b) => Lum(a) - Lum(b));
    const bg = s[s.length >> 1], al = fc[3] * e.op;
    const fg = [0, 1, 2].map(i => fc[i] * al + bg[i] * (1 - al));
    const ratio = Math.round(CR(fg, bg) * 100) / 100;
    const large = e.size >= 24 || (e.size >= 18.66 && e.weight >= 700), need = large ? 3 : 4.5;
    res.push({ text: e.text, path: e.path, size: e.size, weight: e.weight, fg: hex(fg), bg: hex(bg), ratio, need, fail: ratio < need, shadow: e.shadow });
  }
  return { n: res.length, gradient, canvasBg, res };
}

/* ── 画面：首页第一屏、岛屿菜单、三个小游戏（出题 / 答对揭晓 / 答错小课）、结算、设置 ── */
async function runPreset(name) {
  const p = PRESETS[name];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'zh-CN', reducedMotion: p.still ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(p => {
    /* 固定种子：每次出同一批题 */
    let s = 20261103; window.__cReseed = () => { s = 20261103; }; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try {
      if (sessionStorage.getItem('__cs')) return; sessionStorage.setItem('__cs', '1');
      localStorage.clear(); localStorage.setItem('hansen_onboarded', '1');
      if (p.palette && p.palette !== 'cosmos') localStorage.setItem('hansen_palette_global', p.palette);
      if (p.coinTheme) { localStorage.setItem('theme', p.coinTheme); localStorage.setItem('hansen_unlocked_themes', JSON.stringify([p.coinTheme])); }
      if (p.dia) localStorage.setItem('hansen_diamond_shop', JSON.stringify({ owned: { [p.dia]: true }, equipped: p.dia }));
    } catch (e) {}
  }, p);
  const out = {}, errs = [];
  let pg = null;
  const open = async (file, wait) => {
    if (pg) await pg.close().catch(() => {});
    pg = await ctx.newPage(); pg.__still = !!p.still;
    pg.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    pg.on('dialog', d => d.dismiss().catch(() => {}));
    await pg.goto(BASE + file, { waitUntil: 'load', timeout: 60000 });
    await sleep(wait);
  };
  const island = async () => {
    await open('island_food.html', 2500);
    await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
    await sleep(500);
    await pg.evaluate(() => { document.querySelectorAll('.modal-bg.show').forEach(m => m.classList.remove('show')); scrollTo(0, 0); });
    await sleep(300);
  };
  const step = async (id, fn) => {
    try { await fn(); out[id] = await measure(pg, `${name}_${id}`); }
    catch (e) { out[id] = { n: 0, err: String(e).slice(0, 200), res: [] }; }
  };
  await step('home_top', () => open('index.html', 3500));
  await step('island_menu', island);
  await step('listen_q', async () => { await island(); await pg.evaluate(() => { showScreen('listen'); __cReseed(); startListenLevel('easy'); }); await sleep(1200); });
  await step('listen_reveal', async () => { await pg.evaluate(() => listenAnswer(listenQ.opts.findIndex(o => o.cn === listenQ.word.cn))); await sleep(700); });
  await step('listen_lesson', async () => {
    await pg.waitForFunction(() => listenQ && !listenQ.answered && document.querySelectorAll('#listenScreen .listen-opts .boss-opt').length === 4, null, { timeout: 15000 });
    await pg.evaluate(() => listenAnswer(listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn)));
    await pg.waitForFunction(() => document.getElementById('hml_lesson'), null, { timeout: 6000 }).catch(() => {});
    await sleep(500);
  });
  await step('cloze_q', async () => { await island(); await pg.evaluate(() => { showScreen('cloze'); __cReseed(); startClozeLevel('easy'); }); await sleep(1000); });
  await step('cloze_reveal', async () => { await pg.evaluate(() => clozeAnswer(clozeQ.opts.findIndex(o => o.en === clozeQ.word.en))); await sleep(700); });
  await step('speed_q', async () => { await island(); await pg.evaluate(() => { startSpeed(); __cReseed(); startSpeedLevel('easy'); }); await sleep(900); });
  await step('result', async () => {
    await island();
    await pg.evaluate(() => { showScreen('listen'); listenActive = true; listenRight = 7; listenTotal = 8; listenComplete(); scrollTo(0, 0); });
    await sleep(2600);
    await pg.evaluate(() => document.querySelectorAll('.confetti').forEach(c => c.remove()));
  });
  await step('settings', async () => { await island(); await pg.evaluate(() => showScreen('settings')); await sleep(1500); });
  await ctx.close();
  return { out, errs };
}

const names = Object.keys(PRESETS).filter(n => !ONLY.length || ONLY.includes(n));
const all = {};
{
  const queue = [...names];
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    while (queue.length) { const n = queue.shift(); const t = Date.now(); all[n] = await runPreset(n); console.log(`  · ${n} 量完（${Math.round((Date.now() - t) / 1000)} 秒）`); }
  }));
}

/* 汇总：同一主题、同一画面、同一路径的字取最差的那一段 */
const current = {};   // key → { ratio, need, n, text, fg, bg, shadow }
let totalRuns = 0, totalFail = 0;
console.log('\n▶ C1 每个画面都画出来了');
for (const n of names) {
  const { out, errs } = all[n];
  for (const [sid, m] of Object.entries(out)) {
    ok(m.n >= MIN_RUNS, `${n} / ${sid}：量到 ${m.n} 段字${m.err ? '（出错：' + m.err + '）' : ''}`);
    totalRuns += m.n;
    for (const r of m.res) {
      if (!r.fail) continue;
      totalFail++;
      const k = `${n}|${sid}|${r.path}`;
      const c = current[k];
      if (!c) current[k] = { ratio: r.ratio, need: r.need, n: 1, text: r.text, fg: r.fg, bg: r.bg, shadow: r.shadow };
      else { c.n++; if (r.ratio < c.ratio) Object.assign(c, { ratio: r.ratio, need: r.need, text: r.text, fg: r.fg, bg: r.bg, shadow: r.shadow }); }
    }
  }
  if (errs.length) console.log(`    （${n} 页面报错 ${errs.length} 条，比如：${errs[0]}）`);
}
console.log(`    共 ${names.length} 套主题、${totalRuns} 段字，不达标 ${totalFail} 段（${Object.keys(current).length} 个不同位置）`);
if (process.env.CONTRAST_JSON) fs.writeFileSync(process.env.CONTRAST_JSON, JSON.stringify({ all: Object.fromEntries(names.map(n => [n, all[n].out])), current }, null, 1));

if (WRITE && fails) {
  console.log('\n⛔ 有画面没量到，拒绝重写基线（坏的一次测量不能变成基线）');
} else if (WRITE) {
  const entries = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
  const doc = { _说明: '对比度基线：v1166 时已知不达标的字（主题 2.0 要一个个消掉）。test_contrast_scan_v1166.mjs 只拦「新冒出来的」和「比这里更差的」。更新方法见 攻坚笔记/gates/GATES.md。',
    version: VERSION, generated: new Date().toISOString().slice(0, 10), tolerance: TOL, presets: names, screens: Object.keys(all[names[0]].out),
    totals: { runs: totalRuns, failingRuns: totalFail, failingKeys: Object.keys(entries).length }, entries };
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, JSON.stringify(doc, null, 1) + '\n');
  console.log(`\n📝 已重写基线：${Object.keys(entries).length} 个已知不达标位置 → ${path.relative(ROOT, BASELINE)}`);
} else {
  console.log('\n▶ C2/C3 和基线比：不许多、不许更差');
  let base = null;
  try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (e) {}
  ok(!!base && base.entries, `基线文件在（${path.relative(ROOT, BASELINE)}）`);
  if (base && base.entries) {
    const tol = typeof base.tolerance === 'number' ? base.tolerance : TOL;
    const news = [], worse = [], fixed = [];
    for (const [k, c] of Object.entries(current)) {
      const b = base.entries[k];
      if (!b) news.push([k, c]);
      else if (c.ratio < b.ratio - tol) worse.push([k, c, b]);
    }
    for (const [k, b] of Object.entries(base.entries)) if (!current[k] && names.includes(k.split('|')[0])) fixed.push([k, b]);
    for (const [k, c] of news.slice(0, 20)) console.log(`    🆕 ${k}  「${c.text}」 ${c.ratio}:1（要 ${c.need}）字 ${c.fg} 底 ${c.bg}`);
    for (const [k, c, b] of worse.slice(0, 20)) console.log(`    📉 ${k}  「${c.text}」 ${b.ratio} → ${c.ratio}:1`);
    ok(news.length === 0, `C2 没有新冒出来的看不清的字（新增 ${news.length} 处）`);
    ok(worse.length === 0, `C3 基线里的字没有变得更差（低于基线 ${tol} 以上：${worse.length} 处）`);
    if (fixed.length) console.log(`    🎉 ${fixed.length} 处已经达标了，可以从基线删掉（比如 ${fixed[0][0]}）—— 跑一次 CONTRAST_WRITE_BASELINE=1 再人工核对 diff`);
  }
}
console.log(`\n用时 ${Math.round((Date.now() - T_START) / 1000)} 秒`);
console.log(fails ? `❌ 对比度闸门：${fails} 项失败` : '✅ 对比度闸门：所有画面都量到了，没有新的、也没有更差的看不清的字');
srv.close();
await browser.close();
process.exit(fails ? 1 : 0);
