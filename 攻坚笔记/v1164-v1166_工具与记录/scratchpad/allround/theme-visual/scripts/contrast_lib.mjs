// Pixel-true contrast: screenshot with text hidden gives the real local background under every text run.
import { TV, sleep } from './lib.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const COLLECT = () => {
  const out = []; let id = 0;
  const vw = innerWidth, vh = innerHeight;
  const hasLetters = s => /[A-Za-z0-9一-鿿]/.test(s);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  let n;
  while ((n = walker.nextNode())) {
    const t = n.nodeValue; if (!t || !t.trim() || !hasLetters(t)) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue;
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|OPTION)$/.test(el.tagName)) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const rects = [...r.getClientRects()].filter(q => q.width > 2 && q.height > 4);
    if (!rects.length) continue;
    // union of rects clipped to viewport
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of rects) { x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom); }
    if (x1 <= 0 || y1 <= 0 || x0 >= vw || y0 >= vh) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    // opacity chain + hit test (is it actually on top?)
    let op = 1, e = el, hidden = false;
    while (e && e.nodeType === 1) { const c = getComputedStyle(e); op *= parseFloat(c.opacity); if (c.visibility === 'hidden' || c.display === 'none') hidden = true; e = e.parentElement; }
    if (hidden || op < 0.05) continue;
    const cx = Math.min(vw - 1, Math.max(0, (rects[0].left + rects[0].right) / 2)), cy = Math.min(vh - 1, Math.max(0, (rects[0].top + rects[0].bottom) / 2));
    const top = document.elementFromPoint(cx, cy);
    const onTop = !!top && (top === el || el.contains(top) || top.contains(el));
    seen.add(el);
    const fill = cs.webkitTextFillColor;
    const clipText = (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text');
    let path = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
    let p = el.parentElement, depth = 0;
    while (p && depth < 3) { if (p.id) { path = '#' + p.id + ' ' + path; break; } p = p.parentElement; depth++; }
    out.push({ id: id++, text: t.trim().slice(0, 40), path, x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(vw, x1), y1: Math.min(vh, y1),
      color: cs.color, fill, clipText, size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight) || 400, op: +op.toFixed(3),
      shadow: cs.textShadow !== 'none' ? cs.textShadow.slice(0, 60) : '', stroke: cs.webkitTextStrokeWidth, onTop, font: cs.fontFamily.split(',')[0].replace(/["']/g, '') });
  }
  return out;
};
const SEL = ':is(#tvA#tvB#tvC#tvD#tvE,*)';
const HIDE_CSS = `${SEL},${SEL}::before,${SEL}::after,${SEL}::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important;caret-color:transparent!important}`;
const HIDE_INLINE = () => { const saved = []; for (const el of document.querySelectorAll('[style*="important"]')) { const s = el.getAttribute('style'); if (/color|text-shadow|text-stroke/i.test(s)) { saved.push([el, s]); el.style.setProperty('color', 'transparent', 'important'); el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); el.style.setProperty('text-shadow', 'none', 'important'); el.style.setProperty('-webkit-text-stroke-width', '0', 'important'); } } window.__tvSaved = saved; return saved.length; };
const RESTORE_INLINE = () => { for (const [el, s] of (window.__tvSaved || [])) el.setAttribute('style', s); window.__tvSaved = null; };

export async function measureContrast(pg, name, opts = {}) {
  // freeze CSS animations/transitions so both shots line up
  const freeze = await pg.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;transition:none!important}' });
  await sleep(120);
  const els = await pg.evaluate(COLLECT);
  const a = `${TV}/shots/${name}.png`;
  await pg.screenshot({ path: a });
  const hide = await pg.addStyleTag({ content: HIDE_CSS });
  await pg.evaluate(HIDE_INLINE);
  await sleep(80);
  const b = `${TV}/out/bg_${name}.png`;
  await pg.screenshot({ path: b });
  await hide.evaluate(n => n.remove());
  await pg.evaluate(RESTORE_INLINE);
  await freeze.evaluate(n => n.remove());
  const jf = `${TV}/out/els_${name}.json`;
  fs.writeFileSync(jf, JSON.stringify(els));
  const res = execFileSync('python3', ['-I', `${TV}/scripts/contrast.py`, jf, b, a], { encoding: 'utf8', maxBuffer: 64e6 });
  const r = JSON.parse(res);
  fs.writeFileSync(`${TV}/out/contrast_${name}.json`, JSON.stringify(r, null, 1));
  try { fs.unlinkSync(b); fs.unlinkSync(jf); } catch (e) {}
  return r;
}
