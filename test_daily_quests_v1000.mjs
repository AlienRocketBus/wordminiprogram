/* v1000 每日任务系统专项回归: 12任务 / 3基石(学新词+复习+Boss) / 上报可推进 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else {fail++;console.log('  ✗',m);} };
const errs=[];
const page=await browser.newPage({viewport:{width:390,height:844}});
page.on('pageerror',e=>errs.push('P:'+String(e.message).slice(0,80)));
page.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text().slice(0,80));});
await page.addInitScript(()=>{localStorage.clear(); localStorage.setItem('hansen_palette_global','cloud');});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2500);

console.log('每日任务系统 v1000');
// 5次生成检验基石稳定性
const runs = await page.evaluate(()=>{
  const out=[];
  for(let i=0;i<5;i++){
    if(typeof S!=='undefined') S.quests={day:'',list:[],allDay:''};
    rollDailyQuests();
    const list=(S.quests&&S.quests.list)||[];
    const ty=list.map(q=>q.type);
    out.push({n:list.length, learn:ty.includes('learn'), review:ty.includes('review')||ty.includes('reviewClear'), boss:ty.includes('boss')});
  }
  return out;
});
ok(runs.every(r=>r.n===12), '每天恰好12个任务(5次)');
ok(runs.every(r=>r.learn), '基石·学新词每次必现');
ok(runs.every(r=>r.review), '基石·复习单词每次必现');
ok(runs.every(r=>r.boss), '基石·打Boss每次必现');

// 玩法正式名
const names = await page.evaluate(()=>{
  S.quests={day:'',list:[],allDay:''}; rollDailyQuests();
  return (S.quests.list||[]).map(q=>q.title).join('|');
});
ok(/完形填空|听音辨义|记忆翻牌|打字大师|字母拼拼乐|火眼金睛|泡泡大作战|极速60秒/.test(names), '标题使用玩法正式名');

// 上报可推进
const prog = await page.evaluate(()=>{
  S.quests={day:'',list:[],allDay:''}; rollDailyQuests();
  const b=S.quests.list.map(q=>q.progress);
  ['learn','review','boss','cloze','speed'].forEach(t=>{ progressQuest(t,1); setQuest(t,1); });
  const a=S.quests.list.map(q=>q.progress);
  return a.some((v,i)=>v>b[i]);
});
ok(prog, '各类任务进度可上报推进');

// 面板渲染
const rendered = await page.evaluate(()=>{
  rollDailyQuests(); if(typeof renderQuests==='function')renderQuests();
  return document.querySelectorAll('.quest-item,.quest-card,[class*="quest-item" i]').length;
});
ok(rendered===12, '面板渲染12个任务(实测'+rendered+')');

ok(errs.length===0, '零运行时错误');
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
