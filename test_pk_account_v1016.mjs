/* test_pk_account_v1016.mjs —— 拼写大PK 账号管理三态回归
 * 缺口：此前只能点身份条才能登录(不可发现)，登录后也没有切换账号/退出登录的入口。
 * 合同：未登录 → 显式「注册/登录」按钮且不显示切换/退出；
 *       已登录 → 出现「切换账号」「退出登录」并显示当前账号，不再显示注册按钮；
 *       两种色调下按钮文字方向均正确。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
const lum=(c)=>{const m=(c||'').match(/(\d+),\s*(\d+),\s*(\d+)/); return m? (+m[1]*.299+ +m[2]*.587+ +m[3]*.114) : -1;};
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
const errs=[];
for(const [tag,pal] of [['亮','cloud'],['暗',null]]){
  const page=await browser.newPage({viewport:{width:390,height:900}});
  page.on('pageerror',e=>errs.push(tag+':'+String(e.message).slice(0,70)));
  await page.addInitScript(p=>{localStorage.clear(); if(p) localStorage.setItem('hansen_palette_global',p);}, pal);
  await page.goto(`http://127.0.0.1:${port}/spelling_pk.html`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1800);
  /* 未登录: 应有注册/登录按钮 */
  const out1 = await page.evaluate(()=>{
    const b=document.getElementById('pkReg');
    return { hasReg:!!b, txt:b?b.textContent.trim():'', 
      fg:b?getComputedStyle(b).color:null,
      bg:b?(getComputedStyle(b).backgroundImage!=='none'?getComputedStyle(b).backgroundImage:getComputedStyle(b).backgroundColor):null,
      hasSwitch:!!document.getElementById('pkSwitch'), hasOut:!!document.getElementById('pkOut') };
  });
  ok(out1.hasReg, `[${tag}] 未登录时有「注册/登录」按钮: ${out1.txt}`);
  ok(!out1.hasSwitch && !out1.hasOut, `[${tag}] 未登录时不显示切换/退出`);
  ok(lum(out1.fg)>200, `[${tag}] 注册按钮白字可读`);
  /* 点击应弹登录面板 */
  await page.evaluate(()=>{ document.getElementById('pkReg').click(); });
  await page.waitForTimeout(600);
  ok(await page.evaluate(()=>{const e=document.getElementById('hsn_auth_panel'); return !!(e&&e.classList.contains('on'));}),
     `[${tag}] 点注册按钮弹出登录面板`);
  await page.evaluate(()=>{ if(window.HansenAuthUI) HansenAuthUI.close(); });
  /* 模拟已登录 */
  await page.evaluate(()=>{ localStorage.setItem('hansen_auth_v1004', JSON.stringify({method:'phone',phone:'+86 15550836896',signedAt:Date.now(),uid:'u1'})); });
  await page.waitForTimeout(1800);
  const out2 = await page.evaluate(()=>{
    const s=document.getElementById('pkSwitch'), o=document.getElementById('pkOut');
    const tip=document.querySelector('.pk_acct_tip');
    return { hasSwitch:!!s, hasOut:!!o, hasReg:!!document.getElementById('pkReg'),
      tip:tip?tip.textContent.trim().slice(0,26):'', 
      sFg:s?getComputedStyle(s).color:null };
  });
  ok(out2.hasSwitch && out2.hasOut, `[${tag}] 已登录时出现「切换账号」「退出登录」`);
  ok(!out2.hasReg, `[${tag}] 已登录时不再显示注册按钮`);
  ok(/已登录/.test(out2.tip), `[${tag}] 显示当前账号: ${out2.tip}`);
  const contrast = tag==='亮'? lum(out2.sFg)<130 : lum(out2.sFg)>150;
  ok(contrast, `[${tag}] 切换按钮文字方向正确(亮度${lum(out2.sFg).toFixed(0)})`);
  await page.close();
}
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs.slice(0,2).join('|'):''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
