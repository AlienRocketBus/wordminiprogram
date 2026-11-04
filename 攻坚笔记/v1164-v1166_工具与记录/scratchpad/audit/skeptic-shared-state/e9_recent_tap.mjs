import {setup,bootHome,tapSel,waitIsland,dismissWelcome,sleep} from './lib.mjs';
const lastActivityAt=+process.argv[2]||3, leaveAt=+process.argv[3]||20;
const s=await setup();const log=[];
const page=await bootHome(s,log);
const t0=Date.now();
await tapSel(page,'a.island[href="island_animal.html"]');
const fr=await waitIsland(page,'island_animal.html');await dismissWelcome(fr);
// a few correct answers (same calls a listen-game answer makes)
await sleep(Math.max(0,lastActivityAt*1000-(Date.now()-t0)));
await fr.evaluate(()=>{for(let i=0;i<3;i++){markAnswer(i,true);addXP(5);}if(window.__hsnSaveNow)__hsnSaveNow();});
await sleep(Math.max(0,leaveAt*1000-(Date.now()-t0)));
// leave with the island's map/home button
const hb=await fr.evaluate(()=>{const el=[...document.querySelectorAll('a,button,div')].find(e=>/goHome\(\)/.test(e.getAttribute('onclick')||'')&&e.offsetParent);return el?(el.id||el.className||el.tagName):null;});
await fr.evaluate(()=>goHome());
await sleep(2500);
const card=await page.evaluate(()=>({text:document.getElementById('recentNum')?.textContent,target:document.getElementById('recentLearnStat')?._target}));
console.log('activity at +'+lastActivityAt+'s, left at +'+leaveAt+'s → home card:',JSON.stringify(card));
await page.screenshot({path:'e9_home_card_'+lastActivityAt+'_'+leaveAt+'.png'});
// tap the card like a kid would
const t=await tapSel(page,'#recentLearnStat');await sleep(2500);
const cur=await page.evaluate(()=>{try{return document.getElementById('islandFrame').contentWindow.location.pathname.split('/').pop();}catch(e){return 'err'}});
console.log('tapped 最近探险 card (hit='+t.hit+') → opened',cur);
await s.close();
