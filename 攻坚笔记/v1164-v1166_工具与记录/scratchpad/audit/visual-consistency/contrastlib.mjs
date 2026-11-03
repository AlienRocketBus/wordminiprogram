import { PNG } from '/opt/node-tools/node_modules/playwright-core/lib/utilsBundle.js';
export function lum([r,g,b]){ const f=c=>{c/=255; return c<=0.03928? c/12.92 : Math.pow((c+0.055)/1.055,2.4);}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); }
export function cr(a,b){ const l1=lum(a), l2=lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); }
function parseRGB(s){ const m=s.match(/rgba?\(([^)]+)\)/); if(!m) return null; const p=m[1].split(',').map(x=>parseFloat(x)); return {rgb:p.slice(0,3), a: p.length>3?p[3]:1}; }
// measure contrast of text in element(s) matched in frame (or page)
export async function measure(page, frame, sel, label, max=3){
  const off = frame===page.mainFrame() ? {x:0,y:0} : await page.evaluate(()=>{const f=document.getElementById('islandFrame'); if(!f) return {x:0,y:0}; const r=f.getBoundingClientRect(); return {x:r.left,y:r.top};});
  const items = await frame.evaluate(([sel,max])=>{
    const out=[]; const els=[...document.querySelectorAll(sel)];
    for(const e of els){
      const r=e.getBoundingClientRect(); const c=getComputedStyle(e);
      if(r.width<4||r.height<4||c.display==='none'||c.visibility==='hidden'||+c.opacity===0) continue;
      if(r.bottom<0||r.top>window.innerHeight) continue;
      const txt=(e.innerText||'').trim(); if(!txt) continue;
      const id='__cm'+Math.random().toString(36).slice(2,8); e.setAttribute('data-cm',id);
      out.push({id, txt:txt.slice(0,24), color:c.color, fill:c.webkitTextFillColor, bgclip:c.webkitBackgroundClip||c.backgroundClip, fs:c.fontSize, fw:c.fontWeight, ts:c.textShadow!=='none', r:{x:r.left,y:r.top,w:r.width,h:r.height}});
      if(out.length>=max) break;
    }
    return out;
  }, [sel,max]);
  const res=[];
  for(const it of items){
    if(it.bgclip==='text'){ res.push({label, sel, txt:it.txt, note:'gradient text (background-clip:text) — not measurable by color', fs:it.fs}); continue; }
    const col=parseRGB(it.fill && it.fill!=='rgba(0, 0, 0, 0)' ? it.fill : it.color) || parseRGB(it.color);
    // hide its text
    await frame.evaluate(id=>{ const e=document.querySelector(`[data-cm="${id}"]`); if(!e) return; e.__oldStyle=e.getAttribute('style')||''; e.setAttribute('style', e.__oldStyle+';color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important'); e.querySelectorAll('*').forEach(k=>{k.__o=k.getAttribute('style')||''; k.setAttribute('style',k.__o+';color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important');}); }, it.id);
    await new Promise(r=>setTimeout(r,60));
    const clip={x:Math.max(0,it.r.x+off.x), y:Math.max(0,it.r.y+off.y), width:Math.max(2,Math.min(it.r.w, 390-(it.r.x+off.x))), height:Math.max(2,Math.min(it.r.h,844-(it.r.y+off.y)))};
    let buf;
    try{ buf = await page.screenshot({clip, animations:'disabled'}); }catch(e){ buf=null; }
    await frame.evaluate(id=>{ const e=document.querySelector(`[data-cm="${id}"]`); if(!e) return; e.setAttribute('style', e.__oldStyle); e.querySelectorAll('*').forEach(k=>{k.setAttribute('style',k.__o||'');}); if(!e.getAttribute('style')) e.removeAttribute('style'); e.removeAttribute('data-cm'); }, it.id);
    if(!buf||!col){ res.push({label, sel, txt:it.txt, note:'no sample'}); continue; }
    const png = PNG.sync.read(buf);
    const px=[]; for(let i=0;i<png.data.length;i+=4*3){ px.push([png.data[i],png.data[i+1],png.data[i+2]]); }
    // composite text color alpha over mean bg
    const mean=[0,1,2].map(k=>px.reduce((s,p)=>s+p[k],0)/px.length);
    let tc=col.rgb; if(col.a<1){ tc=tc.map((v,k)=>v*col.a+mean[k]*(1-col.a)); }
    const crs=px.map(p=>cr(tc,p)).sort((a,b)=>a-b);
    const p10=crs[Math.floor(crs.length*0.1)], med=crs[Math.floor(crs.length*0.5)];
    res.push({label, sel, txt:it.txt, fs:it.fs, fw:it.fw, textColor:'rgb('+tc.map(Math.round).join(',')+')', bgMean:'rgb('+mean.map(Math.round).join(',')+')', crMean:+cr(tc,mean).toFixed(2), crP10:+p10.toFixed(2), crMedian:+med.toFixed(2), shadow:it.ts});
  }
  return res;
}
