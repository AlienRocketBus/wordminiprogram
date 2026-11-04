const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_quest_migration_v1018.mjs —— 每日任务「版本迁移」回归
 * 事故：v1001 调整了任务目标(如「完成1轮」→「配对成功8组」, goal 1→8)。
 *       老存档里**已领取**的任务随即变成 claimed=true 而 progress(1) !== goal(8)，
 *       而校验只要有一条对不上就丢弃**整天**的任务 → 用户点开每日任务看到「暂无任务」。
 * 合同：定义变化时逐条宽容处理，绝不因个别任务对不上而清空整天。 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=__HSN_ROOT.replace(/\/$/, '');
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
const errs=[];
const page=await browser.newPage({viewport:{width:390,height:900}});
page.on('pageerror',e=>errs.push(String(e.message).slice(0,80)));
/* 造一份"旧版存档": 已领取的任务带着旧目标(progress=1) */
await page.addInitScript(()=>{
  if (window.top === window) localStorage.clear();
  const d=new Date(); const day=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
  localStorage.setItem('hansen_quest_global_v941', JSON.stringify({
    version:941, day:day, allDay:'',
    list:[ {id:'match1', progress:1, claimed:true},     /* 旧 goal=1, 新 goal=8 */
           {id:'moles1', progress:1, claimed:true},     /* 旧 goal=1, 新 goal=30 */
           {id:'learn3', progress:0, claimed:false},
           {id:'boss1',  progress:0, claimed:false} ]
  }));
});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2600);
console.log('每日任务版本迁移 v1018');
const r = await page.evaluate(()=>{
  const st = (typeof rollDailyQuests==='function') ? rollDailyQuests() : null;
  const list = (st&&st.list) || ((typeof S!=='undefined'&&S.quests&&S.quests.list)||[]);
  return { n:list.length, claimed:list.filter(q=>q.claimed).length,
    overflow:list.filter(q=>q.progress>q.goal).length,
    types:list.map(q=>q.type) };
});
ok(r.n>0, '旧存档不会导致「暂无任务」(实得 '+r.n+' 条)');
ok(r.overflow===0, '没有进度超过目标的脏数据');
ok(!errs.length, '零脚本错误'+(errs.length?': '+errs[0]:''));
/* 全新用户仍应拿到 12 条 */
const fresh = await page.evaluate(()=>{
  localStorage.removeItem('hansen_quest_global_v941');
  if(typeof S!=='undefined') S.quests={day:'',list:[],allDay:''};
  const st=rollDailyQuests();
  const list=(st&&st.list)||S.quests.list||[];
  const ty=list.map(q=>q.type);
  return { n:list.length, learn:ty.includes('learn'),
    review:ty.includes('review')||ty.includes('reviewClear'),
    boss:ty.includes('boss'), sbwin:ty.includes('sbwin') };
});
ok(fresh.n===12, '新用户仍是 12 条任务(实得 '+fresh.n+')');
ok(fresh.learn&&fresh.review&&fresh.boss&&fresh.sbwin, '四基石(学新词/复习/Boss/拼写蜂)齐全');
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
