import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
async function run(scenario){
  const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
  async function tapTop(sel){
    const r=await p.evaluate(async s=>{const e=document.querySelector(s); if(!e) return null; e.scrollIntoView({block:'center',behavior:'auto'}); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); const b=e.getBoundingClientRect(); const x=b.left+b.width/2,y=b.top+b.height/2; const t=document.elementFromPoint(x,y); return {x,y,ok:!!(t&&(t===e||e.contains(t)))};},sel);
    if(r&&r.ok) await p.touchscreen.tap(r.x,r.y); return r;
  }
  async function tapFrame(fr,sel){
    await fr.evaluate(s=>{const e=document.querySelector(s); e&&e.scrollIntoView({block:'center',behavior:'auto'});},sel); await sleep(300);
    const r=await fr.evaluate(s=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); const x=b.left+b.width/2,y=b.top+b.height/2; const t=document.elementFromPoint(x,y); return {x,y,ok:!!(t&&(t===e||e.contains(t)))};},sel);
    if(r&&r.ok){ await p.touchscreen.tap(r.x,r.y); } return r;
  }
  await p.goto(base+'/index.html',{waitUntil:'load'}); await sleep(2500);
  await p.evaluate(()=>{ const e=[...document.querySelectorAll('button,div,span,a')].find(x=>x.textContent.trim()==='跳过'&&x.offsetParent&&x.children.length===0); if(e) e.id='__skip'; });
  await tapTop('#__skip'); await sleep(800);
  await p.evaluate(()=>{ const a=document.querySelector('a.island[href="island_action.html"]'); if(a) a.id='__isl'; });
  const t=await tapTop('#__isl'); const tOpen=Date.now(); await sleep(4500);
  const fr=p.frames().find(f=>f.url().includes('island_action.html'));
  await fr.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/开始冒险/.test(x.textContent)&&x.offsetParent); if(b) b.id='__welc'; });
  await tapFrame(fr,'#__welc'); await sleep(600);
  await fr.evaluate(()=>{ try{ learnWord(0); }catch(e){} });
  const ts=()=>p.evaluate(()=>{ const g=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')?.lastSaveTime||0}catch(e){return -1}}; return {verbs:g('wordIslandVerbs'), season:g('wordIslandSeason'), lastIslandKey:localStorage.getItem('lastIslandKey'), lastIslandTime:+localStorage.getItem('lastIslandTime')}; });
  const samples=[];
  for(let i=0;i<6;i++){ await sleep(2000); const s=await ts(); samples.push({dt:Date.now()-tOpen, verbsAgo:s.verbs?Date.now()-s.verbs:null, seasonAgo:s.season?Date.now()-s.season:null}); }
  if(scenario==='keepPlaying'){ await fr.evaluate(()=>{ try{ learnWord(1); }catch(e){} }); await sleep(800); }
  if(scenario==='longIdle'){ await sleep(30000); const s=await ts(); samples.push({dt:Date.now()-tOpen, verbsAgo:Date.now()-s.verbs, seasonAgo:s.season?Date.now()-s.season:null}); }
  const rooms=await fr.evaluate(()=>window.HansenRoom?HansenRoom._rooms():null);
  await p.goBack(); await sleep(2600);
  const recent=await p.evaluate(()=>({num:document.getElementById('recentNum').textContent, target:document.getElementById('recentLearnStat')._target}));
  await c.close();
  return {scenario,cardTap:t,rooms,samples,recent,errors:log.slice(0,4)};
}
const out=[];
out.push(await run('shortVisit'));
out.push(await run('keepPlaying'));
out.push(await run('longIdle'));
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
