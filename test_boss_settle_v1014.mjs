/* test_boss_settle_v1014.mjs —— Boss 结算页(战败/胜利)双色调回归
 * 事故：标题用"渐变填充文字"(background-clip:text)，亮色调下填充被改实色而重晕仍在，
 *       标题背后糊出一团深色污迹；「选其他 boss」用 🔙 emoji(天生深灰)压蓝按钮上看不清。
 * 合同：标题亮板深色/暗板浅色、无 text-shadow；页面不得再出现 🔙。 */
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
  await page.addInitScript(p=>{localStorage.clear(); if(p) localStorage.setItem('hansen_palette_global',p);}, pal);
  await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2400);
  await page.evaluate(()=>{ try{ showScreen('boss'); if(typeof bossDefeat==='function') bossDefeat(); }catch(e){} });
  await page.waitForTimeout(1000);
  const r = await page.evaluate(()=>{
    const h=document.querySelector('.boss-victory h2');
    if(!h) return {found:false};
    const cs=getComputedStyle(h);
    let bg=null,c2=h;
    while(c2&&c2!==document.body){ const s=getComputedStyle(c2);
      const bi=s.backgroundImage,bc=s.backgroundColor;
      const first=(bi&&bi!=='none')?(bi.match(/rgba?\([^)]+\)/)||[])[0]:null;
      const probe=first||((bc&&!/rgba\(0, 0, 0, 0\)/.test(bc))?bc:null);
      if(probe){bg=probe;break;} c2=c2.parentElement; }
    /* 标题是"渐变填充文字": 可见颜色来自 h2 自身的 background 渐变, 而非 fill */
    const own=getComputedStyle(h).backgroundImage;
    const grad=(own&&own!=='none')?(own.match(/rgba?\([^)]+\)/)||[])[0]:null;
    const visible = grad || cs.webkitTextFillColor || cs.color;
    /* 屏底(排除 h2 自身) */
    let pageBg=null,c3=h.parentElement;
    while(c3&&c3!==document.body){ const s=getComputedStyle(c3);
      const bi=s.backgroundImage,bc=s.backgroundColor;
      const f=(bi&&bi!=='none')?(bi.match(/rgba?\([^)]+\)/)||[])[0]:null;
      const pr=f||((bc&&!/rgba\(0, 0, 0, 0\)/.test(bc))?bc:null);
      if(pr){pageBg=pr;break;} c3=c3.parentElement; }
    if(!pageBg) pageBg=getComputedStyle(document.body).backgroundColor;
    return { found:true, visible:visible, shadow:cs.textShadow, bg:pageBg,
      hasBackEmoji: /🔙/.test(document.body.innerHTML) };
  });
  await page.close(); R[tag]=r;
}
for(const k of ['light','dark']){
  const r=R[k]; if(!r.found){console.log(k,'未进结算页');continue;}
  console.log(`[${k}] 标题可见色${r.visible} 亮度${lum(r.visible).toFixed(0)} | 屏底${r.bg} 亮度${lum(r.bg).toFixed(0)} | 阴影:${(r.shadow||'none').slice(0,26)}`);
}
console.log('🔙 残留:', R.light.hasBackEmoji);
console.log('ERRORS:', errs.length);
await browser.close(); srv.close();
const L=R.light;
const D2=R.dark;
const ok = L.found && lum(L.visible)<120 && lum(D2.visible)>150
  && (L.shadow==='none'||!L.shadow) && !L.hasBackEmoji && errs.length===0;
process.exit(ok?0:1);
