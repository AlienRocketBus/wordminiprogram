// S6: land_map.html inside a full-screen same-origin iframe (as index/islands show it) at several phone widths:
// are the 8 island buttons (.spot) fully on screen?
import fs from 'node:fs';
import { startServer } from './srv.mjs';
import { launch, newCtx } from './lib.mjs';

const { srv, port } = await startServer();
const ORIGIN = `http://127.0.0.1:${port}`;
const browser = await launch();
const res = {};
for (const W of [320, 360, 375, 390, 414]) {
  const ctx = await newCtx(browser, W);
  const page = await ctx.newPage();
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><iframe id="f" src="${ORIGIN}/land_map.html?v=1163" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe></body></html>`);
  await page.waitForTimeout(3500);
  const fr = page.frames().find(f => /land_map/.test(f.url()));
  res[W] = await fr.evaluate(() => {
    const iw = innerWidth, ih = innerHeight;
    const st = document.getElementById('stage'); const sr = st.getBoundingClientRect();
    const spots = [...document.querySelectorAll('.spot')].map(b => { const r = b.getBoundingClientRect(); return { t: (b.innerText || '').replace(/\s+/g, ' ').slice(0, 14), l: Math.round(r.left), r: Math.round(r.right), cut: r.left < 0 || r.right > iw }; });
    return { iw, ih, stage: [Math.round(sr.left), Math.round(sr.width)], scrollX: scrollX, sw: document.scrollingElement.scrollWidth, cut: spots.filter(s => s.cut), n: spots.length };
  });
  if (W === 360) await page.screenshot({ path: 'shots/land_map_iframe_360.png' });
  console.log(W, JSON.stringify(res[W]));
  await ctx.close();
}
fs.writeFileSync('s6_land.json', JSON.stringify(res, null, 1));
await browser.close(); srv.close();
