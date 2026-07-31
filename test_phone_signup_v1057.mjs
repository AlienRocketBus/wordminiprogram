/* test_phone_signup_v1057.mjs —— 手机号注册登录完整链路
 * 事故：用户反复反馈手机注册不行。真机复现后抓到根因——
 *   `hansen_auth_v1004.js` 里 import 了一个**根本不存在的文件**
 *   `vendor_cloudbase_esm_v1004.js`（仓库中只有 v965 那一个）。
 *   原代码指望 404 时靠 `.catch` 退回 v965，但**动态 import 的 404
 *   在部分浏览器（含微信内置浏览器）不会走 catch**，
 *   于是整个云端 SDK 加载失败 → 点「获取验证码」只显示"连不上服务器"。
 *   **手机注册从 v1004 起就一直是坏的，而这只是一个写错的文件名。**
 * 为什么一直没被发现：这条链路此前**无法在没有真实云端时验证**。
 *   本版为此给模块加了 `_setAuthForTest` 注入口，用假 SDK 即可跑完整条链。
 * 合同：① 不得再引用不存在的 SDK 文件；② 发码写入 verificationId；
 *       ③ 新用户走 signUp、老用户走 signIn；④ 登录后写入本地登录态。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('手机号注册登录链路 v1057');

/* ① 源码合同：不得引用不存在的 SDK 文件 */
const src = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js','utf8');
const refs = [...src.matchAll(/import\('\.\/(vendor_cloudbase_esm_v\d+\.js)/g)].map(m=>m[1]);
const missing = refs.filter(f=>!fs.existsSync('/home/claude/work/repo/'+f));
ok(missing.length===0, `引用的 SDK 文件都存在（引用 ${refs.join(',')}）`+(missing.length?' 缺失:'+missing:''));
ok(/_setAuthForTest/.test(src), '提供测试注入口（此前无法脱离云端验证，正是漏检主因）');

const page=await browser.newPage({viewport:{width:390,height:844}});
const errs=[]; page.on('pageerror',e=>errs.push(String(e.message).slice(0,80)));
page.on('dialog',async d=>{ await d.dismiss().catch(()=>{}); });
await page.addInitScript(()=>{localStorage.clear();});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2600);

/* ② 新用户：发码 → 注册 */
const newUser = await page.evaluate(async ()=>{
  const A=window.HansenAuth; const calls=[];
  A._setAuthForTest({
    getVerification:o=>{calls.push('getVerification');return Promise.resolve({verification_id:'VID',is_user:false});},
    verify:o=>{calls.push('verify');return Promise.resolve({verification_token:'TK'});},
    signUp:o=>{calls.push('signUp:'+JSON.stringify(o));
      /* 模拟真实 SDK：成功响应含 expires_in，并据此写下凭证键 */
      try{ localStorage.setItem('credentials_ambitious-test', JSON.stringify({
        access_token:'AT', refresh_token:'RT', expires_in:7200,
        expires_at:new Date(Date.now()+7200000).toISOString() })); }catch(e){}
      return Promise.resolve({user:{uid:'U1'},access_token:'AT',expires_in:7200});},
    signIn:o=>{calls.push('signIn');return Promise.resolve({user:{uid:'U1'}});},
    getCurrentUser:()=>Promise.resolve({uid:'U1'}),
    getLoginState:()=>Promise.resolve({uid:'U1',user:{uid:'U1'}})
  });
  const s=await A.sendPhoneCode('15550836896');
  const afterSend=A.readLocal();
  let r=null,err='';
  try{ r=await A.loginByPhoneCode('123456'); }catch(e){ err=String(e.message).slice(0,80); }
  return { sendOk:s&&s.ok, vid:afterSend.verificationId, isUser:afterSend.isUser,
    calls, loginOk:r&&r.ok, err, local:A.readLocal() };
});
ok(newUser.sendOk && newUser.vid==='VID', `发码成功并存下 verificationId(${newUser.vid})`);
ok(newUser.calls.some(c=>c.startsWith('signUp')), '新用户走注册(signUp)分支');
ok(newUser.calls.some(c=>c.includes('verification_code')), '注册传的是**原始验证码**(非 token)');
ok(newUser.loginOk===true, `注册登录成功`+(newUser.err?'：'+newUser.err:''));
ok(newUser.local && newUser.local.method==='phone', `写入本地登录态(method=${newUser.local&&newUser.local.method})`);

/* ③ 老用户：走 signIn */
const oldUser = await page.evaluate(async ()=>{
  localStorage.clear();
  const A=window.HansenAuth; const calls=[];
  A._setAuthForTest({
    getVerification:o=>{calls.push('getVerification');return Promise.resolve({verification_id:'VID2',is_user:true});},
    verify:o=>{calls.push('verify');return Promise.resolve({verification_token:'TK2'});},
    signUp:o=>{calls.push('signUp');return Promise.resolve({user:{uid:'U2'}});},
    signIn:o=>{calls.push('signIn:'+JSON.stringify(o));
      try{ localStorage.setItem('credentials_ambitious-test', JSON.stringify({
        access_token:'AT', refresh_token:'RT', expires_in:7200,
        expires_at:new Date(Date.now()+7200000).toISOString() })); }catch(e){}
      return Promise.resolve({user:{uid:'U2'},access_token:'AT',expires_in:7200});},
    getCurrentUser:()=>Promise.resolve({uid:'U2'}),
    getLoginState:()=>Promise.resolve({uid:'U2',user:{uid:'U2'}})
  });
  await A.sendPhoneCode('15550836896');
  let r=null,err='';
  try{ r=await A.loginByPhoneCode('123456'); }catch(e){ err=String(e.message).slice(0,80); }
  return { calls, ok:r&&r.ok, err };
});
ok(oldUser.calls.some(c=>c.startsWith('signIn')), '老用户走登录(signIn)分支');
ok(oldUser.calls.includes('verify'), '老用户先 verify 换 token');
ok(oldUser.ok===true, '老用户登录成功'+(oldUser.err?'：'+oldUser.err:''));
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
/* 🔴v1080：SDK 没下发凭证时，绝不能写"已登录"。
   用户真机现场：+1ms 凭证 1314 字节还在，+2143ms 就被删了，之后探测全是 null，
   而界面一直显示"已登录" —— 根源是这一步只看 Promise 有没有 reject。
   SDK 的 setCredentials 在响应缺 expires_in 时会**删掉已存凭证**且依然 resolve，
   所以"没报错"根本不等于"登录成功"。 */
const noCred = await page.evaluate(async ()=>{
  localStorage.clear();
  const A=window.HansenAuth;
  A._setAuthForTest({
    getVerification:()=>Promise.resolve({verification_id:'VID',is_user:false}),
    verify:()=>Promise.resolve({verification_token:'TK'}),
    /* 这就是坏掉的那种响应：resolve 了，但既无 expires_in、也不写凭证键 */
    signUp:()=>Promise.resolve({user:{uid:'U9'}}),
    signIn:()=>Promise.resolve({user:{uid:'U9'}})
  });
  await A.sendPhoneCode('+8613800138000').catch(()=>{});
  let err='';
  try{ await A.loginByPhoneCode('123456'); }catch(e){ err=String(e.message||e); }
  return { err, local:A.readLocal(), signedIn:A.isSignedIn() };
});
ok(/未真正完成|没有下发有效凭证/.test(noCred.err),
   `★ 云端没下发凭证 → 明确报错而非假装成功：${noCred.err.slice(0,50)}`);
ok(!noCred.local.method, '★ 此时**不得**写入本地登录态（否则界面会说"已登录"而实际没会话）');
ok(noCred.signedIn === false, '★ isSignedIn() 保持 false');

await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
