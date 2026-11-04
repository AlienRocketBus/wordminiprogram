import { launch, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const isl = process.argv[2] || 'animal';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const results = [];
const page = await ctx.newPage();
const dialogs = []; page.on('dialog', d => { dialogs.push(d.message().slice(0, 150)); d.dismiss().catch(()=>{}); });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
async function fresh() {
  await page.goto(BASE + `island_${isl}.html`); await sleep(2500);
  const welcome = await page.evaluate(() => { const m = document.getElementById('alertModal'); return !!(m && m.classList.contains('show')); });
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
  await sleep(600);
  return welcome;
}
const n = await (async () => { await fresh(); return page.evaluate(() => document.querySelectorAll('.mode-card').length); })();
for (let i = 0; i < n; i++) {
  const welcome = await fresh();
  const info = await page.evaluate(i => { const c = document.querySelectorAll('.mode-card')[i]; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { name: c.innerText.trim().replace(/\s+/g, ' '), x: r.x + r.width / 2, y: r.y + r.height / 2, w: Math.round(r.width), h: Math.round(r.height) }; }, i);
  await sleep(400);
  await page.touchscreen.tap(info.x, info.y);
  await sleep(2200);
  await page.screenshot({ path: `${O}/shots/s06_${isl}_m${String(i).padStart(2, '0')}.png` });
  const st = await page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
    const backs = [...document.querySelectorAll('button, [onclick], a, [role=button], div, span')].filter(el => vis(el) && el.children.length <= 2 && /^(\s*(←|‹|<|✕|×|X|🏠|⬅️?)\s*)?(返回|退出|关闭|主页|回岛|首页|结束)?\s*(←|✕|×)?$/.test((el.innerText || '').trim()) && (el.innerText || '').trim().length > 0 && (el.innerText || '').trim().length < 10).map(el => { const r = el.getBoundingClientRect(); return { t: el.innerText.trim(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), tag: el.tagName, id: el.id }; });
    const screens = [...document.querySelectorAll('[id$=Screen], .screen, [id^=hsn][id$=Overlay], iframe')].filter(vis).map(e => e.id || e.className || e.tagName);
    const txt = document.elementFromPoint(195, 300) ? '' : '';
    // gather the big visible text of top-most layer
    const top = [...document.querySelectorAll('body *')].filter(el => { const s = getComputedStyle(el); return (s.position === 'fixed' || s.position === 'absolute') && vis(el) && el.getBoundingClientRect().width >= 380 && el.getBoundingClientRect().height >= 700; });
    const layer = top.length ? top[top.length - 1] : document.body;
    return { backs: backs.slice(0, 6), screens, layerTxt: (layer.innerText || '').replace(/\s+/g, ' ').slice(0, 300) };
  });
  results.push({ i, ...info, welcomeShown: welcome, ...st });
  console.log(i, info.name, '| backs:', st.backs.map(b => `${b.t}@${b.x},${b.y} ${b.w}x${b.h}`).join(' ; '), '| screens:', st.screens.join(','));
}
fs.writeFileSync(`${O}/out/s06_${isl}_modes.json`, JSON.stringify({ results, dialogs, errs }, null, 1));
console.log('dialogs', dialogs, 'errs', errs.slice(0, 5));
await browser.close();
