// VC-13 (island-en overflow/clipping at 360 & orphans), VC-10 (door flash in light palette)
import { startServer, launch, newCtx, attachLogs, sleep, waitFor, tapSel, tapText, served, external, OUT, saveJson } from './lib.mjs';
const out = {};
const errs = [];
const { srv, base } = await startServer();
const browser = await launch();
try {
  // ---- 360px default theme grid ----
  {
    const ctx = await newCtx(browser, { width: 360, height: 780, dsf: 2, init: { fn: () => { try { localStorage.setItem('hansen_onboarded', '1'); } catch (e) { } } } });
    const page = await ctx.newPage(); attachLogs(page, 'home360', errs);
    await page.goto(base + '/index.html', { waitUntil: 'load' }); await sleep(2500);
    await page.evaluate(() => { const g = document.querySelector('.islands'); g && g.scrollIntoView({ block: 'start' }); });
    await sleep(500);
    await page.screenshot({ path: OUT + '/shots/s2_360_grid.png' });
    out.grid360 = await page.evaluate(() => Array.from(document.querySelectorAll('a.island')).map(a => {
      const en = a.querySelector('.island-en'), nm = a.querySelector('.island-name');
      const ar = a.getBoundingClientRect(), er = en.getBoundingClientRect();
      const ncs = getComputedStyle(nm); const lh = parseFloat(ncs.lineHeight) || parseFloat(ncs.fontSize) * 1.2;
      const acs = getComputedStyle(a);
      // range-based text extent of EN label
      const rg = document.createRange(); rg.selectNodeContents(en); const rr = rg.getBoundingClientRect();
      return { name: nm.textContent, nameLines: Math.round(nm.getBoundingClientRect().height / lh), en: en.textContent, enBox: Math.round(er.width), enSW: en.scrollWidth, enTextL: Math.round(rr.left - ar.left), enTextR: Math.round(ar.right - rr.right), cardOverflow: acs.overflow, cardW: Math.round(ar.width) };
    }));
    out.scrollW360 = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    await page.close(); await ctx.close();
  }
  // ---- door flash in cloud palette ----
  {
    const ctx = await newCtx(browser, { width: 390, height: 844, dsf: 1, init: { fn: () => { try { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hansen_palette_global', 'cloud'); } catch (e) { } } } });
    const page = await ctx.newPage(); attachLogs(page, 'door', errs);
    await page.goto(base + '/index.html', { waitUntil: 'load' }); await sleep(2500);
    out.doorHtmlClass = await page.evaluate(() => document.documentElement.className);
    // Use real tap on food island card, then sample wrap/iframe state in rapid succession
    const samples = [];
    const tapP = tapSel(page, page, 'a.island[href="island_food.html"]');
    const t0 = Date.now();
    await tapP;
    for (let i = 0; i < 14; i++) {
      const s = await page.evaluate(() => { const w = document.getElementById('islandFrameWrap'), f = document.getElementById('islandFrame'), l = document.getElementById('islandLoading'); return { wrapDisp: w.style.display, wrapBg: getComputedStyle(w).backgroundColor, fOp: f.style.opacity, loadDisp: l.style.display }; });
      s.t = Date.now() - t0; samples.push(s);
      if (i === 1 || i === 4) await page.screenshot({ path: OUT + `/shots/s2_door_cloud_${i}.png` });
      await sleep(40);
    }
    out.doorSamples = samples;
    await sleep(2500);
    await page.screenshot({ path: OUT + '/shots/s2_door_cloud_after.png' });
    // second entry to the same island (kept alive) and to another island, measure dark-visible duration
    await page.close(); await ctx.close();
  }
} catch (e) { out.fatal = String(e && e.stack || e); }
out.errs = errs; out.external = external.slice(0, 30);
saveJson('s2_grid360_door.json', out);
await browser.close(); srv.close();
console.log(JSON.stringify(out, null, 1).slice(0, 8000));
