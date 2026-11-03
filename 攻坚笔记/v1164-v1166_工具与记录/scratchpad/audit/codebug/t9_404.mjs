import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
for(const fuzz of [false,true]){
const c=await ctx(b,base);
if(fuzz) await c.addInitScript(()=>{ if(sessionStorage.getItem('__fz'))return; sessionStorage.setItem('__fz','1'); ['avatar','hansen_avatar','hansen_avatar_v1','hansen_pet','theme'].forEach(k=>localStorage.setItem(k,'[1,2]')); });
const p=await c.newPage(); const bad=[];
p.on('response',r=>{ if(r.status()>=400) bad.push(r.status()+' '+r.url().replace(base,'')); });
await p.goto(base+'/index.html',{waitUntil:'load'}); await p.waitForTimeout(3500);
console.log('fuzz',fuzz,bad);
await c.close();
}
await b.close(); srv.close();
