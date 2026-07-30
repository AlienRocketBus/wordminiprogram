/* test_auth_contract_v1076.mjs —— v1076 业务状态机合同（模拟 SDK）
 * 真实 bundle API 形状由 test_auth_vendor_v1076.mjs 单独验证；
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
function boot(shared={}){
  const local=shared.local||storage(),session=shared.session||storage(),events=[];
  const doc={addEventListener(){},removeEventListener(){},dispatchEvent(e){events.push(e);return true;},getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return[];},documentElement:{classList:{contains(){return false;}}},body:null};
  const win={__HANSEN_AUTH_NO_BOOT__:true,__HANSEN_AUTH_TEST_FAST__:true,
    __HANSEN_AUTH_SLOW_MS__:shared.slowMs,
    __HANSEN_AUTH_MUTATION_TIMEOUT_MS__:shared.mutationTimeoutMs,
    HANSEN_CLOUD_CONFIG:{envId:'test',region:'ap-shanghai'},localStorage:local,sessionStorage:session,document:doc,CustomEvent:class{constructor(type,opts){this.type=type;this.detail=(opts||{}).detail;}},setTimeout,clearTimeout,setInterval,clearInterval,TextEncoder,TextDecoder,console};
  win.window=win; const ctx={...win,window:win,globalThis:win}; vm.createContext(ctx); vm.runInContext(authSrc,ctx);
  return{A:win.HansenAuth,local,session,events,win,ctx,setCloudSave(v){win.HansenCloudSave=v;ctx.HansenCloudSave=v;}};
}
const sessionResult=(uid,extra={})=>({data:{session:uid?{user:{uid,...extra}}:null},error:null});
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject};}
async function flush(n=12){for(let i=0;i<n;i++)await Promise.resolve();}

console.log('v1076 认证业务状态机合同');
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
  ok(b.A.readLocal().uid==='U-NEW'&&b.A.readLocal().schema===1076,'提交 schema 1076 + 真实 UID');
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
  ok(b.A.operationStatus().state==='outcome_unknown'&&
     b.A.sessionStatus().state==='mismatch'&&b.A._readFenceForTest().kind==='mismatch',
     'UID 不一致进入持久隔离态，不能自动接管隐藏会话');
}
{
  const b=boot();
  b.A._setAuthForTest({signInWithPassword(){return Promise.resolve({user:{uid:'ANON',is_anonymous:true}});},getSession(){return Promise.resolve(sessionResult('ANON',{is_anonymous:true}));}});
  let rejected=false;try{await b.A.loginByPassword('player_1','pw');}catch(e){rejected=true;}
  ok(rejected&&!b.A.readLocal().uid,'匿名 UID 不能冒充正式账号');
}
{
  const b=boot();
  b.A._setAuthForTest({signInWithPassword(){return Promise.resolve({user:{uid:'ANON-RAW',name:'anonymous',providers:[{id:'anonymous'}]}});},getSession(){throw new Error('不应读取');}});
  let rejected=false;try{await b.A.loginByPassword('player_1','pw');}catch(e){rejected=true;}
  ok(rejected&&!b.A.readLocal().uid,'真实 LoginState 的 name/providers.id 匿名形状不能冒充正式账号');
}
{
  const b=boot();
  b.local.setItem('hansen_auth_v1004',JSON.stringify({schema:1076,method:'phone',signedAt:Date.now(),uid:'U-CACHED'}));
  b.A._setSessionForTest('confirmed','U-CACHED');
  b.A._setAuthForTest({getSession(){return Promise.resolve({data:{session:{access_token:'still-present',user:null},user:null},error:null});}});
  const st=await b.A.refreshSession();
  ok(st.state==='unknown'&&b.A.readLocal().uid==='U-CACHED',
     'session 非空但 user:null 属 unknown，绝不清 marker 或谎报退出');
}
{
  const b=boot();
  b.A._setAuthForTest({
    getSession(){return Promise.resolve({data:{session:{access_token:'still-present',user:null},user:null},error:null});},
    getCurrentUser(){return Promise.resolve({uid:'U-REFRESH',user_metadata:{username:'restored_name'}});}
  });
  const st=await b.A.refreshSession();
  ok(st.state==='confirmed'&&b.A.readLocal().uid==='U-REFRESH'&&b.A.readLocal().username==='restored_name',
     'getSession 空用户时用 getCurrentUser(true) 刷新并恢复 metadata 用户名');
}
{
  const b=boot();
  b.local.setItem('hansen_auth_v1004',JSON.stringify({schema:1076,method:'phone',signedAt:Date.now(),uid:'U-OUT'}));
  b.A._setSessionForTest('confirmed','U-OUT');
  b.A._setAuthForTest({
    signOut(){return Promise.resolve({data:{},error:null});},
    getSession(){return Promise.resolve({data:{session:{refresh_token:'still-present',user:null},user:null},error:null});}
  });
  let rejected=false;try{await b.A.signOut();}catch(e){rejected=true;}
  ok(rejected&&b.A.readLocal().uid==='U-OUT','只要 session/凭证仍存在就不能宣布退出成功');
}
{
  const b=boot();
  b.local.setItem('hansen_auth_v1004',JSON.stringify({schema:1076,method:'phone',signedAt:Date.now(),uid:'U1'}));
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

{
  const b=boot(),oldProbeGate=deferred();
  b.A._setAuthForTest({getSession(){return oldProbeGate.promise;}});
  const oldProbe=b.A.refreshSession(); await flush();
  b.A._setAuthForTest({
    signInWithPassword(){return Promise.resolve({user:{uid:'U-NEW'}});},
    getSession(){return Promise.resolve(sessionResult('U-NEW'));}
  });
  await b.A.loginByPassword('new_user','pw');
  oldProbeGate.resolve(sessionResult('U-OLD'));
  await oldProbe;
  ok(b.A.readLocal().uid==='U-NEW'&&b.A.sessionStatus().uid==='U-NEW'&&
     b.A.sessionStatus().state==='confirmed',
     '旧 refresh 探测晚到不能覆盖新登录的 marker/session');
}
{
  const b=boot(),oldEnsureGate=deferred();
  b.local.setItem('hansen_auth_v1004',JSON.stringify({
    schema:1076,method:'password',signedAt:Date.now(),uid:'U-A'
  }));
  b.A._setSessionForTest('confirmed','U-A');
  b.A._setAuthForTest({getSession(){return oldEnsureGate.promise;}});
  const oldEnsure=b.A.ensureSession('U-A'); await flush();
  b.A._setAuthForTest({
    signInWithPassword(){return Promise.resolve({user:{uid:'U-B'}});},
    getSession(){return Promise.resolve(sessionResult('U-B'));}
  });
  await b.A.loginByPassword('user_b','pw');
  oldEnsureGate.resolve(sessionResult('U-A'));
  const stale=await oldEnsure;
  ok(stale.stale===true&&b.A.readLocal().uid==='U-B'&&b.A.sessionStatus().uid==='U-B',
     '旧 ensureSession 晚到只返回 stale，不能改写新账号');
}
{
  const b=boot();
  b.A._setAuthForTest({
    signInWithPassword(){
      return Promise.resolve({
        data:{session:{access_token:'accepted-but-user-missing',user:null},user:null},
        error:null
      });
    },
    getSession(){return Promise.resolve(sessionResult('U-HIDDEN'));}
  });
  const err=await b.A.loginByPassword('missing_uid','pw').then(()=>null,e=>e);
  ok(err&&err.code==='AUTH_OPERATION_UID_MISSING'&&!b.A.readLocal().uid&&
     b.A._readFenceForTest().kind==='outcome_unknown',
     'session-changing API 已 resolve 但 operation UID 缺失时写 fence，不能按普通失败处理');
  const refreshed=await b.A.refreshSession();
  ok(refreshed.state==='unknown'&&!b.A.readLocal().uid&&!b.A.isSignedIn(),
     '结果缺 UID 后即使隐藏 SDK 用户恢复，也不能自动收养为登录账号');
}
{
  const b=boot(),confirmGate=deferred();
  let calls=0,confirmStarted;
  const seen=new Promise(r=>{confirmStarted=r;});
  b.local.setItem('hansen_auth_v1004',JSON.stringify({
    schema:1076,method:'password',signedAt:Date.now(),uid:'U-A'
  }));
  b.A._setSessionForTest('confirmed','U-A');
  b.A._setAuthForTest({
    signInWithPassword(){return Promise.resolve({user:{uid:'U-B'}});},
    getSession(){
      calls++;
      if(calls===1){confirmStarted();return confirmGate.promise;}
      if(calls===2)return Promise.resolve(sessionResult('U-C'));
      return Promise.resolve(sessionResult(''));
    }
  });
  const login=b.A.loginByPassword('user_b','pw').then(()=>null,e=>e);
  await seen;
  const mismatch=await b.A.ensureSession('U-A');
  ok(mismatch.mismatch&&b.A._readFenceForTest().kind==='mismatch',
     '并发 ensureSession 发现 A/C 不一致后写最高优先级 mismatch');
  confirmGate.resolve(sessionResult(''));
  await login;
  let recoveryRejected=false;
  try{await b.A.recoverAuthOutcome();}catch(e){recoveryRejected=true;}
  ok(recoveryRejected&&b.A._readFenceForTest().kind==='mismatch'&&
     b.A.readLocal().uid==='U-A',
     '后到 outcome_unknown 不能降级覆盖 mismatch，也不能自动恢复成 B');
}
{
  const b=boot(),sendGate=deferred();
  b.A._setAuthForTest({
    getVerification(){return sendGate.promise;},
    signOut(){return Promise.resolve({data:{},error:null});},
    getSession(){return Promise.resolve(sessionResult(''));}
  });
  const sending=b.A.sendPhoneCode('15550836896').then(()=>null,e=>e);
  await flush();
  const out=await b.A.signOut();
  sendGate.resolve({verification_id:'TOO-LATE',is_user:false});
  const late=await sending; await flush();
  ok(out.ok&&!out.cleanupPending&&late&&late.code==='AUTH_STALE_OPERATION'&&
     Object.keys(b.A.readPending()).length===0&&!b.A.readLocal().uid,
     '退出会立即作废晚到的发码结果，不能复活验证码事务');
}
{
  const b=boot(),loginGate=deferred();
  b.A._setAuthForTest({
    signInWithPassword(){return loginGate.promise;},
    signOut(){return Promise.resolve({data:{},error:null});},
    getSession(){return Promise.resolve(sessionResult(''));}
  });
  const login=b.A.loginByPassword('late_user','pw').then(()=>null,e=>e);
  await flush();
  const firstOut=await b.A.signOut();
  const stale=await login;
  ok(firstOut.ok&&firstOut.cleanupPending&&firstOut.requiresReload&&
     stale&&stale.code==='AUTH_STALE_OPERATION'&&!b.A.readLocal().uid&&
     b.A._readFenceForTest().kind==='stale_mutation',
     '登录请求悬挂时退出：本地立即退出，旧请求被隔离且要求再次核对');
  loginGate.resolve({user:{uid:'U-LATE'}});
  await flush();
  const secondOut=await b.A.signOut();
  ok(secondOut.ok&&!secondOut.cleanupPending&&!b.A._readFenceForTest().kind&&
     b.A.sessionStatus().state==='signed_out',
     '旧登录请求晚到后再次安全退出，确认 session=null 才清隔离');
}
{
  const b=boot(),loginGate=deferred(),snapshotGate=deferred();
  let serverUid='',signingOut=false,snapshotCalls=0;
  b.A._setAuthForTest({
    signInWithPassword(){
      return loginGate.promise.then(r=>{serverUid='U-REVIVED';return r;});
    },
    signOut(){signingOut=true;serverUid='';return Promise.resolve({data:{},error:null});},
    getSession(){
      if(signingOut&&snapshotCalls++===0)return snapshotGate.promise;
      return Promise.resolve(sessionResult(serverUid));
    }
  });
  const login=b.A.loginByPassword('revive_user','pw').then(()=>null,e=>e);
  await flush();
  const outPromise=b.A.signOut();
  await flush();
  snapshotGate.resolve(sessionResult(''));
  loginGate.resolve({user:{uid:'U-REVIVED'}});
  const out=await outPromise; await login; await flush();
  ok(out.cleanupPending&&b.A._readFenceForTest().kind==='stale_mutation',
     '退出曾有旧 session mutation 时，即使其在清理回调前结算也必须保留 fence');
  const probe=await b.A.refreshSession();
  ok(probe.state==='unknown'&&!b.A.readLocal().uid,
     '退出快照为 null 后旧 signIn 复活 session，也不能被 refresh 自动收养');
  await b.A.signOut();
  ok(!b.A._readFenceForTest().kind&&b.A.sessionStatus().state==='signed_out',
     '再次显式退出并确认 session=null 后才解除复活隔离');
}
{
  const b=boot(),outGate=deferred();
  b.local.setItem('hansen_auth_v1004',JSON.stringify({
    schema:1076,method:'password',signedAt:Date.now(),uid:'U-SIGNOUT'
  }));
  b.A._setSessionForTest('confirmed','U-SIGNOUT');
  b.A._setAuthForTest({
    signOut(){return outGate.promise;},
    getSession(){return Promise.resolve(sessionResult(''));}
  });
  const out=b.A.signOut(); await flush();
  const during=await b.A.refreshSession();
  outGate.resolve({data:{},error:null});
  await out;
  ok(during.state==='checking'&&!b.A.readLocal().uid&&
     b.A.sessionStatus().state==='signed_out',
     'signOut 进行中拒绝同代 refresh，退出结论不会被旧探测反写');
}
{
  const shared={local:storage(),session:storage()};
  const b1=boot(shared);
  b1.A._setAuthForTest({
    signInWithPassword(){return Promise.resolve({user:{uid:'U-EXPECTED'}});},
    getSession(){return Promise.resolve(sessionResult('U-OBSERVED'));}
  });
  await b1.A.loginByPassword('mismatch_user','pw').then(()=>null,e=>e);
  ok(b1.A._readFenceForTest().kind==='mismatch','UID mismatch 写入 sessionStorage 隔离');
  const b2=boot(shared);
  b2.A._setAuthForTest({
    getSession(){return Promise.resolve(sessionResult('U-OBSERVED'));},
    signOut(){return Promise.resolve({data:{},error:null});}
  });
  const reloaded=await b2.A.refreshSession();
  ok(reloaded.state==='mismatch'&&!b2.A.readLocal().uid,
     '模拟刷新后 mismatch 仍在，隐藏 SDK UID 不能被自动收养');
  b2.A._setAuthForTest({
    getSession(){return Promise.resolve(sessionResult(''));},
    signOut(){return Promise.resolve({data:{},error:null});}
  });
  const noSessionProbe=await b2.A.refreshSession();
  ok(noSessionProbe.state==='mismatch'&&b2.A._readFenceForTest().kind==='mismatch',
     '一次只读 session=null 也无权清 mismatch fence');
  await b2.A.signOut();
  ok(!b2.A._readFenceForTest().kind&&b2.A.sessionStatus().state==='signed_out',
     '只有服务端 session=null 的显式安全退出能清 mismatch 隔离');
}
{
  const shared={local:storage(),session:storage(),slowMs:5,mutationTimeoutMs:25};
  const never=deferred(),b=boot(shared);
  b.A._setAuthForTest({
    signInWithPassword(){return never.promise;},
    signOut(){return Promise.resolve({data:{},error:null});},
    getSession(){return Promise.resolve(sessionResult(''));}
  });
  const err=await b.A.loginByPassword('hung_user','pw').then(()=>null,e=>e);
  const op=b.A.operationStatus();
  ok(err&&err.code==='AUTH_MUTATION_INDETERMINATE'&&!op.busy&&
     op.requiresCleanup&&op.state==='outcome_unknown',
     '永久悬挂认证在硬上限后释放提交 spinner，但保留不可重试隔离');
  let retryRejected=false;
  try{await b.A.loginByPassword('hung_user','pw');}catch(e){retryRejected=true;}
  ok(retryRejected,'结果未知 fence 阻止重复认证 mutation');
  const out=await b.A.signOut();
  ok(out.ok&&out.cleanupPending&&!b.A.readLocal().uid&&!b.A.operationStatus().busy,
     '悬挂请求期间仍可安全退出，本地不再永久卡死');
  const reload=boot({local:shared.local,session:shared.session});
  reload.A._setAuthForTest({
    getSession(){return Promise.resolve(sessionResult(''));},
    signOut(){return Promise.resolve({data:{},error:null});}
  });
  const fencedState=await reload.A.refreshSession();
  ok(fencedState.state==='unknown'&&reload.A._readFenceForTest().kind,
     '刷新后的只读探测仍不能自行解除悬挂隔离');
  await reload.A.signOut();
  ok(reload.A.sessionStatus().state==='signed_out'&&!reload.A._readFenceForTest().kind,
     '刷新后仍需显式安全退出并确认无 session，才能最终解除隔离');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
