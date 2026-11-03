import { sleep, OUT } from './lib.mjs';
export async function seed(ctx, extra={}){
  await ctx.addInitScript((extra)=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); for(const k in extra) localStorage.setItem(k, extra[k]); localStorage.setItem('__seeded','1'); } }catch(e){} }, extra);
}
export async function shot(page, name, opts={}){ const p = OUT+'/shots/'+name+'.png'; await page.screenshot({path:p, ...opts}); return p; }
export function islandFrame(page, file){ return page.frames().find(f=>f.url().includes(file||'island_')); }
export async function openIsland(page, file){
  await page.evaluate(f=>window.openIsland(f), file);
  for(let i=0;i<60;i++){ await sleep(250); const fr=islandFrame(page, file); if(fr){ try{ const ok = await fr.evaluate(()=>document.readyState!=='loading' && !!document.getElementById('homeScreen')); if(ok) break; }catch(e){} } }
  await sleep(2500);
  return islandFrame(page, file);
}
export async function tapEl(page, frame, selector, {index=0}={}){
  const loc = frame.locator(selector).nth(index);
  await loc.evaluate(el=>el.scrollIntoView({block:'center',behavior:'auto'}));
  await sleep(250);
  const bb = await loc.boundingBox();
  if(!bb) throw new Error('no bbox '+selector);
  const x=bb.x+bb.width/2, y=bb.y+bb.height/2;
  // hit check (frame coords differ only by iframe offset; boundingBox is in top-page coords)
  const hit = await page.evaluate(([x,y])=>{ let el=document.elementFromPoint(x,y); let d=el; let path=[]; while(el && el.tagName==='IFRAME'){ const r=el.getBoundingClientRect(); const doc=el.contentDocument; if(!doc) break; const inner=doc.elementFromPoint(x-r.left,y-r.top); path.push('IFRAME'); el=inner; } return el? (el.tagName+'#'+el.id+'.'+String(el.className).slice(0,40)+' '+(el.innerText||'').slice(0,20)) : 'none'; }, [x,y]);
  await page.touchscreen.tap(x,y);
  return hit;
}
export async function tapText(page, frame, text, sel='button,div,a,span'){
  const loc = frame.locator(sel, { hasText: text }).last();
  await loc.evaluate(el=>el.scrollIntoView({block:'center',behavior:'auto'}));
  await sleep(250);
  const bb = await loc.boundingBox();
  if(!bb) throw new Error('no bbox text '+text);
  await page.touchscreen.tap(bb.x+bb.width/2, bb.y+bb.height/2);
}
export async function dismissWelcome(page, fr){
  try{ const b = fr.locator('#alertModal.show button.game-btn'); if(await b.count()){ const bb=await b.first().boundingBox(); await page.touchscreen.tap(bb.x+bb.width/2, bb.y+bb.height/2); await sleep(600); return true; } }catch(e){}
  return false;
}
export async function goHomeFromIsland(page, fr){
  const btn = fr.locator('.world-map-btn');
  const bb = await btn.boundingBox();
  await page.touchscreen.tap(bb.x+bb.width/2, bb.y+bb.height/2);
  await sleep(1200);
}
