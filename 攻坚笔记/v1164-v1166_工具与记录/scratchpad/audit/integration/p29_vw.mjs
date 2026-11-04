import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const {srv, browser, ctx, base, external} = await setup({initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push('pageerror: '+e.message));
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(3000);
await openCard(page, 'island_animal.html'); let fr = islandFrame(page,'island_animal.html'); await dismissWelcome(page, fr);
await fr.evaluate(()=>{ startSpeed(); startSpeedLevel('easy'); });
await sleep(1000);
globalThis.__VER = '1164';
// island-side trigger (e.g. island boot/visibility) delegates to top
await fr.evaluate(()=>window.HansenVersionWatch && HansenVersionWatch.check());
await sleep(400);
await page.screenshot({path:'/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/integration/vw_banner.png'});
await sleep(3000);
console.log('after version watcher fired while playing:', await page.evaluate(()=>({url:location.pathname+location.search, state:JSON.stringify(history.state), wrap:document.getElementById('islandFrameWrap').style.display})));
console.log('errors', errs);
await browser.close(); srv.close();
