// Mockups at 360x740 and 320x640: horizontal overflow + clipped labels + tap targets < 44px.
import { newCtx, closeBrowser, sleep, save, BASE, TV } from './lib.mjs';
const out = {};
for (const [w, h] of [[360, 740], [320, 640]]) {
  const ctx = await newCtx({}, { width: w, height: h });
  for (const page of ['home', 'island', 'answer', 'chest', 'result']) {
    for (const th of ['cosmos', 'cloud']) {
      const pg = await ctx.newPage();
      const q = page === 'answer' ? '&s=wrong' : page === 'chest' ? '&final=1' : '';
      await pg.goto(BASE + `__mock/${page}.html?theme=${th}${q}`, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready); await sleep(2600);
      const r = await pg.evaluate(() => {
        const vw = innerWidth; const docW = document.documentElement.scrollWidth;
        const clipped = [...document.querySelectorAll('.lab,.btn,.chip,.opt,.w,h1,h2,h3,b')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map(e => e.textContent.trim().slice(0, 16));
        const offRight = [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > vw + 1 && getComputedStyle(e).position !== 'fixed'; }).map(e => e.className || e.tagName).slice(0, 6);
        const small = [...document.querySelectorAll('button,.btn,.back,.nav a,.opt,.chip')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.height < 44 || b.width < 44); }).map(e => (e.textContent.trim().slice(0, 10) || e.className) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
        return { docW, vw, hScroll: docW > vw, clipped, offRight, smallTargets: small };
      });
      out[`${page}_${th}_${w}`] = r;
      if (th === 'cosmos') await pg.screenshot({ path: `${TV}/shots/mock_${page}_${th}_${w}.png` });
      await pg.close();
    }
  }
  await ctx.close();
}
save('mock_360', out);
for (const [k, v] of Object.entries(out)) console.log(k, v.hScroll ? 'HSCROLL' : 'ok', 'clipped', JSON.stringify(v.clipped), 'small', JSON.stringify(v.smallTargets).slice(0, 160));
await closeBrowser();
