import { newCtx, openPage, shot, closeBrowser, sleep, save } from './lib.mjs';
import { measureContrast } from './contrast_lib.mjs';
const ctx = await newCtx({ palette: 'cosmos' });
const pg = await openPage(ctx, 'index.html', 5000);
const info = await pg.evaluate(() => {
  const vis = [...document.body.children].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map(e => ({ tag: e.tagName, id: e.id, cls: e.className && String(e.className).slice(0, 60), h: e.offsetHeight }));
  return { title: document.title, h: document.documentElement.scrollHeight, bodyCls: document.body.className, theme: document.body.dataset.theme, htmlCls: document.documentElement.className, vis: vis.slice(0, 60), anims: document.getAnimations().length, fontsLoaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family) };
});
console.log(JSON.stringify(info, null, 1).slice(0, 4000));
const r = await measureContrast(pg, 'x01_home_cosmos');
console.log(JSON.stringify(r.summary, null, 1).slice(0, 3000));
await shot(pg, 'x01_home_cosmos_full', { full: true });
console.log('errs', pg.__errs);
await closeBrowser();
