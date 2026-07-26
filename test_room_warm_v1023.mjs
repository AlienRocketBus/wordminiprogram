/* test_room_warm_v1023.mjs —— 「房间预热常驻」回归：子页面切换零延迟
 * 背景：星海觉醒(land_map)/赛季岛(island_season) 原为整页跳转，每次点开完整加载 → 明显等待。
 *       直接合并 600+KB 代码会撞变量/样式并拖慢首屏，故改为**后台预热 + 常驻不销毁**。
 * 合同：① 岛屿页空闲后自动预热两个房间；② 预热完成后打开耗时极短；
 *       ③ 关闭只隐藏不销毁，二次打开同样瞬开；④ 不发生整页跳转(仍留在岛屿页)。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
const errs=[];
console.log('房间预热常驻 v1023');
const page=await browser.newPage({viewport:{width:390,height:844}});
page.on('pageerror',e=>errs.push(String(e.message).slice(0,80)));
await page.addInitScript(()=>{localStorage.clear();});
const startUrl = `http://127.0.0.1:${port}/island_animal.html`;
await page.goto(startUrl,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2600);
ok(await page.evaluate(()=>!!window.HansenRoom), '预热模块已加载');
/* 等待空闲预热完成 */
let ready=false;
for(let i=0;i<20;i++){
  ready = await page.evaluate(()=> window.HansenRoom? HansenRoom.isReady('land'):false);
  if(ready) break;
  await page.waitForTimeout(700);
}
ok(ready, '星海觉醒已在后台预热完成(无需用户等待)');
/* 打开耗时 */
const t0=Date.now();
await page.evaluate(()=>{ HansenRoom.open('land'); });
const opened = await page.evaluate(()=> HansenRoom.isOpen('land'));
const dt=Date.now()-t0;
ok(opened, '星海觉醒已打开');
ok(dt<250, `打开耗时 ${dt}ms(<250ms)`);
ok(page.url()===startUrl, '未发生整页跳转, 仍在岛屿页');
/* 关闭后二次打开 */
await page.evaluate(()=>{ HansenRoom.close('land'); });
const stillThere = await page.evaluate(()=>{
  const w=document.getElementById('hsn_room_land');
  return !!(w && w.querySelector('iframe'));
});
ok(stillThere, '关闭后房间常驻(未销毁)');
const t1=Date.now();
await page.evaluate(()=>{ HansenRoom.open('land'); });
const dt2=Date.now()-t1;
ok(dt2<120, `二次打开耗时 ${dt2}ms(<120ms)`);
/* 赛季岛同样预热 */
let s=false;
for(let i=0;i<12;i++){ s = await page.evaluate(()=>HansenRoom.isReady('season')); if(s) break; await page.waitForTimeout(700); }
ok(s, '赛季岛同样已后台预热');
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
