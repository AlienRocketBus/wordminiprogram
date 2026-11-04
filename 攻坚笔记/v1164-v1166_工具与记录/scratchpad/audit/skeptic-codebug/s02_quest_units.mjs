import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
const out={};
for (const isl of ['island_land1.html','island_animal.html']){
  const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
  await c.addInitScript(()=>{
    const d=new Date(); const day=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
    const mk=(id,icon,title,goal,type)=>({id,icon,title,goal,type,reward:{xp:10},progress:0,claimed:false});
    if(!localStorage.getItem('__seeded')){
      localStorage.setItem('hansen_global_daily_quests_v941', JSON.stringify({version:942,day,allDay:'',list:[
        mk('review3','🔄','复习单词 · 巩固 3 个',3,'review'),
        mk('moles1','🎯','打地鼠 · 累计得 30 分',30,'moles'),
        mk('fish1','🎣','钓鱼大师 · 累计得 30 分',30,'fish'),
        mk('eagle1','👀','火眼金睛 · 累计得 30 分',30,'eagle'),
        mk('match1','🃏','记忆翻牌 · 配对成功 8 组',8,'match'),
      ]}));
      localStorage.setItem('__seeded','1');
    }
  });
  await p.goto(base+'/'+isl,{waitUntil:'load'}); await sleep(3500);
  const res = await p.evaluate(async ()=>{
    const st=()=>Object.fromEntries(HansenQuestGlobal.status().list.map(q=>[q.id,q.progress]));
    const r={start:st(), url:location.href};
    try{ molesLevel='easy'; molesScore=25; molesComplete(); }catch(e){ r.molesErr=String(e); }
    await new Promise(r=>setTimeout(r,300));
    r.afterMoles25=st();
    try{ fishScore=20; fishComplete(); }catch(e){ r.fishErr=String(e); }
    await new Promise(r=>setTimeout(r,300));
    r.afterFish20=st();
    // zero-score moles round (CB-07)
    try{ molesScore=0; molesComplete(); }catch(e){ r.moles0Err=String(e); }
    await new Promise(r=>setTimeout(r,300));
    r.afterMoles0=st();
    // explicit 0 review (CB-07) — what template reviewComplete would send with 0 correct
    try{ progressQuest('review',0); }catch(e){ r.rev0Err=String(e); }
    r.afterReview0=st();
    return r;
  });
  out[isl]={res,errors:log.slice(0,6)};
  await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
