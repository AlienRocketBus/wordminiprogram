/* test_no_sticky_hover_v1011.mjs —— 触屏「粘滞 hover」回归
 * 事故：手机上点过一次后 :hover 会粘住；重新出题时同一位置的选项顶着 hover 态，
 *       看起来"已经被选中了"（用户在打Boss 屏报此问题，且恰好落在正确答案上，
 *       一度疑似泄露答案）。完形填空/火眼金睛/探索/拼词同样中招。
 * 合同：在触屏设备（hasTouch + pointer:coarse）上，交互项的 :hover 规则一律不得生效。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
/* 模拟真实手机：有触摸、无精确指针 */
const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const page=await ctx.newPage();
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
await page.addInitScript(()=>{localStorage.clear();});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2500);
console.log('触屏粘滞 hover v1011');
const r = await page.evaluate(()=>{
  const out={ coarse: matchMedia('(pointer:coarse)').matches,
              hoverNone: matchMedia('(hover:none)').matches, leaks:[] };
  /* 逐个交互类：在触屏媒体条件下，其 :hover 规则不得命中 */
  const sels=['.boss-opt','.cloze-opt','.eagle-cell','.exp-card','.scramble-letter','.ach-bar'];
  for(const ss of document.styleSheets){
    let rules; try{ rules=ss.cssRules; }catch(e){ continue; }
    const scan=(list, guarded)=>{
      for(const r of list||[]){
        if(r.type===4){ /* CSSMediaRule */
          const g = guarded || /hover\s*:\s*hover|pointer\s*:\s*fine/.test(r.conditionText||'');
          scan(r.cssRules, g); continue;
        }
        if(!r.selectorText || !/:hover/.test(r.selectorText)) continue;
        if(guarded) continue;                    /* 已被 hover:hover 保护 → 合格 */
        if(sels.some(s=>r.selectorText.includes(s))) out.leaks.push(r.selectorText.slice(0,60));
      }
    };
    scan(rules, false);
  }
  return out;
});
ok(r.coarse===true, '测试上下文确为触屏(pointer:coarse)');
ok(r.leaks.length===0, '交互项无裸露 :hover 规则' + (r.leaks.length? '：'+r.leaks.join(' | ') : ''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
