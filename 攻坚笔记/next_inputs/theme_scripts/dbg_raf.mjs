import { newCtx, closeBrowser, sleep, BASE } from './lib.mjs';
const ctx = await newCtx({});
await ctx.route(/hansen_room_warm_v1023\.js/, r => r.abort());
await ctx.addInitScript(() => {
  window.__rafStacks = {}; const _r = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) { try { const s = (new Error().stack || '').split('\n').slice(2, 4).map(x => x.trim().replace(/\?v=\d+/, '')).join(' | '); window.__rafStacks[s] = (window.__rafStacks[s] || 0) + 1; } catch (e) {} return _r.call(window, cb); };
});
const pg = await ctx.newPage();
await pg.goto(BASE + 'index.html', { waitUntil: 'load' }); await sleep(8000);
await pg.evaluate(() => { window.__rafStacks = {}; });
await sleep(5000);
const st = await pg.evaluate(() => Object.entries(window.__rafStacks).sort((a, b) => b[1] - a[1]).slice(0, 6));
console.log(JSON.stringify(st, null, 1));
await closeBrowser();
