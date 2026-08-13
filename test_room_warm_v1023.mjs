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
  /* 🔴v1158：**固定等 2600ms 不够 —— 岛屿页有 89 个 script。**

     这个测试一直是红的（我这轮排查其他问题时才发现），
     报 `ReferenceError: HansenRoom is not defined`。
     实测那个页面 6 秒后模块是在的 —— 只是 2.6 秒时还没到。

     > 固定等待时间是在赌机器有多快。
     > 页面越大赌得越输，而页面只会越来越大。

     改成轮询等就绪：最多等 15 秒，到了就走，不浪费时间。 */
  for (let w = 0; w < 30; w++) {
    if (await page.evaluate(() => !!window.HansenRoom)) break;
    await page.waitForTimeout(500);
  }
ok(await page.evaluate(()=>!!window.HansenRoom), '预热模块已加载');
/* 等待空闲预热完成 */
let ready=false;
for(let i=0;i<20;i++){
    /* ⚠️ 岛屿页在启动阶段可能自己跳转（登录门、版本升级门等），
       正在飞的 evaluate 会被打断报 "Execution context was destroyed"。
       那不是产品问题 —— 等它跳完再问一次就行。 */
    try {
      ready = await page.evaluate(()=> window.HansenRoom? HansenRoom.isReady('land'):false);
    } catch (e) {
      await page.waitForTimeout(600);
      ready = false;
    }
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
/* 🔴v1024: 三个「带参数页」的资源预热(它们地址带 lv=/card=/boss=/island= 各不相同,
   无法预开固定房间, 改为把 HTML 与子资源灌进缓存, 之后带任何参数打开都命中缓存) */
let pf=[];
for(let i=0;i<25;i++){
  pf = await page.evaluate(()=> window.HansenRoom&&HansenRoom.prefetched? HansenRoom.prefetched():[]);
  if(pf.length>=3) break;
  await page.waitForTimeout(800);
}
ok(pf.length>=3, '三个带参数页的资源已预热进缓存: '+pf.join(', '));
/* 预热用的隐藏 iframe 加载完应自行移除, 不常驻占内存 */
/* 🔴v1154：**要等预热全部跑完再检查。**

   原来只等 1200ms，而预热本身就是"每 1200ms 起一个新的" ——
   检查那一刻**必然有一个正在预热中的 iframe**，于是永远红。

   这条测试守的是"预热完不留常驻 iframe"（内存），
   不是"任何时刻都不许有 iframe"（那样预热根本没法做）。
   等 6 秒：三个页面预热完 + 最后一个的 600ms 移除延迟，绰绰有余。

   （顺带：产品侧 v1154 也补了三条腿的清理 ——
     load 成功移除 / error 移除 / 8 秒硬超时兜底，
     原来只挂 load，加载失败或卡住时 iframe 会永久留在 DOM 里。） */
await page.waitForTimeout(6000);
const ghosts = await page.evaluate(()=>
  [...document.querySelectorAll('iframe')].filter(f=>/warm=1/.test(f.src||'')).length);
ok(ghosts===0, '预热用的隐藏 iframe 已自行清理(不占内存)');

ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
