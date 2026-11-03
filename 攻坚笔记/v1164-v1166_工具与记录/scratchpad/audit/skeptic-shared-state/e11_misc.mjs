import {setup,bootHome,tapSel,waitIsland,dismissWelcome,sleep} from './lib.mjs';
const s=await setup();const log=[];
const page=await bootHome(s,log);
await tapSel(page,'a.island[href="island_food.html"]');
const fr=await waitIsland(page,'island_food.html');await dismissWelcome(fr);
await sleep(12000);
// SS-6: storage event from a nested hidden frame
await page.evaluate(()=>{window.__se=[];addEventListener('storage',e=>{if(e.key==='zz_probe')__se.push('top')});});
await fr.evaluate(()=>{window.__se=[];addEventListener('storage',e=>{if(e.key==='zz_probe')__se.push('island')});});
const depth=f=>{let d=0;while(f.parentFrame()){d++;f=f.parentFrame();}return d;};console.log(page.frames().map(f=>depth(f)+':'+f.url().replace(s.base,'')).join(' | '));const deep=page.frames().filter(f=>depth(f)>=2&&/island_season|land_map/.test(f.url())).sort((a,b)=>depth(b)-depth(a))[0];
console.log('deep frame',deep&&deep.url().replace(s.base,''));
await deep.evaluate(()=>localStorage.setItem('zz_probe',String(Date.now())));
await sleep(500);
console.log('storage event received: top=',await page.evaluate(()=>__se),'island=',await fr.evaluate(()=>__se));
// SS-5: max level label
await fr.evaluate(()=>addXP(52300));await sleep(300);
console.log('max level topbar:',await fr.evaluate(()=>({lvl:document.getElementById('lvl').textContent,name:document.getElementById('userName')?.textContent,line:document.getElementById('xpText').parentElement.textContent.replace(/\s+/g,' ').trim()})));
await fr.evaluate(()=>addXP(500));await sleep(200);
console.log('after +500 more:',await fr.evaluate(()=>document.getElementById('xpText').parentElement.textContent.replace(/\s+/g,' ').trim()));
const el=await fr.$('#xpText');
await page.screenshot({path:'e11_maxlevel.png',clip:{x:0,y:0,width:390,height:80}});
await s.close();
