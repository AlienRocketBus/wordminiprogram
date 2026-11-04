// VC-11 (pink home hero contrast incl. halo), VC-15 (land subtitle at runtime), mylearning "已点亮" count
import { startServer, launch, newCtx, attachLogs, sleep, waitFor, tapSel, tapText, external, OUT, saveJson, contrast, parseRgb } from './lib.mjs';
const out = { m: [] };
const errs = [];
const { srv, base } = await startServer();
const browser = await launch();
try {
  const ctx = await newCtx(browser, { dsf: 2, init: { fn: () => { try { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('theme', 'pink'); } catch (e) { } } } });
  const decoder = await ctx.newPage(); await decoder.goto('about:blank');
  const page = await ctx.newPage(); attachLogs(page, 'p', errs);
  await page.goto(base + '/index.html', { waitUntil: 'load' }); await sleep(2500);
  // For each target: crop text box with text visible and hidden; report fill-vs-bg ratio AND darkest/brightest pixel share (halo effect)
  const targets = [['.tagline', 0], ['.subtitle', 0], ['.feedback-sub', 0], ['.how-step .num, .how-step [class*="num"]', 0]];
  for (const [sel, idx] of targets) {
    const r = await page.evaluate(({ sel, idx }) => { const e = document.querySelectorAll(sel)[idx]; if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: b.left, y: b.top, w: b.width, h: b.height, fill: cs.webkitTextFillColor, color: cs.color, shadow: cs.textShadow.slice(0, 120), text: (e.innerText || '').slice(0, 30) }; }, { sel, idx });
    if (!r) { out.m.push({ sel, err: 'none' }); continue; }
    await sleep(300);
    const rr = await page.evaluate(({ sel, idx }) => { const e = document.querySelectorAll(sel)[idx]; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }, { sel, idx });
    const clip = { x: Math.max(0, rr.x), y: Math.max(0, rr.y), width: Math.min(rr.w, 390), height: rr.h };
    const vis = await page.screenshot({ clip });
    await page.evaluate(({ sel, idx }) => { const e = document.querySelectorAll(sel)[idx]; e.style.setProperty('color', 'transparent', 'important'); e.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); e.style.setProperty('text-shadow', 'none', 'important'); e.style.setProperty('filter', 'none', 'important'); }, { sel, idx });
    await sleep(150);
    const hid = await page.screenshot({ clip });
    await page.evaluate(({ sel, idx }) => { const e = document.querySelectorAll(sel)[idx]; e.style.removeProperty('color'); e.style.removeProperty('-webkit-text-fill-color'); e.style.removeProperty('text-shadow'); e.style.removeProperty('filter'); }, { sel, idx });
    const stat = await decoder.evaluate(async ([a, b]) => {
      const load = async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
      const A = await load(a), B = await load(b);
      const R = [], G = [], Bl = []; for (let i = 0; i < B.length; i += 4) { R.push(B[i]); G.push(B[i + 1]); Bl.push(B[i + 2]); }
      const med = q => { q.sort((p, s) => p - s); return q[q.length >> 1]; };
      const bg = [med(R), med(G), med(Bl)];
      const L = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const Lbg = L(bg); let changed = 0, darkHalo = 0, best = 1;
      for (let i = 0; i < A.length; i += 4) { const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); if (d > 30) { changed++; const l = L([A[i], A[i + 1], A[i + 2]]); const cr = (Math.max(l, Lbg) + 0.05) / (Math.min(l, Lbg) + 0.05); if (cr > best) best = cr; if (l < Lbg && cr >= 3) darkHalo++; } }
      return { bg, changed, darkHaloShare: changed ? Math.round(darkHalo / changed * 100) : 0, maxPixelContrast: Math.round(best * 100) / 100 };
    }, [vis.toString('base64'), hid.toString('base64')]);
    const fg = parseRgb(r.fill && r.fill !== 'rgba(0, 0, 0, 0)' ? r.fill : r.color);
    out.m.push({ sel, text: r.text, fg: r.fill, shadow: r.shadow, bg: stat.bg, fillRatio: fg ? Math.round(contrast(fg, stat.bg) * 100) / 100 : null, darkHaloPixelsPct: stat.darkHaloShare, maxPixelContrast: stat.maxPixelContrast });
  }
  await page.close();
  // VC-15: land4 subtitle at runtime (direct open)
  const p2 = await ctx.newPage(); attachLogs(p2, 'land4', errs);
  await p2.goto(base + '/island_land4.html', { waitUntil: 'load' }); await sleep(2500);
  out.land4 = await p2.evaluate(() => { const els = Array.from(document.querySelectorAll('#homeScreen div')).filter(d => /STAR SEA|WORD CONTINENT|ISLAND/i.test(d.textContent) && d.children.length === 0); return els.map(d => { const b = d.getBoundingClientRect(); return { t: d.textContent.trim(), vis: getComputedStyle(d).visibility, disp: getComputedStyle(d).display, y: Math.round(b.top), h: Math.round(b.height) }; }); });
  out.land4Title = await p2.evaluate(() => { const h = document.querySelector('#homeScreen > div:first-child'); return h ? h.innerText.replace(/\s+/g, ' ').slice(0, 80) : null; });
  await p2.screenshot({ path: OUT + '/shots/s5_land4_top.png' });
  await p2.close();
  await ctx.close();
} catch (e) { out.fatal = String(e && e.stack || e); }
out.errs = errs.slice(0, 20); out.external = external.slice(0, 20);
saveJson('s5_misc.json', out);
await browser.close(); srv.close();
console.log(JSON.stringify(out, null, 1).slice(0, 6000));
