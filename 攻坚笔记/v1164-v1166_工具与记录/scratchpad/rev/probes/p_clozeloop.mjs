import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const ROOT = process.env.PROBE_ROOT || '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/VERSION') { res.writeHead(200); return res.end(fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim()); } if (p.endsWith('/')) p += 'index.html'; const fp = path.join(ROOT, path.normalize(p)); fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(d); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
await page.goto(BASE + 'island_animal.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.HansenReview && document.readyState !== 'loading' && typeof startListen === 'function', null, { timeout: 30000 });
await page.waitForTimeout(700);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click();
  window.__w = (fn, ms = 9000) => new Promise((res) => { const t0 = Date.now(); (function loop() { let v = false; try { v = fn(); } catch (e) {} if (v) return res(v); if (Date.now() - t0 > ms) return res(false); setTimeout(loop, 60); })(); });
  window.__card = () => { const el = document.getElementById('hml_lesson'); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
  window.__tapCard = () => { const el = document.getElementById('hml_lesson'); if (el) el.click(); return !!el; };
});
for (let run = 0; run < 6; run++) {
  const r = await page.evaluate(async () => {
    const log = []; const t0 = performance.now(); const T = () => Math.round(performance.now() - t0);
    startCloze(); startClozeLevel('easy');
    clozePool.splice(0, Math.max(0, clozePool.length - 1));
    const miss = clozeQ.word; const opts = [...document.querySelectorAll('#clozeScreen .cloze-opt')];
    opts[clozeQ.opts.findIndex(o => o.en !== miss.en)].click();
    const card = await __w(__card, 2000); const tapped = __tapCard();
    log.push(T() + ' card=' + !!card + ' tapped=' + tapped + ' active=' + clozeActive + ' q=' + (clozeQ && clozeQ.word.en) + ' pool=' + clozePool.length);
    const seen = [];
    for (let k = 0; k < 4 && clozeActive; k++) {
      await __w(() => { const o = document.querySelector('#clozeScreen .cloze-opt'); return o && !o.dataset.done; }, 9000);
      if (!clozeActive) { log.push(T() + ' inactive after wait'); break; }
      seen.push(clozeQ.word.en);
      document.querySelectorAll('#clozeScreen .cloze-opt')[clozeQ.opts.findIndex(o => o.en === clozeQ.word.en)].click();
      await __w(() => !clozeActive || !document.querySelector('#clozeScreen .cloze-opt[data-done]'), 9000);
    }
    return { miss: miss.en, seen, done: clozeDone, log };
  });
  console.log(run, JSON.stringify(r));
  await page.evaluate(() => showScreen('home'));
  await page.waitForTimeout(500);
}
console.log('errs', errs);
await browser.close(); srv.close();
