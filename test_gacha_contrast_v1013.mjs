const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_gacha_contrast_v1013.mjs —— 单词大陆抽卡屏双色调对比度回归
 * 事故：抽卡屏卡片用 rgba(30,41,59,.5) 半透明深底 + 浅字，亮色调下底被通用钩子钩成灰、
 *       字仍是浅色 → 灰底灰字完全看不清；且 #landGachaBody / .lg-banner 长期在审计机
 *       豁免名单里，从未被扫出（与 v1010 的 Boss 屏同型问题）。
 * 合同：亮板卡片为白底(非灰)、屏内零低对比文字；暗板保持原深色设计。 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=__HSN_ROOT.replace(/\/$/, '');
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
const lum=(c)=>{const m=(c||'').match(/(\d+),\s*(\d+),\s*(\d+)/); return m? (+m[1]*.299+ +m[2]*.587+ +m[3]*.114) : -1;};
const R={}; const errs=[];
for(const [tag,pal] of [['light','cloud'],['dark',null]]){
  const page=await browser.newPage({viewport:{width:390,height:900}});
  page.on('pageerror',e=>errs.push(tag+'/P:'+String(e.message).slice(0,80)));
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();
    if(!/tcb-api|net::ERR_|Failed to fetch|Access to fetch/i.test(t)) errs.push(tag+'/C:'+t.slice(0,80));}});
  await page.addInitScript(p=>{if (window.top === window) localStorage.clear(); if(p) localStorage.setItem('hansen_palette_global',p);}, pal);
  await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>{ try{
    if(window.HansenLandGachaUI && HansenLandGachaUI.open) HansenLandGachaUI.open();
  }catch(e){} });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(()=>{
    const box=document.getElementById('landGachaBody');
    if(!box) return {found:false};
    const isLight=document.documentElement.classList.contains('hsn-pal-light');
    const base=isLight?[241,243,255]:[27,39,80];
    const comp=(s)=>{const m=(s||'').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s]+([\d.]+))?/);
      if(!m) return null; const a=m[4]!==undefined?parseFloat(m[4]):1;
      if(a>=1) return 'rgb('+m[1]+', '+m[2]+', '+m[3]+')';
      return 'rgb('+Math.round(+m[1]*a+base[0]*(1-a))+', '+Math.round(+m[2]*a+base[1]*(1-a))+', '+Math.round(+m[3]*a+base[2]*(1-a))+')';};
    const bad=[]; const cardBgs=[];
    const walk=(el)=>{ el.childNodes.forEach(n=>{
      if(n.nodeType===3 && n.textContent.trim().length>=2){
        const rr=el.getBoundingClientRect(); if(rr.width<1||rr.height<1) return;
        const cs=getComputedStyle(el);
        if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return;
        if(/^[\s\u200d\ufe0f\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+$/u.test(n.textContent.trim())) return;
        let bgc=null,c2=el;
        while(c2&&c2!==document.body){ const s=getComputedStyle(c2);
          const bi=s.backgroundImage,bc=s.backgroundColor;
          const first=(bi&&bi!=='none')?(bi.match(/rgba?\([^)]+\)/)||[])[0]:null;
          const probe=first||((bc&&!/rgba\(0, 0, 0, 0\)/.test(bc))?bc:null);
          if(probe){bgc=comp(probe);break;} c2=c2.parentElement; }
        if(bgc) bad.push([n.textContent.trim().slice(0,8), cs.color, bgc]);
      } else if(n.nodeType===1) walk(n); });};
    walk(box);
    box.querySelectorAll('*').forEach(e=>{ const s=getComputedStyle(e);
      if(s.backgroundColor && !/rgba\(0, 0, 0, 0\)/.test(s.backgroundColor)) cardBgs.push(comp(s.backgroundColor)); });
    return { found:true, samples:bad.slice(0,20), cardBgs:cardBgs.slice(0,6) };
  });
  await page.close(); R[tag]=r;
}
for(const k of ['light','dark']){
  const r=R[k]; if(!r.found){ console.log(k,'未打开抽卡屏'); continue; }
  const clash=r.samples.filter(s=>Math.abs(lum(s[1])-lum(s[2]))<55);
  console.log(`[${k}] 文字样本${r.samples.length} 低对比${clash.length} | 卡底样本 ${r.cardBgs.slice(0,3).join(' ')}`);
  clash.slice(0,4).forEach(s=>console.log(`      [${s[0]}] 字${s[1]} 底${s[2]}`));
}
console.log('ERRORS:', errs.length, errs.slice(0,3).join('|'));
await browser.close(); srv.close();
const L=R.light, D=R.dark;
const cl=(r)=>r.found? r.samples.filter(s=>Math.abs(lum(s[1])-lum(s[2]))<55).length : 99;
/* 亮板卡片必须是白底(不得是灰底) */
const lightWhite = L.found && L.cardBgs.some(b=>lum(b)>240);
const ok = L.found && D.found && cl(L)===0 && cl(D)===0 && lightWhite && errs.length===0;
process.exit(ok?0:1);
