import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const {srv, browser, ctx, base, external} = await setup({cache:'public, max-age=3600', initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
const fromCache=[]; page.on('requestfinished', async r=>{ if(/island_[a-z0-9]+\.html/.test(r.url())){ const resp = await r.response(); fromCache.push(r.url().replace(base,'')+' frame='+(r.frame()===page.mainFrame()?'top':'sub')+' fromCache='+(resp? resp.fromServiceWorker()||false:'?')); } });
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(12000);
const pf = await page.evaluate(()=>window.HansenIslandPrefetch ? HansenIslandPrefetch.prefetched() : null);
console.log('prefetched by hansen_island_prefetch:', pf);
console.log('server hits so far for island html:', log.filter(l=>/island_[a-z0-9]+\.html/.test(l.p)).map(l=>l.url));
const n0 = log.length;
// tap first prefetched
const target = (pf && pf[0]) || 'island_animal.html';
await openCard(page, target);
console.log('tapped', target, '-> server hits after tap for it:', log.slice(n0).filter(l=>l.p==='/'+target).map(l=>l.url));
await browser.close(); srv.close();
