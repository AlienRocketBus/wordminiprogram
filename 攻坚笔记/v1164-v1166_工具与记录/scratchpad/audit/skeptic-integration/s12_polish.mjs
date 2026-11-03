// INT-12/13/14 quick checks: home status strip, fonts, titles, standalone back paths
import { sleep, tap } from './kit.mjs';
import { boot2 } from './kit2.mjs';
import { freshHome } from './nav.mjs';
const K = await boot2({ cache: 'public, max-age=3600' });
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
const out = (...a) => console.log(...a);
await freshHome(K, page);
await sleep(2500);
out('index title:', await page.title());
const f = await page.evaluate(async () => {
  await document.fonts.ready;
  const g = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontFamily : null; };
  const loaded = [...document.fonts].filter(x => x.status === 'loaded').map(x => x.family);
  const bowlby = document.fonts.check('14px "Bowlby One"');
  const statusEls = [...document.querySelectorAll('body *')].filter(e => e.offsetParent !== null && /Lv\.?\s*\d|🪙\s*\d|金币\s*\d/.test(e.textContent || '') && e.children.length < 3).slice(0, 5).map(e => e.tagName + '.' + String(e.className).slice(0, 20) + ':' + e.textContent.trim().slice(0, 30));
  return { islandEn: g('.island-en'), statNum: g('.stat-num'), loadedFonts: loaded, bowlbyAvailable: bowlby, statusEls };
});
out('home fonts:', JSON.stringify(f));
await page.screenshot({ path: 's12_home_top.png' });
for (const p of ['boss_hall.html', 'season_showcase.html', 'spelling_bee.html', 'land_map.html']) {
  await page.goto(K.base + p, { waitUntil: 'load' });
  await sleep(2500);
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll('a,button,[onclick],[role=button]')].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed');
    const nav = els.filter(e => /返回|首页|地图|回|关闭|×|✕|←|home|back/i.test((e.textContent || '') + (e.getAttribute('aria-label') || '') + (e.getAttribute('href') || '') + (e.getAttribute('onclick') || ''))).map(e => (e.textContent || '').trim().slice(0, 16) + ' [' + (e.getAttribute('onclick') || e.getAttribute('href') || e.id || '').slice(0, 50) + ']');
    return { title: document.title, navLike: nav.slice(0, 8) };
  });
  out(p, JSON.stringify(r));
}
await K.done();
