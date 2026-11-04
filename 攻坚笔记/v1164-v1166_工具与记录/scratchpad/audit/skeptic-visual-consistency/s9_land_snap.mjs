// 我的学习 snapshot keys for 单词大陆 islands (title split on '·') — do land islands collide / exceed TOTAL_ISLANDS?
import { startServer, launch, newCtx, attachLogs, sleep, OUT, saveJson } from './lib.mjs';
const out = {}; const errs = [];
const { srv, base } = await startServer();
const browser = await launch();
try {
  const ctx = await newCtx(browser, { dsf: 1, init: { fn: () => { try { localStorage.setItem('hansen_onboarded', '1'); } catch (e) { } } } });
  const page = await ctx.newPage(); attachLogs(page, 'p', errs);
  const keys = () => page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.indexOf('hsn_progress:') === 0) { try { const d = JSON.parse(localStorage.getItem(k)); o[k] = d.totalWords; } catch (e) { o[k] = '?'; } } } return o; });
  for (const f of ['island_land1.html', 'island_land4.html', 'island_animal.html']) {
    await page.goto(base + '/' + f, { waitUntil: 'load' }); await sleep(4500);
    out[f] = await keys();
  }
  // open 我的学习 on animal and read lit count
  out.lit = await page.evaluate(async () => { const c = Array.from(document.querySelectorAll('.util-card')).find(e => /我的学习/.test(e.innerText)); if (c) c.click(); await new Promise(r => setTimeout(r, 1200)); const el = document.getElementById('hsn-ml'); return el ? (el.innerText.match(/已点亮[^\n]*/) || [null])[0] : null; });
  await ctx.close();
} catch (e) { out.fatal = String(e && e.stack || e); }
out.errs = errs.slice(0, 8);
saveJson('s9_land_snap.json', out);
await browser.close(); srv.close();
console.log(JSON.stringify(out, null, 1));
