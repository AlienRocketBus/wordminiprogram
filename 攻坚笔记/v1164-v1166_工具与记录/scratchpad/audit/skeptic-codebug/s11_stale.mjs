import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
async function tap(fr,sel){
  await fr.evaluate(s=>{const e=document.querySelector(s); e&&e.scrollIntoView({block:'center',behavior:'auto'});},sel); await sleep(300);
  const r=await fr.evaluate(s=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); const x=b.left+b.width/2,y=b.top+b.height/2; const t=document.elementFromPoint(x,y); return {x,y,ok:!!(t&&(t===e||e.contains(t)))};},sel);
  if(r&&r.ok) await p.touchscreen.tap(r.x,r.y); return r;
}
await p.goto(base+'/index.html',{waitUntil:'load'}); await sleep(2500);
await p.evaluate(()=>{ const e=[...document.querySelectorAll('button,div,span,a')].find(x=>x.textContent.trim()==='跳过'&&x.offsetParent&&x.children.length===0); if(e) e.id='__skip'; });
await tap(p.mainFrame(),'#__skip'); await sleep(800);
await p.evaluate(()=>{ const a=document.querySelector('a.island[href="island_animal.html"]'); if(a) a.id='__isl'; });
await tap(p.mainFrame(),'#__isl'); await sleep(4000);
const fr=p.frames().find(f=>f.url().includes('island_animal.html'));
await fr.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/开始冒险/.test(x.textContent)&&x.offsetParent); if(b) b.id='__welc'; });
await tap(fr,'#__welc'); await sleep(9000); // let warm rooms load
const bar=f=>f.evaluate(()=>({coin:(document.getElementById('coinCount')||{}).textContent, gem:(document.querySelector('.hsn-gem-badge, #gemCount, [id*=gem]')||{}).textContent, lvl:(document.getElementById('lvl')||{}).textContent, xp:(document.getElementById('xpText')||{}).textContent}));
const wallet=()=>p.evaluate(()=>({coins:window.HansenCoins?HansenCoins.get():null, gems:window.HansenGems?HansenGems.get():null, charxp:localStorage.getItem('hansen_wallet_charxp')}));
const r={};
r.islandBar0=await bar(fr); r.wallet0=await wallet();
// A) earn inside the island, then open the warmed season room
await fr.evaluate(()=>{ try{ HansenCoins.award('skeptic_test_'+Date.now(),150); }catch(e){ try{ addCoin(150);}catch(_){} } try{ addXP(120); }catch(e){} });
await sleep(800);
r.islandBarAfterEarn=await bar(fr); r.walletAfterEarn=await wallet();
const roomsReady=await fr.evaluate(()=>window.HansenRoom?{rooms:HansenRoom._rooms(),season:HansenRoom.isReady('season')}:null);
r.roomsReady=roomsReady;
await fr.evaluate(()=>HansenRoom.open('season')); await sleep(4000);
const sfr=p.frames().find(f=>/island_season\.html/.test(f.url()) && f.parentFrame()===fr);
r.seasonBar=sfr? await bar(sfr): 'no season frame';
await fr.evaluate(()=>HansenRoom.close('season')); await sleep(500);
// B) back home, change wallet on top window, re-enter
await p.goBack(); await sleep(1500);
await p.evaluate(()=>{ try{ HansenGems.add(40); }catch(e){} try{ HansenCoins.spend ? HansenCoins.spend(50) : null; }catch(e){} });
await sleep(500);
r.walletHome=await wallet();
await tap(p.mainFrame(),'#__isl'); await sleep(5000);
const fr2=p.frames().find(f=>f.url().includes('island_animal.html'));
r.sameDoc = fr2===fr;
r.islandBarReentry=await bar(fr2);
r.errors=log.slice(0,5);
console.log(JSON.stringify(r,null,1));
await c.close(); await b.close(); srv.close();
