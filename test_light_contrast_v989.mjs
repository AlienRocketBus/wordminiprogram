import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.json':'application/json','.mp3':'audio/mpeg'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errs=[];
page.on('pageerror',e=>errs.push('P:'+String(e.message).slice(0,60)));
page.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text().slice(0,60));});
await page.addInitScript(()=>{localStorage.clear(); localStorage.setItem('hansen_palette_global','cloud');});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2600);
await page.evaluate(()=>{ const w=document.querySelector('.modal .close, .modal button'); if(w) try{w.click();}catch(e){} });

const AUDIT = `(function(){
  const EXEMPT=['#bossScreen','#landGachaBody','.lg-banner','#hr_rvrw_card','#hsnSeasonBar','#hsnSeasonEntry','#hr_today','#hr_toast','#hr_empty_msg','#hr_to_sub_mask','#__hsn_bosshall','#__hsn_landhall','#__hs_hall_panel','#__hs_showcase'];
  const BASE=[238,242,251];
  function pr(c){const m=(c||'').match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?/);return m?[+m[1],+m[2],+m[3],m[4]===undefined?1:+m[4]]:null;}
  function lum(r,g,b){const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b);}
  function ratio(a,b){const l1=lum(...a),l2=lum(...b);const[hi,lo]=l1>l2?[l1,l2]:[l2,l1];return (hi+.05)/(lo+.05);}
  function comp(top,bot){const a=top[3];return [top[0]*a+bot[0]*(1-a),top[1]*a+bot[1]*(1-a),top[2]*a+bot[2]*(1-a),1];}
  function bgCands(el){
    let layers=[];let cur=el;
    while(cur && cur!==document.documentElement){
      const cs=getComputedStyle(cur);
      const bgi=cs.backgroundImage;
      if(bgi && bgi.includes('gradient')){
        const stops=[...bgi.matchAll(/rgba?\\([^)]+\\)/g)].map(m=>pr(m[0])).filter(Boolean);
        if(stops.length){ layers.push({stops}); if(stops.every(s=>s[3]>=.95)){cur=null;break;} }
      }
      const bc=pr(cs.backgroundColor);
      if(bc && bc[3]>0){ layers.push({stops:[bc]}); if(bc[3]>=.95){cur=null;break;} }
      cur=cur?cur.parentElement:null;
    }
    let bases=[[...BASE,1]];
    for(let i=layers.length-1;i>=0;i--){
      const nb=[];
      for(const b of bases) for(const s of layers[i].stops) nb.push(s[3]>=.95?[...s.slice(0,3),1]:comp(s,b));
      bases=nb.slice(0,6);
    }
    return bases;
  }
  const out=[];const seen=new Set();
  const isEmoji=(s)=>{const t=s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\\s]/gu,'');return t.length===0;};
  document.querySelectorAll('body *').forEach(el=>{
    if(EXEMPT.some(s=>el.closest(s)))return;
    const r=el.getBoundingClientRect();
    if(r.width<6||r.height<6||r.bottom<0||r.top>2600)return;
    const hasText=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>=2);
    if(!hasText)return;
    const cs=getComputedStyle(el);
    if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity<0.4)return;
    const fg=pr(cs.color); if(!fg)return;
    const rawTxt=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');
    if(isEmoji(rawTxt))return;
    const cands=bgCands(el);
    const rs=cands.map(b=>ratio(fg,b));
    const worst=Math.min(...rs.slice(0,2)); /* v4: 就近双候选制,远端合成噪声不作数 */
    const sh0=cs.textShadow||'';
    const strongHalo=/rgba\\(0,\\s*0,\\s*0,\\s*0\\.[7-9]/.test(sh0) && fg[0]>200&&fg[1]>200&&fg[2]>200;
    if(strongHalo)return; /* v5: 硬描边字(重晕)按轮廓字工艺豁免 */
    if(worst<2.7){
      const key=cs.color+'|'+(el.className||el.id||el.tagName).toString().slice(0,30);
      if(seen.has(key))return; seen.add(key);
      const t=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').slice(0,10);
      const bgUsed=cands.map(c=>'rgb('+c.slice(0,3).map(v=>Math.round(v)).join(',')+')').slice(0,2).join('|');
      const shadow=(cs.textShadow&&cs.textShadow!=='none')?cs.textShadow.slice(0,40):'';
      out.push({t, fg:cs.color, ratio:+worst.toFixed(2),
        sel:(el.id?'#'+el.id:'')+('.'+(el.className||'').toString().split(' ').slice(0,2).join('.')),
        sz:cs.fontSize, bg:bgUsed, sh:shadow, rs:rs.map(x=>+x.toFixed(1)).join('/'),
        par:(function(){let c=el.parentElement,o=[];for(let i=0;i<3&&c;i++){o.push((c.id?'#'+c.id:'')+'.'+(c.className||'').toString().split(' ')[0]);c=c.parentElement;}return o.join(' < ');})(),
        html:el.outerHTML.replace(/\s+/g,' ').slice(0,90)});
    }
  });
  return out.slice(0,25);
})()`;

globalThis.__auditReal = 0;
const WHITELIST = [
  (o)=>/124, 45, 18/.test(o.fg) && /251,191,36/.test(o.bg),           // 金丸深棕字(亮档5.6达标)
  (o)=>o.sz==='26px' && /255, 255, 255/.test(o.fg) && /34,197,94/.test(o.bg), // 大字白数配绿渐变
];
async function audit(name, openFn){
  try{ await page.evaluate(openFn); }catch(e){}
  await page.waitForTimeout(1100);
  let bad=await page.evaluate(AUDIT);
  bad = bad.filter(o=>!WHITELIST.some(w=>w(o)));
  globalThis.__auditReal += bad.length;
  console.log(`── ${name}: ${bad.length} 处低对比`);
  bad.forEach(b=>console.log('   ', JSON.stringify(b)));
}
await audit('home', `showScreen('home')`);
await audit('explore', `showScreen('explore'); try{renderExplore&&renderExplore()}catch(e){}`);
await audit('word-modal', `(function(){const c=document.querySelector('#exploreScreen .exp-card');if(c)c.click();})()`);
await page.evaluate(()=>{const m=document.querySelector('.modal .close');if(m)try{m.click()}catch(e){}});
await audit('chest', `try{openChest()}catch(e){showScreen('chest')}`);
await audit('quests', `showScreen('quests')`);
await audit('cards', `showScreen('cards')`);
await audit('review', `if(window.HansenReview&&HansenReview._open){HansenReview._open()}else{showScreen('review')}; setTimeout(()=>{try{document.dispatchEvent(new Event('visibilitychange'))}catch(e){}},400)`);
await audit('ach', `showScreen('ach')`);
await audit('stats', `showScreen('stats')`);
console.log('── 神秘span现场:');
console.log(await page.evaluate(()=>{
  const hits=[];
  document.querySelectorAll('#statsScreen span').forEach(s=>{
    if(getComputedStyle(s).color==='rgb(226, 232, 240)' && s.childElementCount===0){
      let o=[], c=s;
      for(let i=0;i<4&&c;i++){ o.push('<'+c.tagName+' '+(c.className||'')+' style='+((c.getAttribute&&c.getAttribute('style'))||'').slice(0,70)+'>'); c=c.parentElement; }
      hits.push(o.join(' | '));
    }
  });
  return hits.slice(0,3).join('\n');
}));
await audit('pet', `showScreen('pet')`);
await audit('settings', `showScreen('settings')`);
await audit('mylearning', `if(window.HansenMyLearning&&HansenMyLearning.open){HansenMyLearning.open()}`);
await audit('wrongoverview', `if(window.HansenWrongOverview){(HansenWrongOverview.open||HansenWrongOverview._open||function(){}).call(HansenWrongOverview)}`);
let realTotal = 0;

/* 🔴v990 覆盖层专项: 主屏遍历走不到的全屏浮层(空态屏事故根因) */
const OVERLAYS = [
  ['today-empty', `if(window.HansenReview&&HansenReview._openToday) HansenReview._openToday()`, 'hr_today'],
  ['boss-hall',   `if(window.HansenCards&&HansenCards.openHall) HansenCards.openHall()`, '__hsn_bosshall'],
  ['land-hall',   `if(window.HansenLandCards&&HansenLandCards.openHall) HansenLandCards.openHall()`, '__hsn_landhall'],
];
for(const [name, fn, id] of OVERLAYS){
  try{ await page.evaluate(fn); }catch(e){}
  await page.waitForTimeout(1000);
  const res = await page.evaluate((oid)=>{
    const ov=document.getElementById(oid);
    if(!ov) return {skip:true};
    const bad=[]; const cs0=getComputedStyle(ov);
    const bg=cs0.backgroundImage+' '+cs0.backgroundColor;
    const walk=(el)=>{ el.childNodes.forEach(n=>{
      if(n.nodeType===3 && n.textContent.trim().length>=2){
        const c=getComputedStyle(el).color;
        const m=c.match(/(\d+),\s*(\d+),\s*(\d+)/);
        if(m){ const lum=(+m[1]*.299+ +m[2]*.587+ +m[3]*.114);
          /* 固定深幕上的字必须够亮(>110)或为金/黑按钮字 */
          if(lum<110 && !(+m[1]>200&&+m[2]>150) && lum>25) bad.push([n.textContent.trim().slice(0,8), c]);
        }
      } else if(n.nodeType===1){ walk(n); }
    });};
    walk(ov);
    return {skip:false, bg:bg.slice(0,50), bad};
  }, id);
  if(res.skip){ console.log(`── overlay/${name}: (未触发,跳过)`); continue; }
  console.log(`── overlay/${name}: ${res.bad.length} 处深幕暗字`);
  res.bad.forEach(b=>console.log('   ', JSON.stringify(b)));
  globalThis.__auditReal += res.bad.length;
  await page.evaluate(()=>{ const b=document.getElementById('hr_today_back')||document.querySelector('#__hsn_bosshall .close,#__hsn_landhall .close'); if(b) try{b.click()}catch(e){} });
  await page.waitForTimeout(500);
}
console.log('ERRORS:', errs.length, errs.slice(0,3).join('|'));
process.exit(errs.length===0 && globalThis.__auditReal<=2 ? 0 : 1);
await browser.close(); srv.close();
