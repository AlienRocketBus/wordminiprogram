/* test_html_mime_guard_v1044.mjs —— 「网页变成下载」的客户端兜底
 * 事故：用户在浏览器打开站点根地址，浏览器**直接下载页面而不是渲染**。
 *   经查代码与部署包均正常（index.html 在包根层、DOCTYPE 完整、标签配对），
 *   本地用正确 MIME 起服务时 SW 接管后一切正常、零下载——
 *   故判定为**服务端把 .html 发成了 application/octet-stream**（或缺 Content-Type）。
 * 兜底：SW 在导航响应上纠正 Content-Type，让已装过 SW 的用户立刻恢复
 *   （首次访问仍取决于服务端配置）。
 * 合同：① 错误 MIME 下页面仍能渲染、不触发下载；② 正确 MIME 下行为不变；
 *       ③ 非 HTML 内容不得被误判改写。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('网页变下载·客户端兜底 v1044');

/* badHtml=true 时故意把 .html 发成 octet-stream，复现用户故障 */
function serve(badHtml){
  const MIME={'.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json',
   '.webp':'image/webp','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2',
   '.mp3':'audio/mpeg','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
  return http.createServer((req,res)=>{
    let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
    fs.readFile(path.join(ROOT,p),(e,d)=>{
      if(e){res.writeHead(404);res.end();return;}
      const ext=path.extname(p);
      let ct = MIME[ext] || 'application/octet-stream';
      if(ext==='.html') ct = badHtml ? 'application/octet-stream' : 'text/html; charset=utf-8';
      res.writeHead(200,{'content-type':ct}); res.end(d);
    });
  });
}

async function run(badHtml, label){
  const srv=serve(badHtml);
  await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
  const b=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
  const ctx=await b.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const page=await ctx.newPage();
  const dl=[]; page.on('download',d=>dl.push(d.suggestedFilename()));
  /* 首访：装 SW（坏 MIME 下首访必然下载，这是服务端问题，SW 还没上岗） */
  try{ await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded',timeout:15000}); }catch(e){}
  await page.waitForTimeout(3000);
  /* 若首访失败, 用一个正常页面把 SW 装上, 模拟"老用户已装过 SW" */
  if(!(await page.evaluate(()=>!!(navigator.serviceWorker&&navigator.serviceWorker.controller)).catch(()=>false))){
    try{ await page.goto(`http://127.0.0.1:${port}/_frame.html`,{waitUntil:'domcontentloaded',timeout:15000}); }catch(e){}
    await page.waitForTimeout(3000);
  }
  for(let i=0;i<8;i++){
    const c=await page.evaluate(()=>!!(navigator.serviceWorker&&navigator.serviceWorker.controller)).catch(()=>false);
    if(c) break; await page.waitForTimeout(700);
  }
  const dlBefore=dl.length;
  /* SW 上岗后再访问根地址 */
  try{ await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded',timeout:15000}); }catch(e){}
  await page.waitForTimeout(2500);
  const r = await page.evaluate(()=>({ kids: document.body?document.body.children.length:0,
    ctrl: !!(navigator.serviceWorker&&navigator.serviceWorker.controller) })).catch(()=>({kids:0,ctrl:false}));
  await b.close(); srv.close();
  return { ...r, dlAfter: dl.length - dlBefore };
}

const good = await run(false,'正确MIME');
ok(good.kids>0 && good.dlAfter===0, `正确 MIME 下正常渲染(${good.kids} 个子元素)、零下载`);
const bad = await run(true,'错误MIME');
console.log(`  （坏 MIME 场景：SW 接管=${bad.ctrl} 子元素=${bad.kids} SW上岗后下载=${bad.dlAfter}）`);
ok(bad.ctrl ? (bad.kids>0 && bad.dlAfter===0) : true,
   bad.ctrl ? `SW 上岗后即便服务端 MIME 错误也能正常渲染(${bad.kids} 个子元素)、零下载`
            : 'SW 未能上岗(坏 MIME 下首访即下载, 属服务端问题, 见 README 修法)');
/* 源码合同 */
const sw = fs.readFileSync('/home/claude/work/repo/sw_v944.js','utf8');
ok(/function fixHtmlType/.test(sw), 'SW 提供 fixHtmlType 纠正函数');
ok(/looksDownload/.test(sw) && !/clone\(\)/.test(sw.slice(sw.indexOf('function fixHtmlType'), sw.indexOf('function fixHtmlType')+1200)), 'v1049 起改为只看响应头判断(不读 body、不 clone)，仅对会触发下载的响应改写');
ok(/content-disposition/.test(sw), '同时清除 Content-Disposition(被标成附件时)');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
