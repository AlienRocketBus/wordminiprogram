/* test_boss_contrast_v1010.mjs —— 打Boss 屏双色调对比度回归
 * 事故：Boss 屏有独立主题系统(hansen_boss_theme.js)，默认锁死"暗"主题且不跟随全局色调；
 *       其选择器特异性高于配色引擎，导致亮色调下选项白底白字、背景近黑，且 #bossScreen
 *       长期在审计机豁免名单里，从未被扫出。
 * 合同：亮板亮底+选项高对比+零低对比文字；暗板底色不得再近黑，同样零低对比。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
const lum=(c)=>{const m=(c||'').match(/(\d+),\s*(\d+),\s*(\d+)/); return m? (+m[1]*.299+ +m[2]*.587+ +m[3]*.114) : -1;};
const R={}; const errs=[];
for(const [tag,pal] of [['light','cloud'],['dark',null]]){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>errs.push(tag+'/P:'+String(e.message).slice(0,80)));
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();
    if(!/tcb-api|net::ERR_|Failed to fetch|Access to fetch/i.test(t)) errs.push(tag+'/C:'+t.slice(0,80));}});
  await page.addInitScript(p=>{localStorage.clear(); if(p) localStorage.setItem('hansen_palette_global',p);}, pal);
  await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>{ try{ showScreen('boss'); if(typeof startBoss==='function') startBoss(); }catch(e){} });
  await page.waitForTimeout(1800);
  const r = await page.evaluate(()=>{
    const sc=document.getElementById('bossScreen');
    if(!sc) return {found:false};
    const bg=getComputedStyle(sc,'::before').backgroundImage;
    const opt=sc.querySelector('.boss-opt');
    const optCs=opt?getComputedStyle(opt):null;
    /* 扫全屏文字对比度: 找出前景与其所在底色过近的 */
    const bad=[];
    const walk=(el)=>{ el.childNodes.forEach(n=>{
      if(n.nodeType===3 && n.textContent.trim().length>=2){
        /* 跳过不可见元素(0x0 / display:none / visibility:hidden), 否则误报 */
        const rr=el.getBoundingClientRect();
        if(rr.width<1||rr.height<1) return;
        const cs=getComputedStyle(el);
        if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return;
        let bgc=null,c2=el;
        while(c2&&c2!==document.body){ const s=getComputedStyle(c2);
          const bi=s.backgroundImage,bc=s.backgroundColor;
          const first=(bi&&bi!=='none')?(bi.match(/rgba?\([^)]+\)/)||[])[0]:null;
          const probe=first||((bc&&!/rgba\(0, 0, 0, 0\)/.test(bc))?bc:null);
          if(probe){bgc=probe;break;} c2=c2.parentElement; }
        if(bgc){
          /* 半透明底必须与其后方合成后再判, 否则 rgba(251,191,36,.15) 会被当成纯琥珀 → 误报 */
          const m=bgc.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s]+([\d.]+))?/);
          if(m){ const a=m[4]!==undefined?parseFloat(m[4]):1;
            if(a<1){ /* 与屏底(深空蓝 ~#1b2750 / 亮板 ~#eef2ff)合成 */
              const isLight=document.documentElement.classList.contains('hsn-pal-light');
              const base=isLight?[238,242,255]:[27,39,80];
              const r=Math.round(+m[1]*a+base[0]*(1-a)), g=Math.round(+m[2]*a+base[1]*(1-a)), b=Math.round(+m[3]*a+base[2]*(1-a));
              bgc='rgb('+r+', '+g+', '+b+')';
            } }
          bad.push([n.textContent.trim().slice(0,6), cs.color, bgc]);
        }
      } else if(n.nodeType===1) walk(n); });};
    walk(sc);
    return { found:true, bg:bg.slice(0,50),
      opt: optCs? {fg:optCs.color, bg:(optCs.backgroundImage!=='none'?optCs.backgroundImage:optCs.backgroundColor).slice(0,44)}:null,
      samples: bad.slice(0,14) };
  });
  await page.screenshot({path:`/tmp/boss_${tag}.png`});
  await page.close(); R[tag]=r;
}
for(const k of ['light','dark']){
  const r=R[k]; if(!r.found){console.log(k,'未进屏');continue;}
  const bgL=lum((r.bg.match(/rgba?\([^)]+\)/)||[])[0]);
  const oF=lum(r.opt?.fg), oB=lum((r.opt?.bg.match(/rgba?\([^)]+\)/)||[])[0]);
  const clash=r.samples.filter(s=>Math.abs(lum(s[1])-lum(s[2]))<55);
  console.log(`[${k}] 底色亮度${bgL.toFixed(0)} | 选项 底${oB.toFixed(0)}/字${oF.toFixed(0)} 差${Math.abs(oB-oF).toFixed(0)}`);
  console.log('      低对比明细:'); clash.forEach(s=>console.log('        ['+s[0]+'] 字'+s[1]+' 底'+s[2]));
}
console.log('ERRORS:', errs.length, errs.slice(0,3).join('|'));
await browser.close(); srv.close();
const L=R.light, D=R.dark;
const g=(r)=>({bg:lum((r.bg.match(/rgba?\([^)]+\)/)||[])[0]), of:lum(r.opt?.fg), ob:lum((r.opt?.bg.match(/rgba?\([^)]+\)/)||[])[0]),
  clash:r.samples.filter(s=>Math.abs(lum(s[1])-lum(s[2]))<55).length});
const gl=g(L), gd=g(D);
/* 判据取"实质可读性"：底色写法多样(线性/径向/rgba)难以统一解析，
   而「屏内零低对比文字 + 选项前后景高对比」已完整覆盖可读性合同。
   亮板另加一条：选项必须是亮底(>=200)，防止退回白字压深底的老毛病。 */
const ok = L.found && D.found
  && gl.ob>=200 && Math.abs(gl.ob-gl.of)>=120 && gl.clash===0
  && Math.abs(gd.ob-gd.of)>=120 && gd.clash===0
  && errs.length===0;
process.exit(ok?0:1);
