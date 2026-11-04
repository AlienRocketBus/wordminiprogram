import { launch, sleep, BASE } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
await page.goto(BASE + 'index.html'); await sleep(14000);
const r = await page.evaluate(() => {
  const imgs = [...document.images].filter(i => i.complete && i.getBoundingClientRect().width > 0).map(i => i.currentSrc.split('/').pop());
  const svgAnim = document.querySelectorAll('animate,animateTransform,animateMotion').length;
  const vids = document.querySelectorAll('video,canvas').length;
  const anims = document.getAnimations().filter(a => a.playState === 'running').map(a => (a.animationName || a.transitionProperty || 'js') + '@' + ((a.effect && a.effect.target && (a.effect.target.id || a.effect.target.className)) || '').toString().slice(0, 40));
  return { imgs: [...new Set(imgs)].slice(0, 60), svgAnim, vids, anims, rest: document.documentElement.className };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
