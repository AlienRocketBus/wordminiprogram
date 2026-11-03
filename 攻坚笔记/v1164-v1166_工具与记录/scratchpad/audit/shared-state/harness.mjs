import {setup,attach,sleep} from './lib.mjs';
export {sleep};
export async function boot(opts={}){
  const s=await setup(opts);const log=[];
  const page=await s.ctx.newPage();attach(page,log);
  if(opts.init) await page.addInitScript(opts.init);
  await page.goto(s.base+'index.html',{waitUntil:'load'});
  await sleep(1200);
  // skip onboarding
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button,a,div,span')].find(e=>e.textContent.trim()==='跳过'&&e.offsetParent);b&&b.click();});
  await sleep(400);
  return {s,page,log};
}
export async function tapEl(page,frameSel,sel){
  // scroll into view and tap, checking elementFromPoint within top page
  const r=await page.evaluate(([sel])=>{const el=document.querySelector(sel);if(!el)return null;el.scrollIntoView({block:'center',behavior:'auto'});return true;},[sel]);
  await sleep(150);
  const box=await page.evaluate(([sel])=>{const el=document.querySelector(sel);const b=el.getBoundingClientRect();const x=b.left+b.width/2,y=b.top+b.height/2;const t=document.elementFromPoint(x,y);return {x,y,hit:!!(t&&(t===el||el.contains(t))),top:t&&(t.id||t.className||t.tagName)};},[sel]);
  if(box.hit) await page.touchscreen.tap(box.x,box.y);
  return box;
}
export async function openIslandByTap(page,file){
  const box=await tapEl(page,null,`a.island[href="${file}"]`);
  // wait iframe ready
  for(let i=0;i<100;i++){await sleep(100);const ok=await page.evaluate((f)=>{const fr=document.getElementById('islandFrame');try{return fr.contentWindow.location.pathname.endsWith(f)&&fr.contentDocument.readyState==='complete'&&fr.style.opacity==='1';}catch(e){return false;}},file);if(ok)break;}
  await sleep(800);
  const fr=page.frames().find(f=>f.url().includes(file));
  return {box,frame:fr};
}
export async function dismissWelcome(frame){
  await sleep(400);
  return frame.evaluate(()=>{const b=[...document.querySelectorAll('#alertModal button')].find(x=>/开始冒险/.test(x.textContent));if(b&&document.getElementById('alertModal').classList.contains('show')){b.click();return true;}return false;});
}
export async function topbar(frame){
  return frame.evaluate(()=>({lvl:document.getElementById('lvl')?.textContent,xpText:document.getElementById('xpText')?.textContent,xpMax:document.getElementById('xpMax')?.textContent,coin:document.getElementById('coinCount')?.textContent,gem:document.getElementById('__hs_gem_count')?.textContent,streak:document.getElementById('streakCount')?.textContent,crystal:(document.querySelector('[id*=crystal][id*=ount]')||{}).textContent,S_charXP:window.S&&S.charXP,S_level:window.S&&S.level}));
}
export async function ls(page,keys){
  return page.evaluate((keys)=>{const o={};for(const k of keys)o[k]=localStorage.getItem(k);return o;},keys);
}
