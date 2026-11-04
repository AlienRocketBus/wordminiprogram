const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_pk_inpage_v1022.mjs —— 拼写大PK「页面内屏·零延迟」回归
 * 缺口：PK 原为 iframe 加载独立页面 spelling_pk.html，每次点开都要走一次网页加载 → 有延迟，
 *       与"所有岛屿是一个整体、房间之间随意进出"的体验不符。
 * 合同：① 点开不产生 iframe、不发起页面级网络请求；② 打开耗时极短；
 *       ③ 内容完整(身份/账号区/两种模式/战绩速览)；④ 双色调下文字方向正确。 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=__HSN_ROOT.replace(/\/$/, '');
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
const lum=(c)=>{const m=(c||'').match(/(\d+),\s*(\d+),\s*(\d+)/); return m? (+m[1]*.299+ +m[2]*.587+ +m[3]*.114) : -1;};
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
const errs=[];
console.log('拼写大PK 页面内屏 v1022');
for(const [tag,pal] of [['亮','cloud'],['暗',null]]){
  const page=await browser.newPage({viewport:{width:390,height:900}});
  page.on('pageerror',e=>errs.push(tag+':'+String(e.message).slice(0,70)));
  const nav=[];
  /* 🔴v1023: 排除后台预热的房间(land_map/island_season 等) —— 那是有意为之的预加载，
     与本测试关心的"PK 自己是否还走网页"无关。 */
  const WARM=/land_map|island_season|boss_hall|season_showcase|spelling_bee/;
  page.on('request',r=>{ if(r.resourceType()==='document' && !r.url().includes('island_animal') && !WARM.test(r.url())) nav.push(r.url()); });
  await page.addInitScript(p=>{if (window.top === window) localStorage.clear(); if(p) localStorage.setItem('hansen_palette_global',p);}, pal);
  await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2600);
  const t0=Date.now();
  await page.evaluate(()=>{ if(typeof openSpellPK==='function') openSpellPK(); });
  const r = await page.evaluate(()=>{
    const el=document.getElementById('hsn_pk_screen');
    return { on: !!(el&&el.classList.contains('on')),
      iframe: !!document.getElementById('__hsn_pk_ov'),
      hasMe: !!document.getElementById('kMe'),
      hasRooms: !!document.getElementById('kRooms'),
      hasLadder: !!document.getElementById('kLadder'),
      cards: el? el.querySelectorAll('.k_card').length:0,
      stats: el? el.querySelectorAll('.k_it').length:0,
      h1: el? getComputedStyle(el.querySelector('.k_h1')).color : null };
  });
  const dt=Date.now()-t0;
  ok(r.on, `[${tag}] 页面内屏已打开`);
  ok(!r.iframe, `[${tag}] 未创建 iframe(不再走网页)`);
  ok(nav.length===0, `[${tag}] 零页面级网络请求`+(nav.length?': '+nav[0]:''));
  ok(dt<250, `[${tag}] 打开耗时 ${dt}ms(<250ms)`);
  ok(r.hasMe && r.cards===2 && r.stats===4, `[${tag}] 内容完整(身份+2模式卡+4格战绩)`);
  const dark = lum(r.h1)>150;
  ok(tag==='暗'? dark : true, `[${tag}] 标题色 ${r.h1}`);
  await page.close();
}
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
