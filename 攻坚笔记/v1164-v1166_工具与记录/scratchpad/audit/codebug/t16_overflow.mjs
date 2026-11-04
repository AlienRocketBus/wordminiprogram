import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const out={};
for(const w of [360,390]){
const c=await ctx(b,base,{w,h:780});
for(const pg of ['boss_hall.html','land_map.html','season_showcase.html']){
  const p=await c.newPage();
  await p.goto(base+'/'+pg,{waitUntil:'load'}); await p.waitForTimeout(2500);
  out[w+' '+pg]=await p.evaluate(()=>{
    const se=document.scrollingElement; se.scrollLeft=200; const sl=se.scrollLeft; window.scrollTo(200,0); const sx=window.scrollX;
    const vw=document.documentElement.clientWidth; const offenders=[];
    document.querySelectorAll('body *').forEach(el=>{ const r=el.getBoundingClientRect(); if(r.right>vw+1 && r.width>0 && getComputedStyle(el).position!=='fixed'){ offenders.push((el.id?'#'+el.id:el.tagName.toLowerCase()+'.'+String(el.className).split(' ')[0])+' r='+Math.round(r.right)); } });
    const cs=getComputedStyle(document.body), ch=getComputedStyle(document.documentElement);
    return {sw:se.scrollWidth,vw,scrollLeftAfter:sl,scrollX:sx,bodyOX:cs.overflowX,htmlOX:ch.overflowX,offenders:offenders.slice(0,6)};
  });
  await p.close();
}
await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
