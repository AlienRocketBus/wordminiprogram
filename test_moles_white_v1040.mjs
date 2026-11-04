const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_moles_white_v1040.mjs —— 打地鼠洞口白底黑字回归
 * 事故：v1010 为做出"凹陷立体感"给地鼠洞用了金黄渐变(#fde68a→#fbbf24→#d97706)，
 *   但金底本身就不利于看清内容——用户反馈"背景金黄色特别看不清楚"。
 * 修法：亮色调改白底 + 轻内阴影 + 淡边框：立体感靠阴影而非颜色，内容最清楚。
 * 合同：亮板洞口接近纯白、洞内文字近黑；暗板保持原深色设计不变；零脚本错误。 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=__HSN_ROOT.replace(/\/$/, '');
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const b=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
const lum=(c)=>{const m=(c||'').match(/(\d+),\s*(\d+),\s*(\d+)/); return m? (+m[1]*.299+ +m[2]*.587+ +m[3]*.114) : -1;};
const R={}; const errs=[];
for(const [tag,pal] of [['亮','cloud'],['暗',null]]){
  const page=await b.newPage({viewport:{width:390,height:900}});
  page.on('pageerror',e=>errs.push(tag+':'+String(e.message).slice(0,70)));
  await page.addInitScript(p=>{if (window.top === window) localStorage.clear(); if(p) localStorage.setItem('hansen_palette_global',p);}, pal);
  await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>{ try{ showScreen('moles'); if(typeof startMolesLevel==='function') startMolesLevel('hard'); }catch(e){} });
  await page.waitForTimeout(1600);
  R[tag]=await page.evaluate(()=>{
    const s=document.querySelector('.mole-slot'), cn=document.querySelector('.mole-cn');
    const bg=(e)=>{ if(!e) return null; const c=getComputedStyle(e);
      return (c.backgroundImage!=='none'?c.backgroundImage:c.backgroundColor); };
    return { slot:bg(s), cnFg:cn?getComputedStyle(cn).color:null,
      cnBg:cn?getComputedStyle(cn).backgroundColor:null, n:document.querySelectorAll('.mole-slot').length };
  });
  await page.close();
}
for(const k of ['亮','暗']){ const r=R[k];
  const sl=lum((r.slot.match(/rgba?\([^)]+\)/)||[])[0]);
  console.log(`[${k}] 洞口亮度${sl.toFixed(0)} | 名牌字${lum(r.cnFg).toFixed(0)} 底${r.cnBg} | 洞${r.n}个`);
}
console.log('ERRORS:',errs.length);
await b.close(); srv.close();
const L=R['亮'], D=R['暗'];
const lS=lum((L.slot.match(/rgba?\([^)]+\)/)||[])[0]), dS=lum((D.slot.match(/rgba?\([^)]+\)/)||[])[0]);
const ok = lS>240 && lum(L.cnFg)<80 && dS<120 && lum(D.cnFg)>150 && !errs.length;
process.exit(ok?0:1);
