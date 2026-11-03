// 预热会不会偷偷写进度：同样进一次美食岛，开/关房间预热，比 localStorage
import { launch, sleep, BASE } from './lib.mjs';
async function run(block) {
  const { browser, ctx } = await launch({ init: () => { try { if (!sessionStorage.getItem('_x')) { localStorage.clear(); localStorage.setItem('hansen_onboarded','1'); sessionStorage.setItem('_x','1'); } } catch(e){} } });
  if (block) await ctx.route(/hansen_room_warm_v1023\.js/, r => r.abort());
  const page = await ctx.newPage(); page.on('dialog', d => d.dismiss().catch(()=>{}));
  await page.goto(BASE + 'index.html'); await sleep(6000);
  await page.evaluate(() => window.openIsland('island_food.html'));
  await sleep(25000);
  const ls = await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = (localStorage.getItem(k) || '').slice(0, 160); } return o; });
  await browser.close();
  return ls;
}
const a = await run(false), b = await run(true);
const onlyA = Object.keys(a).filter(k => !(k in b));
console.log('keys only when warming:', onlyA.length);
for (const k of onlyA) console.log('  ', k, '=', a[k].slice(0, 120));
console.log('hsn_progress keys (warm):', Object.keys(a).filter(k => k.startsWith('hsn_progress:')));
console.log('hsn_progress keys (nowarm):', Object.keys(b).filter(k => k.startsWith('hsn_progress:')));
console.log('wordIsland keys (warm):', Object.keys(a).filter(k => k.startsWith('wordIsland')));
