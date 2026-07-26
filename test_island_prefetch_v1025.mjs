/* test_island_prefetch_v1025.mjs —— 主页 →岛屿页「触碰即预取」回归
 * 缺口：主页到 18 个岛屿页一直是整页跳转，每次完整加载 600KB；
 *       前几轮打通的都是「岛屿页 → 子页面」，从没碰过「主页 → 岛屿页」——
 *       而这是玩家每天走得最多的一条路。
 * 合同：① 模块加载且给所有岛屿卡片绑上预取；② 碰到卡片即发出预取；
 *       ③ 空闲时预取最近玩过的岛；④ 预取有上限，不会把 18 个岛全拉下来吃流量。 */
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
console.log('主页→岛屿 触碰即预取 v1025');
const page=await browser.newPage({viewport:{width:390,height:844}});
page.on('pageerror',e=>errs.push(String(e.message).slice(0,80)));
await page.addInitScript(()=>{ localStorage.clear();
  /* 造一个"最近玩过动物岛"的场景 */
  localStorage.setItem('lastIslandKey','animal');
  localStorage.setItem('wordIslandAnimal', JSON.stringify({learned:[1,2,3]}));
});
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(1200);
ok(await page.evaluate(()=>!!window.HansenIslandPrefetch), '预取模块已加载');
const nLinks = await page.evaluate(()=> document.querySelectorAll('a[href*="island_"]').length);
ok(nLinks>=10, `主页岛屿卡片数 ${nLinks}`);
/* ② 触碰即预取 */
const before = await page.evaluate(()=> HansenIslandPrefetch.prefetched().length);
await page.evaluate(()=>{
  const a=[...document.querySelectorAll('a[href*="island_"]')].find(x=>/island_food/.test(x.href));
  if(a) a.dispatchEvent(new PointerEvent('pointerenter',{bubbles:true}));
});
await page.waitForTimeout(200);
const touched = await page.evaluate(()=> HansenIslandPrefetch.prefetched().some(u=>/island_food/.test(u)));
ok(touched, '碰到卡片立即发出预取(抢在手指抬起之前)');
/* ③ 空闲预取最近玩过的岛 */
let recent=false;
for(let i=0;i<12;i++){
  recent = await page.evaluate(()=> HansenIslandPrefetch.prefetched().some(u=>/island_animal/.test(u)));
  if(recent) break; await page.waitForTimeout(700);
}
ok(recent, '空闲时已预取「最近玩过的岛」(命中率最高)');
/* 预取标签确实进了 DOM */
const links = await page.evaluate(()=> document.querySelectorAll('link[rel="prefetch"][href*="island_"]').length);
ok(links>0, `已生成 ${links} 个 prefetch 标签`);
/* ④ 上限保护 */
await page.waitForTimeout(3000);
const total = await page.evaluate(()=> HansenIslandPrefetch.prefetched().length);
ok(total<=8, `预取有上限, 未把 18 个岛全拉下来(实取 ${total} 个)`);
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
