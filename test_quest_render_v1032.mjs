/* test_quest_render_v1032.mjs —— 每日任务「面板真的渲染出来」回归
 * 事故：数据层 rollDailyQuests() 明明返回 12 条，面板却显示「暂无任务，稍后再来！」。
 *   根因：template 里的 __hsnNormalizeQuests 在渲染前规整数据，
 *   遇到**它不认识的任务 id 就把整份清空**(valid=false → out.list=[])；
 *   而 v1000/v1001 新增的 review3/reviewClear/sbWin1 等定义在 hansen_quest_global.js，
 *   template 自带的查表函数不认识 → 全清 → 面板空白。
 *   （v1018 修的是 hansen_quest_global.js 里的同型校验，没料到 template 还有第二道。）
 * 合同：① rollDailyQuests 返回 12 条；② 面板必须真的渲染出 12 条；③ 不得出现「暂无任务」。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errs=[]; page.on('pageerror',e=>errs.push(String(e.message).slice(0,110)));
page.on('console',m=>{if(m.type()==='error'){const t=m.text(); if(!/tcb-api|net::ERR_|Failed to fetch|Access to fetch/i.test(t)) errs.push('C:'+t.slice(0,110));}});
await page.addInitScript(()=>{localStorage.clear();});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(3000);
/* 找每日任务入口并点开 */
const r = await page.evaluate(()=>{
  const out={};
  out.rollFn = typeof rollDailyQuests;
  try { const st=rollDailyQuests(); out.n = (st&&st.list||[]).length; } catch(e){ out.rollErr=String(e.message).slice(0,90); }
  /* 尝试打开每日任务屏 */
  try { if(typeof showScreen==='function') showScreen('quests'); } catch(e){ out.showErr=String(e.message).slice(0,90); }
  return out;
});
await page.waitForTimeout(1200);
const s = await page.evaluate(()=>{
  const ids=['questsScreen'];
  const found={};
  ids.forEach(i=>{ const e=document.getElementById(i); if(e) found[i]={ active:e.classList.contains('active'), items:e.querySelectorAll('#questList > *').length, txt:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,60) }; });
  /* 也扫一下屏幕上有没有"暂无任务" */
  const body=(document.body.innerText||'');
  return { found, noneMsg: /暂无任务/.test(body),
    visibleScreens:[...document.querySelectorAll('.screen.active')].map(x=>x.id).slice(0,3) };
});
console.log('rollDailyQuests:', r.rollFn, '| 返回条数:', r.n, r.rollErr? ('| 报错:'+r.rollErr):'');
console.log('屏幕状态:', JSON.stringify(s.found));
console.log('当前激活屏:', s.visibleScreens.join(','), '| 出现"暂无任务":', s.noneMsg);
console.log('ERRORS:', errs.length, errs.slice(0,3).join(' || '));
await browser.close(); srv.close();
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
const qs = s.found.questsScreen || {};
ok(r.n===12, `数据层返回 12 条(实得 ${r.n})`);
ok(qs.active===true, '每日任务屏已激活');
ok(qs.items===12, `**面板真的渲染出 12 条**(实得 ${qs.items})`);
ok(s.noneMsg===false, '不再出现「暂无任务」');
ok(errs.length===0, '零脚本错误');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
