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
              hoverNone: matchMedia('(hover:none)').matches, leaks:[], abuse:[] };
  /* 🔴v1063 修正误报 + 加严：
     原判据把「不在 @media(hover:hover) 里的 :hover 规则」一律算泄漏，
     于是把**防线本身**当成了漏洞——
     `@media(hover:none){ .exp-card:hover{transform:none} }` 这类规则
     正是用来在触屏上把 hover 效果抹平的，却被判为"裸露"，测试长期红着。

     现在分两层：
       ① 静态：@media(hover:none) 内的 :hover 规则是允许的，**但只准写中和值**
          （none/0/transparent/initial…）。有人往里塞 background:red 依然会被抓。
          任何 @media 之外的裸露 :hover 规则一律算泄漏。
       ② 行为：真实 tap 之后计算样式必须回到基线——这才是用户实际症状
          （"点过一次后 hover 粘住，看起来像已选中，还疑似泄露答案"）。
     教训沿用 v1054：属性对 ≠ 用户点得到，只有真实交互能验到。 */
  const sels=['.boss-opt','.cloze-opt','.eagle-cell','.exp-card','.scramble-letter','.ach-bar'];
  const NEUTRAL=/^(none|0|0px|0%|transparent|initial|unset|revert|normal|auto|rgba\(0, 0, 0, 0\))$/i;
  for(const ss of document.styleSheets){
    let rules; try{ rules=ss.cssRules; }catch(e){ continue; }
    const scan=(list, guarded, inHoverNone)=>{
      for(const r of list||[]){
        if(r.type===4){
          const c=r.conditionText||'';
          scan(r.cssRules,
               guarded || /hover\s*:\s*hover|pointer\s*:\s*fine/.test(c),
               inHoverNone || /hover\s*:\s*none|pointer\s*:\s*coarse/.test(c));
          continue;
        }
        if(!r.selectorText || !/:hover/.test(r.selectorText)) continue;
        if(!sels.some(s=>r.selectorText.includes(s))) continue;
        if(guarded) continue;                       /* 只在有悬停设备生效 → 合格 */
        if(inHoverNone){
          /* 触屏专用块：只准中和，不准制造视觉变化 */
          const st=r.style||{};
          for(let i=0;i<st.length;i++){
            const prop=st[i], val=String(st.getPropertyValue(prop)||'').trim();
            if(!NEUTRAL.test(val)) out.abuse.push(r.selectorText.slice(0,40)+' {'+prop+':'+val+'}');
          }
          continue;
        }
        out.leaks.push(r.selectorText.slice(0,60));
      }
    };
    scan(rules, false, false);
  }
  return out;
});
ok(r.coarse===true, '测试上下文确为触屏(pointer:coarse)');
ok(r.hoverNone===true, '测试上下文确为无悬停设备(hover:none)');
ok(r.leaks.length===0, '交互项无裸露 :hover 规则' + (r.leaks.length? '：'+r.leaks.join(' | ') : ''));
ok(r.abuse.length===0, '★ @media(hover:none) 内只写中和值，不得制造视觉变化' + (r.abuse.length? '：'+r.abuse.join(' | ') : ''));

/* ═══ 行为层：真实 tap 后不得留下 hover 残留 ═══
   这是用户真正看到的症状；静态扫描无论多严都替代不了这一步。 */
const PROPS=['transform','opacity','borderColor','backgroundColor','boxShadow','filter'];
for(const cls of ['exp-card','boss-opt','cloze-opt','eagle-cell','scramble-letter']){
  await page.evaluate(({cls})=>{
    const old=document.getElementById('__hoverprobe'); if(old) old.remove();
    const d=document.createElement('div'); d.id='__hoverprobe'; d.className=cls; d.textContent='x';
    d.style.cssText='position:fixed;left:20px;top:400px;width:90px;height:60px;z-index:2147483000';
    document.body.appendChild(d);
  },{cls});
  await page.waitForTimeout(120);
  /* v1063: 计算样式里 transform 的 'none' 与单位矩阵 matrix(1,0,0,1,0,0) 视觉等价
     （translateZ(0) 之类的 GPU 提示会让它显示成矩阵形式），
     直接字符串比较会把"没有任何变化"误判成变化。这里先归一再比。 */
  const grab=()=>page.evaluate((p)=>{const e=document.getElementById('__hoverprobe');if(!e)return null;
    const s=getComputedStyle(e); const o={};
    p.forEach(k=>{ let v=s[k];
      if(k==='transform' && /^(none|matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)|matrix3d\(1(,\s*0){3},\s*1(,\s*0){3},\s*1(,\s*0){3},\s*1\))$/.test(String(v).trim())) v='<identity>';
      o[k]=v; });
    return o;}, PROPS);
  const before=await grab();
  await page.tap('#__hoverprobe').catch(()=>{});
  await page.waitForTimeout(600);   /* 等过渡动画彻底落定，避免抓到中间帧 */
  const after=await grab();
  const diff=(before&&after)? PROPS.filter(k=>before[k]!==after[k]) : ['(探针缺失)'];
  ok(diff.length===0, `★ .${cls} 真实点击后无 hover 残留` + (diff.length? '：'+diff.map(k=>`${k} ${before[k]}→${after[k]}`).join(' ; ').slice(0,90) : ''));
}
await page.evaluate(()=>{const e=document.getElementById('__hoverprobe'); if(e) e.remove();});

await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
