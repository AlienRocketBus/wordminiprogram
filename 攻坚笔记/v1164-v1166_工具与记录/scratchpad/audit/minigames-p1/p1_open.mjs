import {startServer, launch, newCtx, attach, sleep, tapEl, OUT} from './lib.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const {ctx, ext} = await newCtx(browser, port);
const page = await ctx.newPage();
const events=[]; let cur='home';
attach(page, events, ()=>cur);
await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'load'});
await sleep(1500);
// onboarding?
const skip = await page.$('text=跳过');
console.log('skip present', !!skip);
if(skip){ const r = await tapEl(page, page.mainFrame(), skip); console.log('skip tap', r); await sleep(600); }
const card = await page.$('a[href="island_action.html"]');
console.log('card', !!card);
const r = await tapEl(page, page.mainFrame(), card); console.log('card tap', r);
await sleep(2500);
const fr = page.frames().find(f=>/island_action/.test(f.url()));
console.log('frame', fr && fr.url());
const fe = await page.$('#islandFrame'); console.log('iframe box', await fe.boundingBox());
await page.screenshot({path:OUT+'/p1_after_open.png'});
const alertShown = await fr.evaluate(()=>document.getElementById('alertModal').classList.contains('show'));
console.log('welcome shown', alertShown, await fr.evaluate(()=>document.getElementById('alertInner').innerText.slice(0,300)));
const btn = await fr.$('#alertInner >> text=开始冒险！');
if(btn){ console.log('start tap', await tapEl(page, fr, btn)); await sleep(500); }
const cards = await fr.$$eval('#homeScreen .mode-card', els=>els.map(e=>({t:e.innerText.trim(), oc:e.getAttribute('onclick')})));
console.log(cards);
await page.screenshot({path:OUT+'/p1_island_home.png'});
console.log('events', JSON.stringify(events,null,1).slice(0,3000));
console.log('ext', [...new Set(ext.map(u=>new URL(u).host))]);
await browser.close(); srv.close();
