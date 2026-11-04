import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await ctx(b,base);
const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/index.html',{waitUntil:'load'}); await p.waitForTimeout(2500);
for(const f of ['island_action.html','island_question.html']){ await p.evaluate(f=>openIsland(f),f); await p.waitForTimeout(3500); await p.evaluate(()=>history.back()); await p.waitForTimeout(600); }
const ls=await p.evaluate(()=>({last:localStorage.getItem('lastIslandKey'), keys:Object.keys(localStorage).filter(k=>/^wordIsland[A-Za-z0-9]+$/.test(k))}));
const bad=[]; const pf=[];
p.on('request',r=>{ if(/island_/.test(r.url())) pf.push(r.url().replace(base,'')); });
p.on('response',r=>{ if(r.status()>=400) bad.push(r.status()+' '+r.url().replace(base,'')); });
await p.reload({waitUntil:'load'}); await p.waitForTimeout(7000);
const links=await p.evaluate(()=>[...document.querySelectorAll('link[rel=prefetch]')].map(l=>l.getAttribute('href')+' ['+l.dataset.why+']'));
console.log(JSON.stringify({ls,links,bad,pf:pf.slice(0,12)},null,1));
await b.close(); srv.close();
