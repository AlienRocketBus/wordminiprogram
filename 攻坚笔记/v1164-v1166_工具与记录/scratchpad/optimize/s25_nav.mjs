import { launch, sleep, BASE, O } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'index.html'); await sleep(3000);
await page.evaluate(() => window.openIsland('island_animal.html')); await sleep(4000);
const fr = () => page.frames().find(f => f.url().includes('island_animal'));
const f = fr();
await f.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(500);
const iframeVisible = async () => page.evaluate(() => { const i = document.getElementById('islandFrame'); if (!i) return 'none'; const r = i.getBoundingClientRect(); const s = getComputedStyle(i.parentElement); return r.height > 100 && getComputedStyle(i).visibility !== 'hidden' && s.display !== 'none' ? 'island-shown' : 'island-hidden'; });
// 1) top-right map icon
const mapIcon = await f.evaluate(() => { const im = document.querySelector('img[src*="map_home"]'); if (!im) return null; const el = im.closest('[onclick],a,button') || im; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, label: el.getAttribute('aria-label') || el.title || '', onclick: (el.getAttribute('onclick') || '').slice(0, 60) }; });
console.log('map icon', mapIcon);
// 2) bottom nav 主页 in island menu
const navHome = await f.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => (e.innerText || '').trim() === '主页' && e.offsetParent); const t = el.closest('[onclick],a,button') || el; return { onclick: (t.getAttribute('onclick') || t.getAttribute('href') || '').slice(0, 80) }; });
console.log('bottom 主页', navHome);
// play: open listen screen then press bottom 主页
await f.evaluate(() => startListen()); await sleep(500);
await f.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => (e.innerText || '').trim() === '主页' && e.offsetParent); (el.closest('[onclick],a,button') || el).click(); }); await sleep(1500);
console.log('after bottom 主页 from listen:', await iframeVisible(), await fr().evaluate(() => { const s = [...document.querySelectorAll('[id$=Screen]')].find(e => e.offsetParent); return s && s.id; }));
await f.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => (e.innerText || '').trim() === '主页' && e.offsetParent); (el.closest('[onclick],a,button') || el).click(); }); await sleep(1500);
console.log('after 2nd bottom 主页:', await iframeVisible());
// android back
await page.goBack().catch(() => {}); await sleep(1500);
console.log('after history back:', await iframeVisible(), page.url());
await browser.close();
