/* test_auth_contract_v1075.mjs —— v1075 业务状态机合同（模拟 SDK）
 * 真实 bundle API 形状由 test_auth_vendor_v1075.mjs 单独验证；
 * 真实短信/CloudBase 环境仍必须按部署指南人工冒烟。 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const authSrc=fs.readFileSync(path.join(ROOT,'hansen_auth_v1004.js'),'utf8');
const uiSrc=fs.readFileSync(path.join(ROOT,'hansen_auth_ui_v1004.js'),'utf8');
const vendorSrc=fs.readFileSync(path.join(ROOT,'vendor_cloudbase_esm_v965.js'),'utf8');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  OK  '+m);}else{fail++;console.log('  XX  '+m);}};
function storage(){return{d:{},get length(){return Object.keys(this.d).length;},key(i){return Object.keys(this.d)[i]||null;},getItem(k){return Object.prototype.hasOwnProperty.call(this.d,k)?this.d[k]:null;},setItem(k,v){this.d[k]=String(v);},removeItem(k){delete this.d[k];},clear(){this.d={};}};}
function boot(){
  const local=storage(),session=storage(),events=[];
  const doc={addEventListener(){},removeEventListener(){},dispatchEvent(e){events.push(e);return true;},getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return[];},documentElement:{classList:{contains(){return false;}}},body:null};
  const win={__HANSEN_AUTH_NO_BOOT__:true,__HANSEN_AUTH_TEST_FAST__:true,HANSEN_CLOUD_CONFIG:{envId:'test',region:'ap-shanghai'},localStorage:local,sessionStorage:session,document:doc,CustomEvent:class{constructor(type,opts){this.type=type;this.detail=(opts||{}).detail;}},setTimeout,clearTimeout,setInterval,clearInterval,TextEncoder,TextDecoder,console};
  win.window=win; const ctx={...win,window:win,globalThis:win}; vm.createContext(ctx); vm.runInContext(authSrc,ctx);
  return{A:win.HansenAuth,local,session,events,win,ctx,setCloudSave(v){win.HansenCloudSave=v;ctx.HansenCloudSave=v;}};
}
const sessionResult=(uid,extra={})=>({data:{session:uid?{user:{uid,...extra}}:null},error:null});
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject};}
async function flush(n=12){for(let i=0;i<n;i++)await Promise.resolve();}

console.log('v1075 认证业务状态机合同');
ok(/2\.30\.0/.test(vendorSrc),'仓库锁定 CloudBase SDK 2.30.0');
ok(!/@u\.wordadventure\.local/.test(authSrc),'不再生成不可收件的 .local 假邮箱');
ok(!/signUpWithEmailAndPassword\s*\(/.test(authSrc),'业务注册不再走邮箱第一步');
ok(/phone_number[\s\S]*verification_code[\s\S]*verification_token[\s\S]*username[\s\S]*password/.test(authSrc),'手机号 v2 signUp 使用 phone/code/token/username/password');
ok(/resolveCloudChoice/.test(uiSrc)&&!/点「取消」= 用本机覆盖云端/.test(uiSrc),'冲突取消不再覆盖云端');

{
  const b=boot(),gate=deferred(),calls=[];
  b.A._setAuthForTest({
    getVerification(o){calls.push(['send',o]);return Promise.resolve({verification_id:'V1',is_user:false});},
    verify(o){calls.push(['verify',o]);return Promise.resolve({verification_token:'T1'});},
    signUp(o){calls.push(['signup',o]);return Promise.resolve({user:{uid:'U-NEW',phone_number:'+86 15550836896',username:'Hansen_1'}});},
    getSession(){calls.push(['session']);return gate.promise;}
  });
  const sent=await b.A.sendPhoneCode('15550836896'),pending=b.A.readPending();
  ok(sent.ok&&!sent.isUser&&calls.filter(x=>x[0]==='send').length===1,'新手机号只发送一次验证码');
  ok(pending.verificationId==='V1'&&pending.resendAt>Date.now(),'事务在 sessionStorage 并保存绝对重发时间');
  ok(!/abc123|123456|T1/.test(JSON.stringify(b.session.d)),'存储中没有密码、短信码或 token');
  const loginPromise=b.A.loginByPhoneCode('123456','Hansen_1','abc123','abc123');
  await flush();
  ok(!b.A.readLocal().uid&&!b.A.readLocal().signedAt,'getSession 未确认前绝不写成功 marker');
  gate.resolve(sessionResult('U-NEW',{phone_number:'+86 15550836896',username:'Hansen_1'}));
  const result=await loginPromise,signup=calls.find(x=>x[0]==='signup')[1];
  ok(signup.verification_code==='123456'&&signup.verification_token==='T1','signUp 使用同一 code+token');
  ok(signup.username==='Hansen_1'&&signup.password==='abc123','同事务设置用户名密码');
  ok(result.ok&&result.uid==='U-NEW'&&b.A.isSignedIn(),'operation UID 与 session UID 一致后才成功');
  ok(b.A.readLocal().uid==='U-NEW'&&b.A.readLocal().schema===1075,'提交 schema 1075 + 真实 UID');
  ok(Object.keys(b.A.readPending()).length===0,'成功后清理验证码事务');
}
{
  const b=boot();
  b.A._setAuthForTest({getVerification(){return Promise.resolve({verification_id:'V2',is_user:true});},verify(){return Promise.resolve({verification_token:'T2'});},signIn(){return Promise.resolve({user:{uid:'U-OLD'}});},signUp(){throw new Error('wrong branch');},getSession(){return Promise.resolve(sessionResult('U-OLD'));}});
  await b.A.sendPhoneCode('15550836896'); const r=await b.A.loginByPhoneCode('123456');
  ok(r.uid==='U-OLD','已有手机号走 verify→signIn');
}
{
  const b=boot();let calls=0;
  b.A._setAuthForTest({signInWithPassword(o){calls++;return Promise.resolve({data:{user:{uid:'U-PW',username:o.username}},error:null});},getSession(){return Promise.resolve(sessionResult('U-PW',{username:'player_1'}));}});
  const r=await b.A.loginByPassword('player_1','server-policy-password');
  ok(r.uid==='U-PW'&&calls===1&&b.A.readLocal().uid==='U-PW','用户名密码只登录并提交相同 UID');
}
{
  const b=boot();
  b.A._setAuthForTest({signInWithPassword(){return Promise.resolve({data:null,error:{message:'password incorrect'}});},getSession(){throw new Error('unexpected');}});
  let rejected=false;try{await b.A.loginByPassword('player_1','bad');}catch(e){rejected=true;}
  ok(rejected&&!b.A.readLocal().uid,'resolved {error} 失败且不写 marker');
}
{
  const b=boot();
  b.A._setAuthForTest({signInWithPassword(){return Promise.resolve({user:{uid:'NEW'}});},getSession(){return Promise.resolve(sessionResult('OLD'));}});
  let rejected=false;try{await b.A.loginByPassword('player_1','pw');}catch(e){rejected=/不一致|确认/.test(String(e.message));}
  ok(rejected&&!b.A.readLocal().uid&&!b.A.isSignedIn(),'operation UID≠session UID 时失败关闭');
  ok(b.A.operationStatus().state==='outcome_unknown','UID 不一致进入结果未知态');
}
{
  const b=boot();
  b.A._setAuthForTest({signInWithPassword(){return Promise.resolve({user:{uid:'ANON',is_anonymous:true}});},getSession(){return Promise.resolve(sessionResult('ANON',{is_anonymous:true}));}});
  let rejected=false;try{await b.A.loginByPassword('player_1','pw');}catch(e){rejected=true;}
  ok(rejected&&!b.A.readLocal().uid,'匿名 UID 不能冒充正式账号');
}
{
  const b=boot();
  b.local.setItem('hansen_auth_v1004',JSON.stringify({schema:1075,method:'phone',signedAt:Date.now(),uid:'U1'}));
  b.A._setSessionForTest('confirmed','U1');
  b.A._setAuthForTest({signOut(){return Promise.resolve({error:{message:'revoke failed'}});},getSession(){return Promise.resolve(sessionResult('U1'));}});
  let rejected=false;try{await b.A.signOut();}catch(e){rejected=true;}
  ok(rejected&&b.A.readLocal().uid==='U1','SDK 登出失败不谎报成功、不清 marker');
}
{
  const b=boot();let writes=0,restores=0;
  b.setCloudSave({resetApp(){},accountCloudInfo(){return Promise.resolve({exists:true,updatedAt:123});},syncNow(){writes++;return Promise.resolve({ok:true});},ensureKey(){return'KEY';},restoreWithKey(){restores++;return Promise.resolve({ok:true});}});
  b.A._setAuthForTest({signInWithPassword(){return Promise.resolve({user:{uid:'U-SYNC'}});},getSession(){return Promise.resolve(sessionResult('U-SYNC'));}});
  const r=await b.A.loginByPassword('sync_user','pw'),post=await r.postLogin;
  ok(post.sync.action==='restore-available'&&writes===0&&restores===0,'登录后只读检查，不自动覆盖');
  await b.A.resolveCloudChoice('later','U-SYNC');
  ok(writes===0&&restores===0,'稍后处理严格零写入');
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
