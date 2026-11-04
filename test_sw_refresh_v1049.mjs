const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_sw_refresh_v1049.mjs —— 「刷新就变下载」回归
 * 事故：用户反馈刷新单词大冒险就被要求下载 HTML 文件，且明确"以前没这情况"。
 * 根因（我在 v1044 引入）：为给"服务端 MIME 配错"兜底，
 *   `fixHtmlType` 对**每个导航请求**都 `clone()` 并 `await clone.text()`
 *   读完整个页面（index.html 150KB）来判断是不是 HTML，再重建 Response。
 *   ① 每次刷新都多一次全量读取与重建；
 *   ② clone/text 在流式响应上可能失败或耗尽流，抛错后返回损坏响应
 *      → 浏览器拿到说不清类型的东西 → 直接当文件下载。
 *   本是兜底，反而把正常页面弄坏了。
 * 合同：① 正常 MIME 下连续刷新多次都不得触发下载、页面必须正常渲染；
 *       ② 改写只在"明显会触发下载"的响应上发生（octet-stream/缺失/attachment）；
 *       ③ 判断只看响应头，绝不读取 body（不得再出现 clone().text()）。 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=__HSN_ROOT.replace(/\/$/, '');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css',
 '.json':'application/json','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon',
 '.woff2':'font/woff2','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('刷新不变下载 v1049');

/* 源码合同：不得再读 body */
const sw = fs.readFileSync((__HSN_ROOT + 'sw_v944.js'),'utf8');
const fx = sw.slice(sw.indexOf('function fixHtmlType'), sw.indexOf('function fixHtmlType')+1200);
ok(!/clone\(\)/.test(fx), 'fixHtmlType 不再 clone 响应');
ok(!/await .*\.text\(\)/.test(fx), 'fixHtmlType 不再读取 body 全文');
ok(/looksDownload/.test(fx), '只在"明显会触发下载"的响应上才改写');
ok(/response\.body/.test(fx), '改写时直接复用原 body 流(零拷贝)');

const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const page=await ctx.newPage();
const dl=[]; page.on('download',d=>dl.push(d.suggestedFilename()));
const errs=[]; page.on('pageerror',e=>errs.push(String(e.message).slice(0,70)));
/* 首访装 SW */
await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(3500);
for(let i=0;i<10;i++){
  const c=await page.evaluate(()=>!!(navigator.serviceWorker&&navigator.serviceWorker.controller)).catch(()=>false);
  if(c) break; await page.waitForTimeout(700);
}
const ctrl = await page.evaluate(()=>!!(navigator.serviceWorker&&navigator.serviceWorker.controller));
ok(ctrl, 'Service Worker 已接管');
/* 连续刷新 5 次 —— 用户的实际操作 */
const kids=[];
for(let i=0;i<5;i++){
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  kids.push(await page.evaluate(()=>document.body?document.body.children.length:0).catch(()=>0));
}
ok(dl.length===0, `连续刷新 5 次, 零下载(实际 ${dl.length} 次)`);
ok(kids.every(n=>n>0), `每次刷新都正常渲染(子元素 ${kids.join('/')})`);
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
