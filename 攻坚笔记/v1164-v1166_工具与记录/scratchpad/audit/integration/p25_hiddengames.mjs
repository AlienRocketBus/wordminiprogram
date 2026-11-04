import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const {srv, browser, ctx, base, external} = await setup({initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(3000);
await openCard(page, 'island_animal.html'); let fr = islandFrame(page,'island_animal.html'); await dismissWelcome(page, fr); await sleep(800);
const games = [['moles','startMoles'],['fish','startFish'],['bubble','startBubble'],['listen','startListen'],['eagle','startEagle']];
for(const [g,fn] of games){
  await fr.evaluate(()=>{ try{ showScreen('home'); }catch(e){} });
  await sleep(300);
  await fr.evaluate((fn)=>{ try{ window[fn](); }catch(e){ return e.message; } }, fn);
  await sleep(800);
  // try to click first level/difficulty option if any menu
  const txt0 = await fr.evaluate(()=>{ const s=document.querySelector('.screen.active'); return s? s.innerText.replace(/\s+/g,' ').slice(0,80):''; });
  const clicked = await fr.evaluate(()=>{ const s=document.querySelector('.screen.active'); const el=[...s.querySelectorAll('[onclick]')].find(e=>/Level|Lv|start|easy|初级|开始/i.test(e.getAttribute('onclick')+e.innerText)); if(el){ el.click(); return el.getAttribute('onclick').slice(0,40);} return null; });
  await sleep(2500);
  const snap = ()=>fr.evaluate(()=>{ const s=document.querySelector('.screen.active'); return s.innerText.replace(/\s+/g,' ').match(/(\d+)\s*秒|⏱\S*\s*(\d+)|剩余\s*(\d+)|时间\s*(\d+)/)?.[0] || s.innerText.replace(/\s+/g,' ').slice(0,60); });
  const a = await snap();
  await page.evaluate(()=>history.back()); await waitFor(page, s=>s.wrap==='none', 3000);
  await sleep(8000);
  const b = await snap();
  console.log(g, 'menu:', txt0.slice(0,40), '| clicked:', clicked, '| before hide:', a, '| after 8s hidden:', b);
  await page.evaluate(()=>history.forward()); await waitFor(page, s=>s.wrap==='block'&&s.op==='1', 3000); await sleep(500);
}
await browser.close(); srv.close();
