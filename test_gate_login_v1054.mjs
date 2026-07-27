/* test_gate_login_v1054.mjs —— Lv.3 门槛点注册必须能真正登录
 * 事故：升到 3 级后弹出注册门槛，点「注册/登录」**没有任何反应**，用户彻底卡死。
 * 真因：登录面板 z-index 为 2147483500，而门槛是 2147483640 ——
 *   面板确实打开了，却被门槛整个盖住；而门槛刻意不可关闭，于是无路可走。
 *   更隐蔽的一层：门槛每 1.5s 巡检一次，即便隐藏也会被立刻弹回来。
 * 合同：点注册后必须能**真实点击输入框并打字**，且数秒后门槛不得回来遮挡。
 * 本测试模拟真实交互(click + type)，而非只检查 DOM 属性——
 *   前者才能发现"元素在但点不到"这类遮挡问题。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const b=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
const page=await b.newPage({viewport:{width:390,height:844}});
page.on('dialog',async d=>{ await d.dismiss().catch(()=>{}); });
await page.addInitScript(()=>{ localStorage.clear();
  localStorage.setItem('hansen_wallet_charxp','400');
  localStorage.setItem('wordIslandAnimal', JSON.stringify({learned:[1,2,3,4,5]}));
});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(3200);
await page.evaluate(()=>{ document.getElementById('gGo').click(); });
await page.waitForTimeout(1200);
/* 关键：模拟真实用户点击输入框并打字 */
let typed='';
try{ await page.click('#auPhone',{timeout:4000}); await page.type('#auPhone','15550836896',{delay:20});
     typed = await page.inputValue('#auPhone'); }catch(e){ typed='ERR:'+e.message.slice(0,40); }
/* 等巡检跑几轮, 确认门槛不会弹回来盖住 */
await page.waitForTimeout(4000);
const r = await page.evaluate(()=>{
  const g=document.getElementById('hsn_gate'), p=document.getElementById('hsn_auth_panel');
  const el=document.elementFromPoint(195, 420);
  return { gateOn:!!(g&&g.classList.contains('on')), panelOn:!!(p&&p.classList.contains('on')),
    topEl: el? (el.id||el.className||el.tagName).toString().slice(0,30) : null,
    phoneVal: (document.getElementById('auPhone')||{}).value || '' };
});
console.log('输入手机号:', typed);
console.log('4秒后 → 门槛:', r.gateOn, '面板:', r.panelOn, '| 屏幕中心元素:', r.topEl);
console.log('输入框内容仍在:', r.phoneVal);
await b.close(); srv.close();
const ok = typed==='15550836896' && !r.gateOn && r.panelOn && r.phoneVal==='15550836896';
console.log(ok?'\n✅ 可正常输入手机号, 门槛未再遮挡':'\n❌ 仍被阻挡');
process.exit(ok?0:1);
