const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_ach_series_v1034.mjs —— 成就「阶梯系列」回归
 * 两个问题：
 *  ① v1020 新增的「复习/精通/速度/对决」四类共 22 个成就，
 *     渲染函数的分类清单写死为 9 类，**做了但页面根本不显示**
 *     ——用户反映"成就太少"有一部分正是这个原因。
 *  ② 成就是散的，没有"同一条线不断升级"的阶梯感。
 * 合同：① 渲染分类必须覆盖全部实际分类，不得再有成就被藏起来；
 *       ② 成就成系列(series/step)，每系列多级递进；
 *       ③ 成就页能正常打开、零脚本错误。 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=__HSN_ROOT.replace(/\/$/, '');
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
const errs=[];
console.log('成就阶梯系列 v1034');
const page=await browser.newPage({viewport:{width:390,height:900}});
page.on('pageerror',e=>errs.push(String(e.message).slice(0,80)));
await page.addInitScript(()=>{if (window.top === window) localStorage.clear();});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2800);
const r = await page.evaluate(()=>{
  const A = window.ACHIEVEMENTS || [];
  const cats = [...new Set(A.map(a=>a.cat))];
  const series = {};
  A.forEach(a=>{ if(a.series){ (series[a.series]=series[a.series]||[]).push(a.step||0); } });
  // 打开成就页
  let rendered=0, shownCats=0;
  try{ showScreen('ach'); }catch(e){}
  const sc=document.getElementById('achScreen')||document.querySelector('.screen.active');
  if(sc){ rendered = sc.querySelectorAll('.ach-item, .ach-card, [class*="ach-"]').length;
          shownCats = sc.querySelectorAll('.ach-bar').length; }
  return { total:A.length, cats, nSeries:Object.keys(series).length,
    multiStep: Object.values(series).filter(v=>v.length>=2).length,
    maxSteps: Math.max(0,...Object.values(series).map(v=>v.length)),
    tiers:[...new Set(A.map(a=>a.tier))], rendered, shownCats };
});
ok(r.total>=140, `成就总数 ${r.total}（此前 76）`);
ok(r.nSeries>=20, `成系列的线 ${r.nSeries} 条`);
ok(r.multiStep>=20, `其中 ${r.multiStep} 条是多级递进`);
ok(r.maxSteps>=4, `最长的一条有 ${r.maxSteps} 级`);
ok(r.tiers.length>=4, `档位齐全: ${r.tiers.join('/')}`);
ok(r.shownCats>=13, `成就页展示了 ${r.shownCats} 个分类（实际 ${r.cats.length} 类，不再有被藏起来的）`);
ok(r.rendered>0, `成就页正常渲染（${r.rendered} 个元素）`);
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
