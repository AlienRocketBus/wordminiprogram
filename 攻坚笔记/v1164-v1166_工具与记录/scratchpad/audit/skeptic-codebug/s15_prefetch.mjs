import {serve,launch,newCtx,attach,sleep,reqLog} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/index.html',{waitUntil:'load'}); await sleep(2500);
await p.evaluate(()=>{ const e=[...document.querySelectorAll('button,div,span,a')].find(x=>x.textContent.trim()==='跳过'&&x.offsetParent&&x.children.length===0); if(e) e.click(); });
await sleep(500);
for(const f of ['island_question.html','island_action.html']){ await p.evaluate(f=>openIsland(f),f); await sleep(5000); await p.goBack(); await sleep(1000); }
const keys=await p.evaluate(()=>({last:localStorage.getItem('lastIslandKey'), wi:Object.keys(localStorage).filter(k=>k.startsWith('wordIsland'))}));
reqLog.length=0;
await p.reload({waitUntil:'load'}); await sleep(8000);
const links=await p.evaluate(()=>[...document.querySelectorAll('link[rel=prefetch]')].map(l=>l.getAttribute('href')+' ['+l.getAttribute('data-why')+']'));
const r404=reqLog.filter(x=>x.startsWith('404'));
console.log(JSON.stringify({keys,links,r404},null,1));
await c.close(); await b.close(); srv.close();
