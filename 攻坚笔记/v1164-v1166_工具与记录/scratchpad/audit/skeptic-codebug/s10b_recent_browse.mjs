import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
async function run(isl, stay){
  const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
  async function tap(fr,sel){
    await fr.evaluate(s=>{const e=document.querySelector(s); e&&e.scrollIntoView({block:'center',behavior:'auto'});},sel); await sleep(300);
    const r=await fr.evaluate(s=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); const x=b.left+b.width/2,y=b.top+b.height/2; const t=document.elementFromPoint(x,y); return {x,y,ok:!!(t&&(t===e||e.contains(t)))};},sel);
    if(r&&r.ok) await p.touchscreen.tap(r.x,r.y); return r;
  }
  await p.goto(base+'/index.html',{waitUntil:'load'}); await sleep(2500);
  await p.evaluate(()=>{ const e=[...document.querySelectorAll('button,div,span,a')].find(x=>x.textContent.trim()==='跳过'&&x.offsetParent&&x.children.length===0); if(e) e.id='__skip'; });
  await tap(p.mainFrame(),'#__skip'); await sleep(800);
  await p.evaluate(f=>{ const a=document.querySelector('a.island[href="'+f+'"]'); if(a) a.id='__isl'; }, isl);
  const t=await tap(p.mainFrame(),'#__isl'); await sleep(4000);
  const fr=p.frames().find(f=>f.url().includes(isl));
  await fr.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/开始冒险/.test(x.textContent)&&x.offsetParent); if(b) b.id='__welc'; });
  await tap(fr,'#__welc');
  await sleep(stay);
  await p.goBack(); await sleep(2600);
  const recent=await p.evaluate(()=>document.getElementById('recentNum').textContent);
  // second hop: then open another island briefly and come back
  await c.close();
  return {isl, stay, cardTap:!!(t&&t.ok), recent};
}
const out=[];
for(const [isl,stay] of [['island_action.html',12000],['island_food.html',12000],['island_animal.html',20000]]) out.push(await run(isl,stay));
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
