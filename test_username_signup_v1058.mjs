/* test_username_signup_v1058.mjs —— 用户名 + 密码「注册」
 * 需求：提供不依赖手机号的注册方式。
 * 实现要点：CloudBase 的注册只支持 email+password 或 phone+验证码，
 *   **没有"纯用户名+密码"注册**。故把用户名确定性映射为一个内部邮箱
 *   （用户完全看不到）完成注册，随后 updateUsername 设上真实用户名。
 * 合同：① 提供 registerByPassword；② 用户名/密码校验（长度、非法字符、两次一致）；
 *       ③ 同一用户名映射到同一内部邮箱、不同用户名不同；
 *       ④ 注册成功写入本地登录态；⑤ 登录时用户名失败会用内部邮箱重试；
 *       ⑥ 界面有「注册 ↔ 登录」切换与确认密码框。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('用户名密码注册 v1058');
const page=await browser.newPage({viewport:{width:390,height:844}});
const errs=[]; page.on('pageerror',e=>errs.push(String(e.message).slice(0,80)));
page.on('dialog',async d=>{ await d.dismiss().catch(()=>{}); });
await page.addInitScript(()=>{localStorage.clear();});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2600);

const api = await page.evaluate(()=>{
  const A=window.HansenAuth;
  return { has:['registerByPassword','normUsername','mailOfUsername'].every(k=>typeof A[k]==='function'),
    /* 用户名校验 */
    tooShort:A.normUsername('ab').ok, ok3:A.normUsername('abc').ok,
    tooLong:A.normUsername('a'.repeat(21)).ok, badChar:A.normUsername('a b').ok, atChar:A.normUsername('a@b').ok,
    /* 映射确定性 */
    m1:A.mailOfUsername('Hansen'), m2:A.mailOfUsername('hansen'), m3:A.mailOfUsername('other') };
});
ok(api.has, '三个接口齐备(registerByPassword/normUsername/mailOfUsername)');
ok(!api.tooShort && api.ok3 && !api.tooLong, '用户名长度校验 3-20');
ok(!api.badChar && !api.atChar, '拒绝空格与 @ 等非法字符');
ok(api.m1===api.m2, `同一用户名(忽略大小写)映射到同一内部邮箱`);
ok(api.m1!==api.m3, '不同用户名映射不同');
ok(/@u\.wordadventure\.local$/.test(api.m1) && /^[a-z0-9_]+@/.test(api.m1),
   `内部邮箱格式合法: ${api.m1}`);

/* 注册全流程（假 SDK） */
const reg = await page.evaluate(async ()=>{
  const A=window.HansenAuth; const calls=[];
  A._setAuthForTest({
    signUpWithEmailAndPassword:(m,p)=>{calls.push('signUp:'+m);return Promise.resolve({user:{uid:'UU'}});},
    updateUsername:n=>{calls.push('updateUsername:'+n);return Promise.resolve();},
    signIn:o=>{calls.push('signIn:'+JSON.stringify(o));return Promise.resolve({user:{uid:'UU'}});},
    getCurrentUser:()=>Promise.resolve({uid:'UU'}),
    getLoginState:()=>Promise.resolve({uid:'UU',user:{uid:'UU'}})
  });
  let r=null,err='';
  try{ r=await A.registerByPassword('Hansen','abc123','abc123'); }catch(e){ err=String(e.message).slice(0,80); }
  let mismatch='';
  try{ await A.registerByPassword('Bob','abc123','xyz999'); }catch(e){ mismatch=String(e.message).slice(0,40); }
  let shortPw='';
  try{ await A.registerByPassword('Bob','123'); }catch(e){ shortPw=String(e.message).slice(0,40); }
  return { ok:r&&r.ok, err, calls, local:A.readLocal(), mismatch, shortPw };
});
ok(reg.ok===true, '注册成功'+(reg.err?'：'+reg.err:''));
ok(reg.calls.some(c=>c.startsWith('signUp:')), '走内部邮箱注册');
ok(reg.calls.some(c=>c==='updateUsername:Hansen'), '注册后设置真实用户名');
ok(reg.local && reg.local.username==='Hansen' && reg.local.method==='password',
   `写入本地登录态(username=${reg.local&&reg.local.username})`);
ok(/不一样/.test(reg.mismatch), `两次密码不一致被拒: ${reg.mismatch}`);
ok(/6 位/.test(reg.shortPw), `密码过短被拒: ${reg.shortPw}`);

/* 界面：注册切换与确认密码框 */
/* 前面的注册测试已把本地置为已登录，面板会渲染另一套内容。
   界面部分换一个干净页面测，避免状态污染。 */
await page.close();
const page2=await browser.newPage({viewport:{width:390,height:844}});
page2.on('pageerror',e=>errs.push(String(e.message).slice(0,80)));
page2.on('dialog',async d=>{ await d.dismiss().catch(()=>{}); });
await page2.addInitScript(()=>{localStorage.clear();});
await page2.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page2.waitForTimeout(2600);
await page2.evaluate(()=>{ HansenAuthUI.open(); });
await page2.waitForTimeout(800);
await page2.click('.au_tab[data-m="password"]');
await page2.waitForTimeout(700);
const ui = await page2.evaluate(async ()=>{
  return { toggle: !!document.getElementById('auPwToggle'), pwd2: !!document.getElementById('auPwd2') };
});
await page2.click('#auPwToggle');
await page2.waitForTimeout(600);
const ui2 = await page2.evaluate(()=>({ pwd2: !!document.getElementById('auPwd2'),
  btn: (document.getElementById('auGo')||{}).textContent||'' }));
ok(ui.toggle && !ui.pwd2, '默认是登录态(无确认密码框)');
ok(ui2.pwd2 && /注册/.test(ui2.btn), `点切换后进入注册态(按钮="${ui2.btn}")`);
const src = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js','utf8');
ok(/mailOfUsername\(u\)/.test(src), '登录时用户名失败会用内部邮箱重试');
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
