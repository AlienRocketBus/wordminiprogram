const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_today_overlay_fixed_v1006.mjs —— 今日复习「完成态」浮层定位回归
 * 事故：finish() 里 overlay.innerHTML=... 会冲掉内部 <style> 中的
 *       #hr_today{position:fixed;inset:0}，浮层退化为普通块元素掉到页面底部，
 *       用户在成就页/卡册页底部看到一条绿色长条。
 * 合同：走完整轮复习到「今日复习完成」后，浮层必须仍是 fixed 且铺满视口。 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=__HSN_ROOT.replace(/\/$/, '');
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errs=[];
page.on('pageerror',e=>errs.push('P:'+String(e.message).slice(0,90)));
await page.addInitScript(()=>{ if (window.top === window) localStorage.clear();
  /* 种到期错词, 让今日复习有内容可做 */
  const wr={}; for(let i=0;i<2;i++) wr[String(i)]=1;
  localStorage.setItem('hansen_canonical_progress_v941', JSON.stringify({islands:{animal:{wrongs:wr,srs:{}}}}));
});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2600);
await page.evaluate(()=>{ try{ HansenReview._openToday(); }catch(e){} });
await page.waitForTimeout(1200);

const before = await page.evaluate(()=>{
  const el=document.getElementById('hr_today');
  return el? { pos:getComputedStyle(el).position, h:Math.round(el.getBoundingClientRect().height) } : null;
});

/* 把复习一路点完, 触发「今日复习完成」那段 innerHTML 替换 */
for(let step=0; step<40; step++){
  const done = await page.evaluate(()=>{
    const el=document.getElementById('hr_today');
    if(!el) return 'gone';
    if(/今日复习完成/.test(el.textContent||'')) return 'complete';
    /* 精确按 ID 点：先揭示答案, 再点「记得」推进; 绝不碰顶部关闭按钮 */
    const got=el.querySelector('#ht_b_got');
    if(got){ got.click(); return 'clicked'; }
    const show=el.querySelector('.ht_show,#ht_show');
    if(show){ show.click(); return 'clicked'; }
    const body=[...el.querySelectorAll('button')].filter(b=>b.offsetParent!==null && !b.closest('.ht_top'));
    if(body[0]){ body[0].click(); return 'clicked'; }
    return 'stuck';
  });
  if(done==='complete'||done==='gone') break;
  await page.waitForTimeout(280);
}

const after = await page.evaluate(()=>{
  const el=document.getElementById('hr_today');
  if(!el) return {absent:true};
  const cs=getComputedStyle(el), r=el.getBoundingClientRect();
  const body=document.body.getBoundingClientRect();
  return { complete:/今日复习完成/.test(el.textContent||''),
    pos:cs.position, top:Math.round(r.top), h:Math.round(r.height),
    coversScreen: r.top<=1 && r.height>=window.innerHeight-2,
    bodyH:Math.round(body.height), viewH:window.innerHeight };
});
console.log('打开时:', JSON.stringify(before));
console.log('完成后:', JSON.stringify(after));
console.log('ERRORS:', errs.length, errs.slice(0,2).join('|'));
await page.screenshot({path:'/tmp/greenfix.png'});
await browser.close(); srv.close();
/* 判据: 完成态浮层必须仍是 fixed 且铺满视口(不掉到页面底部) */
const ok = after.absent || (after.pos==='fixed' && after.coversScreen);
console.log(ok? '✅ 完成态浮层仍固定铺满, 绿块事故已修' : '❌ 浮层脱离固定定位');
process.exit(ok && !errs.length ?0:1);
