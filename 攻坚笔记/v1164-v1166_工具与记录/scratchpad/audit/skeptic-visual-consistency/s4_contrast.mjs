// VC-03 (light palette contrast) and VC-12 (dark theme contrast) — independent pixel-sampled contrast measurement.
// usage: node s4_contrast.mjs cloud|dark
import { startServer, launch, newCtx, attachLogs, sleep, waitFor, tapSel, tapText, external, OUT, saveJson, contrast, parseRgb } from './lib.mjs';
const MODE = process.argv[2] || 'cloud';
const PAL = MODE === 'dark' ? '' : MODE;
const out = { mode: MODE, m: [], notes: [] };
const errs = [];
const { srv, base } = await startServer();
const browser = await launch();
const ISL = 'island_animal.html';
let decoder;
async function openIsland(page) {
  await page.goto('about:blank');
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await sleep(1800);
  const t = await tapSel(page, page, `a.island[href="${ISL}"]`);
  if (!t.tapped) throw new Error('island tap failed ' + JSON.stringify(t));
  await waitFor(async () => { const f = page.frames().find(f => f.url().includes(ISL)); if (!f) return null; return await f.evaluate(() => document.readyState === 'complete').catch(() => false); }, 15000);
  await sleep(2200);
  const frame = page.frames().find(f => f.url().includes(ISL));
  const shown = await frame.evaluate(() => { const m = document.getElementById('alertModal'); return !!(m && m.classList.contains('show')); });
  if (shown) { await tapText(page, frame, '#alertModal button', '开始冒险'); await sleep(700); }
  return frame;
}
// Find a visible element whose OWN text matches; hide its text; screenshot its box; median bg; compute contrast.
async function measure(page, frame, label, src, opts = {}) {
  const info = await frame.evaluate(({ src, nth, scope }) => {
    const r = new RegExp(src);
    const root = scope ? document.querySelector(scope) : document.body;
    if (!root) return { err: 'no scope ' + scope };
    const cands = Array.from(root.querySelectorAll('*')).filter(e => {
      const own = Array.from(e.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      if (!own || !r.test(own)) return false;
      const b = e.getBoundingClientRect(); if (b.width <= 0 || b.height <= 0) return false;
      const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none';
    });
    const e = cands[nth || 0]; if (!e) return { err: 'not found', n: cands.length };
    e.scrollIntoView({ block: 'center', behavior: 'auto' });
    const cs = getComputedStyle(e);
    let op = 1; for (let p = e; p && p.nodeType === 1; p = p.parentElement) op *= parseFloat(getComputedStyle(p).opacity);
    document.querySelectorAll('[data-skm]').forEach(x => x.removeAttribute('data-skm'));
    e.setAttribute('data-skm', '1');
    return { text: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 50), color: cs.color, fill: cs.webkitTextFillColor, bgclip: cs.webkitBackgroundClip, fs: cs.fontSize, fw: cs.fontWeight, shadow: cs.textShadow.slice(0, 90), op, n: cands.length };
  }, { src, nth: opts.nth || 0, scope: opts.scope || null });
  if (info.err) { out.m.push({ label, err: info.err, n: info.n }); return null; }
  await sleep(250);
  const rect = await frame.evaluate(() => { const e = document.querySelector('[data-skm]'); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const fe = await frame.frameElement().catch(() => null); let ox = 0, oy = 0; if (fe) { const b = await fe.boundingBox(); ox = b.x; oy = b.y; }
  // hide own text of element (keep its own background), screenshot
  await frame.evaluate(() => { const e = document.querySelector('[data-skm]'); e.__skOld = e.getAttribute('style'); e.style.setProperty('color', 'transparent', 'important'); e.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); e.style.setProperty('text-shadow', 'none', 'important'); e.style.setProperty('caret-color', 'transparent', 'important'); });
  await sleep(120);
  const clip = { x: Math.max(0, rect.x + ox), y: Math.max(0, rect.y + oy), width: Math.max(2, Math.min(rect.w, 390 - rect.x)), height: Math.max(2, Math.min(rect.h, 844 - rect.y)) };
  let bg = null;
  try {
    const buf = await page.screenshot({ clip });
    bg = await decoder.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; const R = [], G = [], B = [];
      for (let i = 0; i < d.length; i += 4) { R.push(d[i]); G.push(d[i + 1]); B.push(d[i + 2]); }
      const med = a => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
      return [med(R), med(G), med(B)];
    }, buf.toString('base64'));
  } catch (e) { bg = null; out.notes.push(label + ' clip error ' + e.message); }
  await frame.evaluate(() => { const e = document.querySelector('[data-skm]'); if (e.__skOld == null) e.removeAttribute('style'); else e.setAttribute('style', e.__skOld); e.removeAttribute('data-skm'); });
  let fg = parseRgb(info.fill && info.fill !== 'rgba(0, 0, 0, 0)' ? info.fill : info.color);
  let ratio = null;
  if (fg && bg) {
    const a = (fg[3] == null ? 1 : fg[3]) * info.op;
    const comp = [0, 1, 2].map(i => Math.round(fg[i] * a + bg[i] * (1 - a)));
    ratio = Math.round(contrast(comp, bg) * 100) / 100;
  }
  const rec = { label, text: info.text, fg: info.fill && info.fill !== 'rgba(0, 0, 0, 0)' ? info.fill : info.color, op: info.op, bg, ratio, fs: info.fs, fw: info.fw, shadow: info.shadow, rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) } };
  out.m.push(rec);
  return rec;
}
try {
  const init = PAL ? { fn: (p) => { try { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hansen_palette_global', p); } catch (e) { } }, arg: PAL } : { fn: () => { try { localStorage.setItem('hansen_onboarded', '1'); } catch (e) { } } };
  const ctx = await newCtx(browser, { dsf: 1, init });
  decoder = await ctx.newPage(); await decoder.goto('about:blank');
  const page = await ctx.newPage(); attachLogs(page, 'p', errs);
  let frame = await openIsland(page);
  out.htmlClass = await frame.evaluate(() => document.documentElement.className);
  if (MODE === 'dark') {
    await measure(page, frame, 'daily 每日任务', '^每日任务$');
    await measure(page, frame, 'daily 每日宝箱', '^每日宝箱$');
    await measure(page, frame, 'mode 听音辨义', '^听音辨义$');
    await measure(page, frame, 'mode 探索单词', '^探索单词$');
    await page.screenshot({ path: OUT + `/shots/s4_${MODE}_island_top.png` });
  }
  // 1. 错题总览
  await tapSel(page, frame, '#navExplore'); await sleep(1200);
  await measure(page, frame, '错题 empty text', '所有岛屿都没有错题');
  await measure(page, frame, '错题 back arrow', '^←$', { scope: '#hwo_overlay' });
  await measure(page, frame, '错题 footnote .hwo_btm', '点击任意岛屿', { scope: '#hwo_overlay' });
  await page.screenshot({ path: OUT + `/shots/s4_${MODE}_wrong.png` });
  await tapSel(page, frame, '#hwo_overlay .hwo_back'); await sleep(500);
  // 2. 卡册 (this is the 1st visit; open island again for freepass 20/20 state)
  frame = await openIsland(page);
  await tapSel(page, frame, '#navCards'); await sleep(1400);
  await measure(page, frame, '卡册 已收集 line', '已收集');
  await measure(page, frame, '卡册 全部集齐', '全部集齐');
  await page.screenshot({ path: OUT + `/shots/s4_${MODE}_cards.png` });
  const s = await tapText(page, frame, 'button, div[onclick], a, [role="button"]', '神秘殿堂'); await sleep(1500);
  await measure(page, frame, '神秘殿堂 title', '^神秘殿堂$', { nth: 0 });
  await measure(page, frame, '神秘殿堂 desc', '历代赛季限定卡的殿堂');
  await measure(page, frame, '神秘殿堂 card name', '铸星者');
  await page.screenshot({ path: OUT + `/shots/s4_${MODE}_season_hall.png` });
  // 3. Boss select
  frame = await openIsland(page);
  await tapText(page, frame, '.daily-card', '挑战'); await sleep(2500);
  await measure(page, frame, 'boss 已击败', '已击败');
  await measure(page, frame, 'boss 特效', '^特效$');
  await page.screenshot({ path: OUT + `/shots/s4_${MODE}_boss.png` });
  // 4. listen
  frame = await openIsland(page);
  await tapText(page, frame, '.mode-card', '听音辨义'); await sleep(1300);
  await page.screenshot({ path: OUT + `/shots/s4_${MODE}_listen_pick.png` });
  const e1 = await tapText(page, frame, '#listenScreen *', '初级'); await sleep(1600);
  out.notes.push('listen easy tap ' + JSON.stringify(e1).slice(0, 160));
  await measure(page, frame, 'listen 1 / N', '^\\s*1\\s*/\\s*\\d+\\s*$', { scope: '#listenScreen' });
  await measure(page, frame, 'listen 第 1 轮', '第\\s*1\\s*轮', { scope: '#listenScreen' });
  await page.screenshot({ path: OUT + `/shots/s4_${MODE}_listen_play.png` });
  // 5. typing
  frame = await openIsland(page);
  await tapText(page, frame, '.mode-card', '打字大师'); await sleep(1500);
  await measure(page, frame, 'typing 尚无记录', '尚无记录');
  await measure(page, frame, 'typing reward', '奖励|金币|💎', { scope: '#typingScreen' });
  await page.screenshot({ path: OUT + `/shots/s4_${MODE}_typing.png` });
  // 6. gacha
  frame = await openIsland(page);
  await tapText(page, frame, '.mode-card', '抽卡'); await sleep(1500);
  await measure(page, frame, 'gacha 已收集', '已收集');
  await measure(page, frame, 'gacha rate row', '%', { nth: 0 });
  await measure(page, frame, 'gacha rate row 2', '%', { nth: 1 });
  await page.screenshot({ path: OUT + `/shots/s4_${MODE}_gacha.png` });
  // 7. 我的学习
  frame = await openIsland(page);
  await tapText(page, frame, '.util-card', '我的学习'); await sleep(1300);
  await measure(page, frame, '我的学习 0 / 42', '^\\s*0\\s*/\\s*42', { scope: '#hsn-ml' });
  await measure(page, frame, '我的学习 已掌握', '已掌握', { scope: '#hsn-ml' });
  await page.screenshot({ path: OUT + `/shots/s4_${MODE}_mylearning.png` });
  await page.close(); await ctx.close();
} catch (e) { out.fatal = String(e && e.stack || e); }
out.errs = errs.slice(0, 30); out.external = external.slice(0, 30);
saveJson(`s4_contrast_${MODE}.json`, out);
await browser.close(); srv.close();
for (const r of out.m) console.log(r.err ? `${r.label}: ERR ${r.err} (${r.n})` : `${r.label} | "${r.text}" | fg ${r.fg} op ${r.op} bg ${r.bg} => ${r.ratio}:1 | ${r.fs} w${r.fw} | sh ${r.shadow.slice(0, 40)}`);
console.log(JSON.stringify({ notes: out.notes, fatal: out.fatal, htmlClass: out.htmlClass, errs: out.errs.length }, null, 1));
