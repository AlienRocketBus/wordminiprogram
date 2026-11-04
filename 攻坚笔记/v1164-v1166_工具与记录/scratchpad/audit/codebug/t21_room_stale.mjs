import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await ctx(b,base);
const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/index.html',{waitUntil:'load'}); await p.waitForTimeout(2500);
await p.evaluate(()=>openIsland('island_animal.html')); await p.waitForTimeout(4000);
let fr=p.frames().find(f=>/island_animal/.test(f.url()));
await fr.evaluate(()=>{ document.querySelectorAll('button').forEach(x=>{ if(/开始冒险/.test(x.textContent)) x.click(); }); });
await p.waitForTimeout(9000); // let warm rooms load
const warmed=p.frames().map(f=>f.url().replace(base,'').split('?')[0]);
// kid earns coins + XP in animal island via real reward APIs
const earn=await fr.evaluate(()=>{ const a=HansenCoins.award('test:earn:'+Date.now(),150); try{ addXP(120); }catch(e){} try{save();}catch(e){} return {a,coins:HansenCoins.get(),gems:HansenGems.get(),charXP:localStorage.getItem('hansen_wallet_charxp')}; });
// open the 星海 room (as the island's season entry does)
const opened=await fr.evaluate(()=>window.HansenRoom&&HansenRoom.open('season'));
await p.waitForTimeout(1200);
const sf=p.frames().find(f=>/island_season/.test(f.url()));
const seen=sf?await sf.evaluate(()=>({top:(document.querySelector('.top-bar,.topbar,#topBar')||document.body).innerText.slice(0,90).replace(/\s+/g,' '), wallet:HansenCoins.get(), xp:localStorage.getItem('hansen_wallet_charxp')})):null;
await p.waitForTimeout(4000);
const seen2=sf?await sf.evaluate(()=>({top:(document.querySelector('.top-bar,.topbar,#topBar')||document.body).innerText.slice(0,90).replace(/\s+/g,' ')})):null;
console.log(JSON.stringify({warmed,earn,opened,seasonRoomShows:seen,after4s:seen2},null,1));
await b.close(); srv.close();
