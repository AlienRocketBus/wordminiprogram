import { chromium } from '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/VERSION') { res.writeHead(200); return res.end('1163'); } const fp = path.join(ROOT, path.normalize(p)); fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(d); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch();
async function pg(file, vp) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof startMoles === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} window.speak = function () {}; });
  return { ctx, page };
}
for (const w of [390, 360]) {
  const { ctx, page } = await pg('island_question.html', { width: w, height: 780 });
  const r = await page.evaluate(async () => {
    startMoles(); startMolesLevel('hard'); await new Promise(r => setTimeout(r, 900));
    const out = []; const all = [];
    for (let k = 0; k < 12; k++) {
      document.querySelectorAll('.mole-cn').forEach(e => { all.push(e.textContent); if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) out.push(e.textContent + ' ' + e.scrollWidth + '>' + e.clientWidth); });
      molesTarget = allW[[...Array(allW.length).keys()].filter(MOLES_LEVELS.hard.filter)[k % 5]]; molesAnimals = pickNineAnimals(molesTarget); renderMolesSlots(molesAnimals, false);
    }
    const slot = document.getElementById('moleSlot0').getBoundingClientRect();
    return { over: [...new Set(out)], n: new Set(all).size, slotW: slot.width };
  });
  console.log('moles', w, JSON.stringify(r).slice(0, 400));
  await ctx.close();
}
{
  const { ctx, page } = await pg('island_question.html', { width: 360, height: 640 });
  const r = await page.evaluate(async () => { showTypingMenu(); startTyping(3); await new Promise(r => setTimeout(r, 500)); const keys = [...document.querySelectorAll('.keyboard .key')]; const b = Math.max(...keys.map(k => k.getBoundingClientRect().bottom)); const kb = document.querySelector('.keyboard').getBoundingClientRect(); return { lowest: b, kbTop: kb.top, kbBottom: kb.bottom, ih: innerHeight, scrollY, bodyPos: getComputedStyle(document.body).position, docH: document.documentElement.scrollHeight }; });
  console.log('typing 360x640', JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, page } = await pg('island_family.html', { width: 360, height: 640 });
  const r = await page.evaluate(async () => { startBubble(); startBubbleLevel('hard'); const bad = []; for (let t = 0; t < 30; t++) { await new Promise(r => setTimeout(r, 120)); const a = document.getElementById('bbArea').getBoundingClientRect(); document.querySelectorAll('#bbArea .bubble').forEach(b => { const r = b.getBoundingClientRect(); if (r.left < a.left - 1 || r.right > a.right + 1 || r.top < a.top - 1 || r.bottom > a.bottom + 1) bad.push(b.textContent + ' L' + Math.round(r.left - a.left) + ' R' + Math.round(a.right - r.right) + ' T' + Math.round(r.top - a.top) + ' B' + Math.round(a.bottom - r.bottom)); }); if (t === 15) nextBubble(); } return { bad: [...new Set(bad)].slice(0, 10), area: document.getElementById('bbArea').getBoundingClientRect().width }; });
  console.log('bubble 360', JSON.stringify(r));
  await ctx.close();
}
await browser.close(); srv.close();
