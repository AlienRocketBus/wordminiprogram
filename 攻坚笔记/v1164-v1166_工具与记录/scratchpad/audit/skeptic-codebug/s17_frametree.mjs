import {serve,launch,newCtx,attach,sleep,reqLog} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/index.html',{waitUntil:'load'}); await sleep(2500);
await p.evaluate(()=>{ const e=[...document.querySelectorAll('button,div,span,a')].find(x=>x.textContent.trim()==='跳过'&&x.offsetParent&&x.children.length===0); if(e) e.click(); });
await p.evaluate(()=>openIsland('island_food.html')); await sleep(15000);
function dump(f,depth){ let s='  '.repeat(depth)+f.url().replace(base,'')+'\n'; for(const ch of f.childFrames()) s+=dump(ch,depth+1); return s; }
console.log(dump(p.mainFrame(),0));
// how many full island_season / land_map documents booted
const htmlLoads=reqLog.filter(x=>/\.html/.test(x));
console.log(htmlLoads.join('\n'));
await c.close(); await b.close(); srv.close();
