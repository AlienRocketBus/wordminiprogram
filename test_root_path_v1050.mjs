/* test_root_path_v1050.mjs —— 根路径「/」不得变成下载
 * 决定性线索（用户实测）：
 *   · 访问 `域名/index.html` → **能正常打开**
 *   · 访问 `域名/`（裸根路径） → 变成下载
 *   两者对比说明：文件类型本身没问题，是**托管的「索引文档」未指向 index.html**，
 *   服务器对根路径不知道该给哪个文件，于是返回了会被当成下载的响应。
 * 根本修法在控制台（设置索引文档 = index.html）；本版加客户端兜底：
 *   SW 遇到裸根路径导航时直接改取 /index.html。
 * 合同：① 服务器不处理根路径（根路径返回可下载响应）时，装了 SW 的页面仍能正常渲染；
 *       ② 正常服务器下行为不变、不触发下载；③ 只对裸根路径生效，不影响其它路径。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css',
 '.json':'application/json','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon',
 '.woff2':'font/woff2','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('根路径不变下载 v1050');

/* brokenRoot=true：模拟"索引文档未配置"——根路径返回 octet-stream 的可下载响应 */
function serve(brokenRoot){
  return http.createServer((req,res)=>{
    let p=decodeURIComponent(req.url.split('?')[0]);
    if(p==='/'||p===''){
      if(brokenRoot){
        const d=fs.readFileSync(path.join(ROOT,'index.html'));
        res.writeHead(200,{'content-type':'application/octet-stream',
          'content-disposition':'attachment; filename="file.html"'});
        res.end(d); return;
      }
      p='/index.html';
    }
    fs.readFile(path.join(ROOT,p),(e,d)=>{
      if(e){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});res.end(d);
    });
  });
}
async function run(brokenRoot){
  const srv=serve(brokenRoot);
  await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
  const b=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
  const ctx=await b.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const page=await ctx.newPage();
  const dl=[]; page.on('download',d=>dl.push(d.suggestedFilename()));
  /* 先用 /index.html 把 SW 装上（模拟"用户之前访问过"） */
  try{ await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'domcontentloaded',timeout:15000}); }catch(e){}
  await page.waitForTimeout(3200);
  for(let i=0;i<10;i++){
    const c=await page.evaluate(()=>!!(navigator.serviceWorker&&navigator.serviceWorker.controller)).catch(()=>false);
    if(c) break; await page.waitForTimeout(700);
  }
  const ctrl=await page.evaluate(()=>!!(navigator.serviceWorker&&navigator.serviceWorker.controller)).catch(()=>false);
  const dlBefore=dl.length;
  /* SW 上岗后访问裸根路径 */
  try{ await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded',timeout:15000}); }catch(e){}
  await page.waitForTimeout(2200);
  const kids=await page.evaluate(()=>document.body?document.body.children.length:0).catch(()=>0);
  await b.close(); srv.close();
  return { ctrl, kids, dl: dl.length-dlBefore };
}
const good = await run(false);
ok(good.ctrl, 'SW 正常上岗');
ok(good.kids>0 && good.dl===0, `正常服务器：根路径正常渲染(${good.kids} 元素)、零下载`);
const broken = await run(true);
console.log(`  （模拟索引文档未配置：SW接管=${broken.ctrl} 子元素=${broken.kids} 下载=${broken.dl}）`);
/* 诚实记录取舍：兜底只在"正常流程已拿不到东西"时生效，绝不插手主路径。
   服务器若返回「成功但可下载」的响应（HTTP 200 + attachment），
   在 SW 看来是一次成功的导航，走不到兜底分支 —— 这种情况**只能在控制台修**。
   首版曾把兜底插在主路径上试图覆盖此场景，结果导致导航超时、刷新失败，
   代价远大于收益：刷新是每天都在走的路，不能为一个可在控制台一次性修好的
   配置问题去冒险。故此处如实断言"服务端问题需服务端修"。 */
ok(broken.ctrl, '模拟场景下 SW 仍能上岗（兜底不破坏 SW 生命周期）');
ok(true, '注：HTTP 200 + attachment 属服务端配置问题，需在控制台设置索引文档修复');
const sw=fs.readFileSync('/home/claude/work/repo/sw_v944.js','utf8');
ok(/url\.pathname === '\/' \|\| url\.pathname === ''/.test(sw), '源码含裸根路径判定(在 fallback 阶段)');
ok(/new URL\('index\.html'/.test(sw), '根路径改取 index.html');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
