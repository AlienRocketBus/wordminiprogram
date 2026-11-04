import { setup, sleep, log, tapEl } from './lib.mjs';
const D='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/integration';
const {srv, browser, ctx, base, external} = await setup({initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(2500);
const H = await page.evaluate(()=>document.documentElement.scrollHeight);
console.log('scrollHeight', H);
for(let y=0;y<H;y+=800){ await page.evaluate(y=>scrollTo(0,y),y); await sleep(300); await page.screenshot({path:`${D}/home_${y}.png`}); }
// texts with digits that look like coins/levels
const t = await page.evaluate(()=>[...document.querySelectorAll('[id]')].filter(e=>e.children.length===0 && /\d/.test(e.textContent) && e.offsetParent).map(e=>e.id+'='+e.textContent.trim().slice(0,30)).slice(0,60));
console.log(t.join('\n'));
await browser.close(); srv.close();
