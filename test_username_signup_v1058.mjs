/* test_username_signup_v1058.mjs —— 用户名 + 密码「注册」
 * 需求：提供不依赖手机号的注册方式。
 * 实现要点：CloudBase 的注册只支持 email+password 或 phone+验证码，
 *   **没有"纯用户名+密码"注册**。故把用户名确定性映射为一个内部邮箱
 *   （用户完全看不到）完成注册，随后 updateUsername 设上真实用户名。
 * 合同：① 提供 registerByPassword；② 用户名校验（长度、非法字符）；
 *       ③ 同一用户名映射到同一内部邮箱、不同用户名不同；
 *       ④ （v1164 改）注册**如实拒绝**：不调 SDK、不写本地登录态，并指向手机号注册；
 *       ⑤ 登录时用户名失败会用内部邮箱重试；登录后没有云端凭证就不算登录；
 *       ⑥ （v1164 改）界面的用户名页只有登录，没有假的注册表单，有「去手机号注册」。
 *
 * 🔴v1164 为什么改这条测试：原来的假 SDK 让 signUpWithEmailAndPassword 返回 {user:{uid}}，
 *   好像真建了账号。真实 SDK 2.30.0 这个方法只往内部邮箱发一封验证码、从不建账号、不给凭证
 *   （读源码 + 模拟云端实测：1 次 /auth/v1/verification，0 次 /auth/v1/signup）。
 *   假替身比真东西能干，于是这条测试一直绿着，而真机上用户名注册的人永远连不上云端。
 *   现在替身按真 SDK 的行为来，测试的意图（用户名这条路要么真能用、要么说实话）不变。 */
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

/* 注册：如实拒绝（假 SDK 按真实 SDK 2.30.0 的行为：邮箱"注册"只发验证码、不给凭证） */
const reg = await page.evaluate(async ()=>{
  const A=window.HansenAuth; const calls=[];
  A._setAuthForTest({
    signUpWithEmailAndPassword:(m,p)=>{calls.push('signUpWithEmailAndPassword:'+m);
      return Promise.resolve({data:{verifyOtp:()=>Promise.resolve()},error:null});},
    signUp:o=>{calls.push('signUp:'+JSON.stringify(o));return Promise.resolve({data:{verifyOtp:()=>Promise.resolve()},error:null});},
    updateUsername:n=>{calls.push('updateUsername:'+n);return Promise.resolve();},
    getVerification:o=>{calls.push('getVerification:'+JSON.stringify(o));return Promise.resolve({verification_id:'V'});},
    getLoginState:()=>Promise.resolve(null)
  });
  let r=null,err='',friendly='',unsupported=false;
  try{ r=await A.registerByPassword('Hansen','abc123','abc123'); }
  catch(e){ err=String(e.message); friendly=A.friendly(e); unsupported=!!e.unsupported; }
  return { resolved:!!r, err, friendly, unsupported, calls, local:A.readLocal(), signed:A.isSignedIn(),
           credKeys:Object.keys(localStorage).filter(k=>/^credentials/.test(k)).length };
});
ok(reg.resolved===false && /手机号/.test(reg.err), `★ 用户名注册如实拒绝并指向手机号注册：${reg.err.slice(0,60)}`);
ok(/家长/.test(reg.err), '★ 告诉孩子没手机号可以用家长的');
ok(reg.unsupported===true, '★ 错误标明 unsupported（界面/上层可据此区分）');
ok(reg.friendly===reg.err, '★ friendly() 原样显示这句人话，不截断不改写');
ok(reg.calls.length===0, `★ 不去调 SDK 假装注册（调用 ${reg.calls.length} 次：${reg.calls.join(',')}）`);
ok(!reg.local.method && !reg.local.signedAt && reg.signed===false,
   `★ 不写本地"已登录"（method=${reg.local.method||'无'}）—— 以前写了，界面说登录了，云端永远没会话`);
ok(reg.credKeys===0, '没有凭证就是没有凭证');

/* 用户名登录：resolve 了但没下发凭证 → 不算登录；有凭证 → 正常登录 */
const pw = await page.evaluate(async ()=>{
  localStorage.clear();
  const A=window.HansenAuth;
  A._setAuthForTest({ signIn:()=>Promise.resolve({user:{uid:'U9'}}), getLoginState:()=>Promise.resolve(null) });
  let err1='';
  try{ await A.loginByPassword('Hansen','abc123'); }catch(e){ err1=String(e.message||e); }
  const after1={ method:A.readLocal().method||'', signed:A.isSignedIn() };
  A._setAuthForTest({
    signIn:o=>{ try{ localStorage.setItem('credentials_ambitious-test', JSON.stringify({
        access_token:'AT', refresh_token:'RT', expires_in:7200,
        expires_at:new Date(Date.now()+7200000).toISOString() })); }catch(e){}
      return Promise.resolve({access_token:'AT',expires_in:7200}); },
    getCurrentUser:()=>Promise.resolve({uid:'U8'}),
    getLoginState:()=>Promise.resolve({user:{uid:'U8'}})
  });
  let r2=null,err2='';
  try{ r2=await A.loginByPassword('Hansen','abc123'); }catch(e){ err2=String(e.message||e); }
  return { err1, after1, ok2:!!(r2&&r2.ok), err2, local2:A.readLocal() };
});
ok(/未真正完成|没有下发有效凭证/.test(pw.err1), `★ 用户名登录没拿到凭证 → 明确报错：${pw.err1.slice(0,40)}`);
ok(!pw.after1.method && pw.after1.signed===false, '★ 没凭证就不写"已登录"（和手机号登录同一判据）');
ok(pw.ok2 && pw.local2.method==='password' && pw.local2.username==='Hansen',
   `有凭证时用户名登录照常成功${pw.err2?'：'+pw.err2:''}`);
/* 原来测的是"注册时密码太短/两次不一致被拒"——注册没了，输入校验留在登录这一步继续守 */
const shortPw = await page.evaluate(async ()=>{
  try{ await window.HansenAuth.loginByPassword('Bob','123'); return ''; }catch(e){ return String(e.message).slice(0,40); }
});
ok(/6 位/.test(shortPw), `登录时密码过短被拒: ${shortPw}`);

/* 界面：用户名页只能登录，注册引去手机号 */
/* 前面的登录测试已把本地置为已登录，面板会渲染另一套内容。
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
const ui = await page2.evaluate(()=>{
  const card=document.querySelector('#hsn_auth_panel .au_card');
  return { toPhone: !!document.getElementById('auPwToPhone'), pwd2: !!document.getElementById('auPwd2'),
    oldToggle: !!document.getElementById('auPwToggle'),
    btn: (document.getElementById('auGo')||{}).textContent||'',
    text: card ? card.textContent.replace(/\s+/g,' ') : '' };
});
ok(!ui.pwd2 && !ui.oldToggle, '★ 用户名页没有"确认密码 / 切到注册"这种假注册表单');
ok(ui.btn==='登录', `用户名页的按钮只有「登录」（实为"${ui.btn}"）`);
ok(ui.toPhone && /手机号注册/.test(ui.text), '★ 有「还没有账号？用手机号注册」的入口');
ok(/不支持/.test(ui.text) && /家长/.test(ui.text), '★ 说清楚为什么（云端不支持用户名注册）和怎么办（家长手机号也行）');
await page2.click('#auPwToPhone');
await page2.waitForTimeout(600);
const ui2 = await page2.evaluate(()=>({ phone: !!document.getElementById('auPhone'),
  tabOn: (document.querySelector('.au_tab.on')||{}).getAttribute ? document.querySelector('.au_tab.on').getAttribute('data-m') : '' }));
ok(ui2.phone && ui2.tabOn==='phone', '★ 点了就切到手机号页，能直接填手机号注册');
const src = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js','utf8');
ok(/mailOfUsername\(u\)/.test(src), '登录时用户名失败会用内部邮箱重试');
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
