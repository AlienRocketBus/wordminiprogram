import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const {srv, browser, ctx, base, external} = await setup({override: process.env.OVR? {'/index.html': process.env.OVR}:undefined, initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push('pageerror: '+e.message));
page.on('dialog', d=>{ errs.push('dialog: '+d.message().slice(0,100)); d.dismiss(); });
page.on('framenavigated', f=>{ if(f.parentFrame()===page.mainFrame()) console.log('   [islandFrame navigated]', f.url().replace(base,'')); });
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(3000);
await openCard(page, 'island_animal.html'); let fr = islandFrame(page,'island_animal.html'); await dismissWelcome(page, fr);
// simulate boot-check "重新加载" button behaviour inside the island iframe
await fr.evaluate(()=>{ var u = location.href.split('#')[0]; location.href = u + (u.indexOf('?') >= 0 ? '&' : '?') + '_r=' + Date.now(); });
await sleep(3500);
fr = page.frames().find(f=>f.parentFrame()===page.mainFrame());
console.log('after in-iframe reload', await st(page));
await dismissWelcome(page, fr);
// user taps the map/home button once
let r = await tapEl(page, fr, '.world-map-btn'); console.log('tap home #1', r.hit);
await sleep(2500);
console.log('after 1st home tap', await st(page));
fr = page.frames().find(f=>f.parentFrame()===page.mainFrame());
const s = await st(page);
if(s.wrap==='block'){ await dismissWelcome(page, fr); r = await tapEl(page, fr, '.world-map-btn'); await sleep(2000); console.log('after 2nd home tap', await st(page)); }
console.log('errors', errs);
await browser.close(); srv.close();
