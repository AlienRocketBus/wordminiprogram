import { newCtx, openPage, shot, closeBrowser, sleep, save, tapText } from './lib.mjs';
const ctx = await newCtx({ palette: 'cosmos' });
const pg = await openPage(ctx, 'island_food.html', 4500);
const a = await pg.evaluate(() => {
  const vis = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); return (s.position === 'fixed') && e.offsetWidth > 100 && e.offsetHeight > 100 && s.display !== 'none' && s.visibility !== 'hidden'; }).map(e => ({ id: e.id, cls: String(e.className).slice(0, 50), z: getComputedStyle(e).zIndex, txt: e.innerText.slice(0, 80).replace(/\s+/g, ' ') }));
  return { vis, scr: [...document.querySelectorAll('[id$=Screen]')].filter(e => e.offsetParent).map(e => e.id), h: document.documentElement.scrollHeight };
});
console.log(JSON.stringify(a, null, 1));
await shot(pg, 'x02_food_first');
const b = await tapText(pg, /开始冒险/);
console.log('tap', b);
await sleep(1200);
await shot(pg, 'x02_food_after_start');
const c = await pg.evaluate(() => ({ scr: [...document.querySelectorAll('[id$=Screen]')].filter(e => e.offsetParent).map(e => e.id), h: document.documentElement.scrollHeight, modes: [...document.querySelectorAll('.mode-card')].map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 30)) }));
console.log(JSON.stringify(c, null, 1));
console.log(pg.__errs);
await closeBrowser();
