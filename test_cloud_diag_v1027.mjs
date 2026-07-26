/* test_cloud_diag_v1027.mjs —— 云同步自检面板回归
 * 背景：开发环境连不上腾讯云，跨设备存档已连修多版仍未解决。
 *       与其继续盲改，不如把整条链路每一步的**真实结果**呈现在用户设备上，
 *       一张截图即可定位断点。
 * 合同：面板能打开、逐环项齐全(模块/envId/登录态/uid/密钥/本机进度/备份打包/上次上传/自动开关)、
 *       含「立刻上传」「从云端拉取」两个实测按钮、零脚本错误。 */
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
const page=await browser.newPage({viewport:{width:390,height:900}});
page.on('pageerror',e=>errs.push(String(e.message).slice(0,80)));
await page.addInitScript(()=>{ localStorage.clear();
  localStorage.setItem('wordIslandAnimal', JSON.stringify({learned:[1,2,3,4,5],stats:{daysPlayed:9}}));
  localStorage.setItem('hansen_auth_v1004', JSON.stringify({method:'phone',phone:'+8613800138000',signedAt:Date.now(),uid:'UID-DIAG'}));
});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2600);
console.log('云同步自检面板 v1027');
ok(await page.evaluate(()=>!!window.HansenCloudDiag), '诊断模块已加载');
await page.evaluate(()=>{ HansenCloudDiag.open(); });
await page.waitForTimeout(600);
const r = await page.evaluate(()=>{
  const el=document.getElementById('hsn_diag');
  const rows=[...el.querySelectorAll('.d_row')].map(x=>({
    k:(x.querySelector('.d_k')||{}).textContent||'',
    v:(x.querySelector('.d_v')||{}).textContent||'',
    cls:(x.querySelector('.d_v')||{}).className||'' }));
  return { on: el.classList.contains('on'), n: rows.length, rows,
    hasTest: !!document.getElementById('dTest'), hasPull: !!document.getElementById('dPull') };
});
ok(r.on, '面板已打开');
ok(r.n>=9, `逐环自检项 ${r.n} 条`);
ok(r.hasTest && r.hasPull, '含「立刻上传」「从云端拉取」实测按钮');
console.log('\n  ── 模拟设备上的自检输出 ──');
r.rows.slice(0,9).forEach(x=>console.log('   ', x.k, '→', x.v.slice(0,52), x.cls.includes('bad')?'❌':(x.cls.includes('warn')?'⚠️':'✅')));
ok(r.rows.some(x=>/uid/i.test(x.k) && /UID-DIAG/.test(x.v)), '能读出真实账号 uid');
ok(r.rows.some(x=>/备份打包/.test(x.k) && /成功/.test(x.v)), '备份打包状态可见');
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
