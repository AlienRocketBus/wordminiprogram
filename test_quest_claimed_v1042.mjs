/* test_quest_claimed_v1042.mjs —— 每日任务「已完成/已领取」态可读性回归
 * 事故：亮色调下点完领取，任务卡变成深墨绿底(#052e16→#14532d)，
 *   而文字已被亮色板转成深色 → **深底深字，完全看不清**。
 * 合同：亮板任务卡为浅底、标题与进度文字为深字，两者对比度足够；
 *   已完成卡同样是浅绿底深字（不得再是深绿底）；暗板保持原设计。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
const lum=(c)=>{const m=(c||'').match(/(\d+),\s*(\d+),\s*(\d+)/); return m? (+m[1]*.299+ +m[2]*.587+ +m[3]*.114) : -1;};
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
const errs=[]; const R={};
console.log('每日任务已完成态可读性 v1042');
for(const [tag,pal] of [['亮','cloud'],['暗',null]]){
  const page=await browser.newPage({viewport:{width:390,height:900}});
  page.on('pageerror',e=>errs.push(tag+':'+String(e.message).slice(0,70)));
  await page.addInitScript(p=>{localStorage.clear(); if(p) localStorage.setItem('hansen_palette_global',p);}, pal);
  await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2600);
  R[tag]=await page.evaluate(()=>{
    /* 造一张"已完成"的任务卡, 直接量它的真实渲染色 */
    var host=document.createElement('div');
    host.innerHTML='<div class="quest-card done"><div class="quest-body">'
      +'<div class="quest-title">测试任务</div>'
      +'<div class="quest-progress-bar"><div class="quest-progress-fill"></div></div>'
      +'<div class="quest-progress-text">3 / 3</div></div>'
      +'<div class="quest-reward claimed">+20</div></div>';
    document.body.appendChild(host);
    const card=host.querySelector('.quest-card.done');
    const ttl=host.querySelector('.quest-title');
    const prg=host.querySelector('.quest-progress-text');
    const bg=(e)=>{const c=getComputedStyle(e);
      return (c.backgroundImage!=='none'?c.backgroundImage:c.backgroundColor);};
    const r={ cardBg:bg(card), titleFg:getComputedStyle(ttl).color,
      progFg:getComputedStyle(prg).color };
    host.remove();
    return r;
  });
  await page.close();
}
for(const k of ['亮','暗']){
  const r=R[k]; const cb=lum((r.cardBg.match(/rgba?\([^)]+\)/)||[])[0]);
  console.log(`  [${k}] 已完成卡底${cb.toFixed(0)} 标题字${lum(r.titleFg).toFixed(0)} 进度字${lum(r.progFg).toFixed(0)}`);
}
const L=R['亮'], D=R['暗'];
const lb=lum((L.cardBg.match(/rgba?\([^)]+\)/)||[])[0]), db=lum((D.cardBg.match(/rgba?\([^)]+\)/)||[])[0]);
ok(lb>200, `亮板已完成卡是浅底(${lb.toFixed(0)})，不再是深墨绿`);
ok(lum(L.titleFg)<100, `亮板标题为深字(${lum(L.titleFg).toFixed(0)})`);
ok(Math.abs(lb-lum(L.titleFg))>120, `亮板底与标题对比充足(差${Math.abs(lb-lum(L.titleFg)).toFixed(0)})`);
ok(Math.abs(lb-lum(L.progFg))>100, `亮板进度文字同样清晰(差${Math.abs(lb-lum(L.progFg)).toFixed(0)})`);
ok(db<100 && lum(D.titleFg)>150, `暗板保持原设计(底${db.toFixed(0)}/字${lum(D.titleFg).toFixed(0)})`);
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
