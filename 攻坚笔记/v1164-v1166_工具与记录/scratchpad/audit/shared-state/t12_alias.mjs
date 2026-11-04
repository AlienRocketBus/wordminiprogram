import {boot,dismissWelcome,topbar,ls,sleep} from './harness.mjs';
const {s,page,log}=await boot();
async function openVia(file){await page.evaluate((f)=>openIsland(f),file);let fr;for(let i=0;i<80;i++){await sleep(150);fr=page.frames().find(f=>f.parentFrame()===page.mainFrame()&&f.url().endsWith(file));if(fr){try{if(await fr.evaluate(()=>document.readyState==='complete'&&!!window.S))break;}catch(e){}}}await sleep(1500);await dismissWelcome(fr);await sleep(1000);return fr;}
let land1=await openVia('island_land1.html');
console.log('land1 key',await land1.evaluate(()=>window.__hsnSaveKey),'allW',await land1.evaluate(()=>allW.length));
await land1.evaluate(()=>{learnWord(0);learnWord(1);learnWord(2);});
await sleep(1500);
console.log('land1 learned',await land1.evaluate(()=>S.learned),'topbar',JSON.stringify(await topbar(land1)));
await page.evaluate(()=>closeIsland());await sleep(600);
let season=await openVia('island_season.html');
await sleep(2000);
console.log('season learned',await season.evaluate(()=>S.learned.slice(0,10)),'len',await season.evaluate(()=>S.learned.length),'topbar',JSON.stringify(await topbar(season)));
console.log('canonical season learned',await season.evaluate(()=>{const s=JSON.parse(localStorage.getItem('hansen_canonical_progress_v941'));return s.islands.season.learned;}));
// now learn word 30 in season (=land2 slot 0) and check land2
await season.evaluate(()=>{learnWord(30);});await sleep(1200);
await page.evaluate(()=>closeIsland());await sleep(600);
let land2=await openVia('island_land2.html');await sleep(1500);
console.log('land2 learned',await land2.evaluate(()=>S.learned));
await s.close();
