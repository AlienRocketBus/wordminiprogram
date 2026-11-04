import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
const out={};
async function tapIn(p,fr,sel){
  await fr.evaluate(s=>{const e=document.querySelector(s); e&&e.scrollIntoView({block:'center',behavior:'auto'});},sel);
  await sleep(300);
  const r=await fr.evaluate(s=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); const x=b.left+b.width/2,y=b.top+b.height/2; const top=document.elementFromPoint(x,y); return {x,y,ok:!!(top&&(top===e||e.contains(top))),top:top&&(top.id||String(top.className).slice(0,40))};},sel);
  if(!r||!r.ok) return r;
  // frame offset
  const off = await p.evaluate(()=>{const f=document.getElementById('islandFrame'); const b=f.getBoundingClientRect(); return {x:b.left,y:b.top};});
  await p.touchscreen.tap(r.x+off.x,r.y+off.y);
  return r;
}
for (const isl of ['island_land1.html','island_land5.html','island_animal.html']){
  const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
  await p.goto(base+'/index.html',{waitUntil:'load'}); await sleep(2500);
  // skip onboarding with real tap
  const sk=await p.evaluate(()=>{ const e=[...document.querySelectorAll('button,div,span,a')].find(x=>x.textContent.trim()==='跳过'&&x.offsetParent&&x.children.length===0); if(!e) return null; e.scrollIntoView({block:'center'}); const b=e.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2}; });
  if(sk){ await p.touchscreen.tap(sk.x,sk.y); await sleep(800); }
  await p.evaluate(f=>openIsland(f), isl); await sleep(5000);
  const fr=p.frames().find(f=>f.url().includes(isl));
  const welc=await fr.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/开始冒险/.test(x.textContent)&&x.offsetParent); if(b){b.id='__welc';return true;} return false; });
  if(welc) await tapIn(p,fr,'#__welc');
  await sleep(700);
  const before=await fr.evaluate(()=>({badge:(document.getElementById('questSub')||{}).textContent, globalList:(window.HansenQuestGlobal&&HansenQuestGlobal.status().list.length), SquestsLen:S.quests&&S.quests.list&&S.quests.list.length}));
  const tap=await tapIn(p,fr,'#questCard');
  await sleep(900);
  const after=await fr.evaluate(()=>({active:(document.querySelector('.screen.active')||{}).id, listText:(document.getElementById('questList')||{innerText:''}).innerText.trim().slice(0,80), cards:document.querySelectorAll('#questList > *').length, SquestsLen:S.quests&&S.quests.list&&S.quests.list.length, globalList:HansenQuestGlobal.status().list.length, globalIds:HansenQuestGlobal.status().list.map(q=>q.id).join(',')}));
  out[isl]={welc,before,tap,after,errors:log.slice(0,5)};
  if(isl==='island_land1.html') await p.screenshot({path:'s01_land1_quests.png'});
  await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
