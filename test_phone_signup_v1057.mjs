/* test_phone_signup_v1057.mjs —— v1057 SDK 路径事故的持续回归
 * v1075：验证码事务只在 sessionStorage；新用户带用户名/密码；
 * 成功必须同时满足 operation UID 与 getSession UID。 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const launch=process.env.HANSEN_CHROMIUM_PATH?{executablePath:process.env.HANSEN_CHROMIUM_PATH}:{};
const browser=await chromium.launch(launch); let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  OK  '+m);}else{fail++;console.log('  XX  '+m);}};
console.log('手机号注册登录链路 v1057→v1075');
const src=fs.readFileSync(path.join(ROOT,'hansen_auth_v1004.js'),'utf8');
const refs=[...src.matchAll(/import\('\.\/(vendor_cloudbase_esm_v\d+\.js)/g)].map(m=>m[1]);
ok(refs.length>0&&refs.every(x=>fs.existsSync(path.join(ROOT,x))),'所有 SDK import 都指向真实文件');
ok(/_setAuthForTest/.test(src),'保留可执行测试注入口');
const page=await browser.newPage({viewport:{width:390,height:844}}),errs=[];
page.on('pageerror',e=>errs.push(String(e.message)));
await page.addInitScript(()=>{localStorage.clear();sessionStorage.clear();window.__HANSEN_AUTH_NO_BOOT__=true;window.__HANSEN_AUTH_TEST_FAST__=true;});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(400);
const fresh=await page.evaluate(async()=>{
 const A=window.HansenAuth,calls=[];
 A._setAuthForTest({
  getVerification:o=>{calls.push(['send',o]);return Promise.resolve({verification_id:'VID',is_user:false});},
  verify:o=>{calls.push(['verify',o]);return Promise.resolve({verification_token:'TK'});},
  signUp:o=>{calls.push(['signup',o]);return Promise.resolve({user:{uid:'U1',phone_number:'+86 15550836896',username:'player_1'}});},
  getSession:()=>Promise.resolve({data:{session:{user:{uid:'U1',phone_number:'+86 15550836896',username:'player_1'}}},error:null})
 });
 await A.sendPhoneCode('15550836896'); const pending=A.readPending(),before=A.readLocal();
 const r=await A.loginByPhoneCode('123456','player_1','pw-value','pw-value');
 return{calls,pending,before,r,local:A.readLocal(),signed:A.isSignedIn()};
});
ok(fresh.pending.verificationId==='VID'&&!fresh.before.verificationId,'verificationId 只在 sessionStorage');
ok(fresh.calls.some(x=>x[0]==='signup'&&x[1].username==='player_1'),'新用户走 v2 signUp 并设置用户名');
ok(fresh.r.ok&&fresh.r.uid==='U1'&&fresh.signed,'一致 UID 后注册登录成功');
const existing=await page.evaluate(async()=>{
 const A=window.HansenAuth,calls=[];
 A._setAuthForTest({
  getVerification:()=>Promise.resolve({verification_id:'VID2',is_user:true}),
  verify:()=>Promise.resolve({verification_token:'TK2'}),
  signIn:o=>{calls.push(['signin',o]);return Promise.resolve({user:{uid:'U2'}});},
  signUp:()=>{calls.push(['signup']);return Promise.reject(new Error('wrong branch'));},
  getSession:()=>Promise.resolve({data:{session:{user:{uid:'U2'}}},error:null})
 });
 await A.sendPhoneCode('15550836896');const r=await A.loginByPhoneCode('123456');return{calls,r};
});
ok(existing.calls.some(x=>x[0]==='signin')&&!existing.calls.some(x=>x[0]==='signup'),'已有手机号只走 signIn');
ok(existing.r.ok&&existing.r.uid==='U2','已有手机号 session UID 确认成功');
ok(errs.length===0,'浏览器零 pageerror'+(errs.length?': '+errs[0]:''));
await browser.close();srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);process.exit(fail===0?0:1);
