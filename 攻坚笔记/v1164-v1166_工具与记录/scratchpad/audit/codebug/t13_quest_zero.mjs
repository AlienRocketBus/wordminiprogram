import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const out={};
for(const isl of ['island_animal.html','island_land1.html']){
const c=await ctx(b,base);
await c.addInitScript(()=>{ if(sessionStorage.getItem('__q'))return; sessionStorage.setItem('__q','1');
  const d=new Date(); const day=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
  localStorage.setItem('hansen_global_daily_quests_v941',JSON.stringify({version:942,day,allDay:'',list:['review3','moles1','fish1','eagle1','match1'].map(id=>({id,progress:0,claimed:false}))}));
});
const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/'+isl,{waitUntil:'load'}); await p.waitForTimeout(3000);
out[isl]=await p.evaluate(async()=>{
  const g=()=>Object.fromEntries(HansenQuestGlobal.status().list.map(q=>[q.id,q.progress+'/'+q.goal]));
  const before=g();
  // Simulate a 打地鼠 round that scored 0 points, through the real end-of-round function
  try{ molesLevel='easy'; molesScore=0; molesComplete(); }catch(e){ return {err:'moles '+e.message}; }
  const afterMoles0=g();
  try{ molesScore=25; molesComplete(); }catch(e){}
  const afterMoles25=g();
  // review round with 0 correct of 3 -> the template calls progressQuest('review',correctCount)
  window.progressQuest('review',0);
  const afterReview0=g();
  return {before,afterMoles0,afterMoles25,afterReview0};
});
out[isl].log=log.slice(0,5);
await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
