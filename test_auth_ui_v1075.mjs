/* test_auth_ui_v1075.mjs —— 手机尺寸真实 DOM 点击注册流程。 */
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
ok(errs.length===0,'真实 DOM 流程零 pageerror'+(errs.length?': '+errs[0]:''));
await browser.close();srv.close();console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);process.exit(fail===0?0:1);
