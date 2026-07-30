/* test_auth_ui_v1076.mjs —— 手机尺寸真实 DOM 注册、云存档选择互斥与安全清理流程。 */
import{chromium}from'./playwright_loader.mjs';import http from'node:http';import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/_frame.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':path.extname(p)==='.js'?'text/javascript':'text/html; charset=utf-8'});res.end(d);});});
await new Promise(r=>srv.listen(0,r));const launch=process.env.HANSEN_CHROMIUM_PATH?{executablePath:process.env.HANSEN_CHROMIUM_PATH}:{};const browser=await chromium.launch(launch),page=await browser.newPage({viewport:{width:390,height:844}}),errs=[];page.on('pageerror',e=>errs.push(String(e.message)));
await page.addInitScript(()=>{window.__HANSEN_AUTH_NO_BOOT__=true;window.__HANSEN_AUTH_TEST_FAST__=true;window.HANSEN_CLOUD_CONFIG={envId:'test',region:'ap-shanghai'};});
await page.goto(`http://127.0.0.1:${srv.address().port}/_frame.html`);await page.addScriptTag({url:'/hansen_auth_v1004.js'});await page.addScriptTag({url:'/hansen_auth_ui_v1004.js'});
await page.evaluate(()=>{let signed=false;window.HansenAuth._setAuthForTest({getVerification:()=>Promise.resolve({verification_id:'UI-V',is_user:false}),verify:()=>Promise.resolve({verification_token:'UI-T'}),signUp:o=>{signed=true;return Promise.resolve({user:{uid:'UI-U',phone_number:o.phone_number,username:o.username}});},getSession:()=>Promise.resolve({data:{session:signed?{user:{uid:'UI-U',phone_number:'+86 15550836896',username:'ui_player'}}:null},error:null}),signOut:()=>{signed=false;return Promise.resolve({});}});window.HansenAuthUI.open();});
await page.waitForSelector('#auPhone');await page.fill('#auPhone','15550836896');await page.click('#auSend');await page.waitForSelector('#auNewUser');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('  OK  '+m);}else{fail++;console.log('  XX  '+m);}};
ok((await page.getAttribute('#auPhone','readonly'))!==null,'发码后手机号锁定，事务不会错配');
ok((await page.textContent('#auSend')).includes('秒后重发'),'显示基于 resendAt 的重发倒计时');
await page.click('#auX');await page.evaluate(()=>window.HansenAuthUI.open());await page.waitForSelector('#auNewUser');
ok((await page.textContent('#auSend')).includes('秒后重发'),'关闭再打开后倒计时继续，不会永久冻结');
await page.fill('#auCode','123456');await page.fill('#auNewUser','ui_player');await page.fill('#auNewPwd','pw');await page.fill('#auNewPwd2','pw');await page.click('#auGo');
await page.waitForFunction(()=>document.body.textContent.includes('CloudBase session UID 与本地 UID 已精确一致'));
ok(await page.evaluate(()=>window.HansenAuth.isSignedIn()&&window.HansenAuth.readLocal().uid==='UI-U'),'真实点击链完成并提交 UI-U');

/* 用可控 Promise 验证：一旦选择覆盖方向，旧 DOM 引用也不能重复提交、改选、稍后或关闭。 */
await page.evaluate(()=>{
  const state={
    signed:false,session:'signed_out',op:'idle',opBusy:false,
    choiceCalls:0,signOutCalls:0,resolveChoice:null
  };
  window.__authUiRace=state;
  window.HansenAuth={
    ready:()=>true,
    isSignedIn:()=>state.signed,
    readLocal:()=>state.signed?{uid:'UI-CLOUD',username:'cloud_user'}:{},
    sessionStatus:()=>({state:state.session}),
    operationStatus:()=>({busy:state.opBusy,state:state.op}),
    readPending:()=>({}),
    refreshSession:()=>Promise.resolve({state:state.session}),
    friendly:e=>String(e&&e.message||e||'未知错误'),
    loginByPassword:()=>{
      state.signed=true;state.session='confirmed';
      return Promise.resolve({
        ok:true,uid:'UI-CLOUD',
        postLogin:Promise.resolve({
          cid:7,
          sync:{action:'conflict',local:{islands:2,learned:8},cloudUpdatedAt:123}
        })
      });
    },
    resolveCloudChoice:()=>{
      state.choiceCalls++;
      return new Promise(resolve=>{state.resolveChoice=resolve;});
    },
    signOut:()=>{
      state.signOutCalls++;
      state.signed=false;state.session='signed_out';state.op='idle';state.opBusy=false;
      return Promise.resolve({ok:true});
    }
  };
  window.confirm=()=>true;
  window.HansenAuthUI.close();
  window.HansenAuthUI.open();
});
await page.click('[data-m="password"]');
await page.fill('#auUser','cloud_user');
await page.fill('#auPwd','pw');
await page.click('#auGo');
await page.waitForSelector('#auKeepLocal');

await page.evaluate(()=>{
  const old={
    local:document.getElementById('auKeepLocal'),
    cloud:document.getElementById('auKeepCloud'),
    defer:document.getElementById('auDefer'),
    close:document.getElementById('auX'),
    push:document.getElementById('auPush'),
    out:document.getElementById('auOut')
  };
  old.local.click();
  old.local.click();
  old.cloud.click();
  old.defer.click();
  old.push.click();
  old.out.click();
  old.close.click();
});
await page.waitForFunction(()=>window.__authUiRace.choiceCalls===1);
const applying=await page.evaluate(()=>({
  calls:window.__authUiRace.choiceCalls,
  open:document.getElementById('hsn_auth_panel').classList.contains('on'),
  text:document.body.textContent,
  choices:['auKeepLocal','auKeepCloud','auDefer'].some(id=>!!document.getElementById(id)),
  closeDisabled:document.getElementById('auX').disabled,
  pushDisabled:document.getElementById('auPush').disabled,
  outDisabled:document.getElementById('auOut').disabled
}));
ok(applying.calls===1,'云/本机选择 Promise 只启动一次，旧按钮引用不能重复提交或改选');
ok(applying.open&&!applying.choices,'应用选择期间面板保持打开且选择/稍后按钮不可操作');
ok(applying.text.includes('正在上传本机进度并复验当前账号'),'应用选择后立即呈现 applying 状态');
ok(!applying.text.includes('双方都没有被改动'),'Promise 活跃时“稍后”不会谎称双方零写入');
ok(applying.closeDisabled&&applying.pushDisabled&&applying.outDisabled,'应用选择期间关闭、手动上传和普通退出全部禁用');

await page.evaluate(()=>window.__authUiRace.resolveChoice({ok:true,action:'uploaded'}));
await page.waitForFunction(()=>document.body.textContent.includes('本机进度已明确上传到云端'));
const settled=await page.evaluate(()=>({
  closeDisabled:document.getElementById('auX').disabled,
  pushDisabled:document.getElementById('auPush').disabled,
  outDisabled:document.getElementById('auOut').disabled
}));
ok(!settled.closeDisabled&&!settled.pushDisabled&&!settled.outDisabled,'选择 Promise 结算后恢复关闭、上传和退出控件');

/* mismatch / unknown / outcome_unknown 三种状态都必须给出不依赖 confirmed 的安全退出清理。 */
for(const cfg of[
  {label:'unknown',session:'unknown',op:'idle',busy:false},
  {label:'mismatch',session:'mismatch',op:'idle',busy:false},
  {label:'outcome_unknown',session:'checking',op:'outcome_unknown',busy:true}
]){
  const visible=await page.evaluate(c=>{
    const s=window.__authUiRace;
    s.signed=false;s.session=c.session;s.op=c.op;s.opBusy=c.busy;
    window.HansenAuthUI._render();
    const b=document.getElementById('auSafeOut');
    return !!b&&b.textContent.includes('安全退出并清理会话')&&!b.disabled;
  },cfg);
  ok(visible,cfg.label+' 状态始终提供可用的安全退出并清理会话');
}
await page.click('#auSafeOut');
await page.waitForFunction(()=>window.__authUiRace.signOutCalls===1);
await page.waitForFunction(()=>document.body.textContent.includes('会话已安全清理，可以重新登录'));
ok(await page.evaluate(()=>window.__authUiRace.signOutCalls===1),'outcome_unknown 即使认证请求标为 busy 也能调用唯一安全清理 signOut');

ok(errs.length===0,'全部真实 DOM 流程零 pageerror'+(errs.length?': '+errs[0]:''));
await browser.close();srv.close();console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);process.exit(fail===0?0:1);
