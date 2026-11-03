// S7: small checks. (a) season_showcase / boss_hall opened top-level at 360/390 vs inside an iframe,
// (b) island_food (room-warm switched off at the server, to keep CPU low) — visible mode cards vs the welcome text.
import fs from 'node:fs';
import { startServer } from './srv.mjs';
import { launch, newCtx } from './lib.mjs';

const A = "if (document.readyState === 'complete') scheduleWarm();\n  else window.addEventListener('load', scheduleWarm);";
const { srv, port } = await startServer({ patch: { '/hansen_room_warm_v1023.js': s => s.replace(A, '/* off */') } });
const ORIGIN = `http://127.0.0.1:${port}`;
const browser = await launch();
const out = {};
for (const W of [360, 390]) {
  for (const p of ['season_showcase.html?v=1163&boss=s1', 'boss_hall.html?v=1163&lv=1&own=1']) {
    const ctx = await newCtx(browser, W); const page = await ctx.newPage();
    await page.goto(`${ORIGIN}/${p}`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
    const top = await page.evaluate(() => { const c = document.getElementById('closePg') || document.querySelector('.close,#close,[aria-label*="关闭"]'); const r = c ? c.getBoundingClientRect() : null; return { iw: innerWidth, sw: document.scrollingElement.scrollWidth, vv: window.visualViewport ? Math.round(visualViewport.width) : null, close: r ? [Math.round(r.left), Math.round(r.right)] : null }; });
    await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><iframe src="${ORIGIN}/${p}" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe></body></html>`);
    await page.waitForTimeout(2500);
    const fr = page.frames()[1];
    const inIframe = await fr.evaluate(() => { const c = document.getElementById('closePg') || document.querySelector('.close,#close,[aria-label*="关闭"]'); const r = c ? c.getBoundingClientRect() : null; return { iw: innerWidth, sw: document.scrollingElement.scrollWidth, close: r ? [Math.round(r.left), Math.round(r.right)] : null }; });
    out[W + ' ' + p.split('?')[0]] = { top, inIframe };
    console.log(W, p.split('?')[0], JSON.stringify({ top, inIframe }));
    await ctx.close();
  }
}
{
  const ctx = await newCtx(browser, 390); const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(`${ORIGIN}/island_food.html`, { waitUntil: 'load' }); await page.waitForTimeout(5000);
  out.island = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#homeScreen .mode-card')];
    const vis = cards.filter(c => { const cs = getComputedStyle(c); const r = c.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; });
    const ai = document.getElementById('alertInner');
    return { cards: cards.length, visible: vis.length, names: vis.map(c => c.innerText.replace(/\s+/g, ' ').trim().slice(0, 16)), welcome: ai ? ai.innerText.replace(/\s+/g, ' ').slice(0, 160) : null, title: document.title };
  });
  console.log(JSON.stringify(out.island));
  await ctx.close();
}
fs.writeFileSync('s7_misc.json', JSON.stringify(out, null, 1));
await browser.close(); srv.close();
