import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { makeMock } from './mock.mjs';
const browser=await chromium.launch(); const ctx=await browser.newContext();
const {st,handler}=makeMock(); await ctx.route(u=>u.hostname!=='127.0.0.1', handler);
const page=await ctx.newPage();
await page.goto('http://127.0.0.1:8765/__s/top.html'); await page.waitForFunction(()=>!!window.HansenAuth);
await page.evaluate(async()=>{await HansenAuth.sendPhoneCode('13800000001');await HansenAuth.loginByPhoneCode('123456');});
console.log(JSON.stringify(await page.evaluate(async()=>{
  localStorage.removeItem('user_info_ambitious-d0g1d26xm740dc3d6');
  const a=HansenAuth._authObj(); const s=await a.getLoginState();
  const app=await HansenAuth._app();
  const noArg=app.auth(); const withArg=app.auth({persistence:'local'}); const noArg2=app.auth();
  const cred=await a.getCredentials();
  return {typeofUserSub:typeof s.user.sub, userSubIsStringProtoSub:s.user.sub===String.prototype.sub,
    noArgReturnsLatest: noArg2===withArg, noArgFirstIsHansenAuth: noArg===a,
    credKeys:Object.keys(cred||{}), credSub:cred&&cred.sub};})));
// getLoginState when NO credentials: does it ever reject? (ensureSession onErr reachability)
console.log(JSON.stringify(await page.evaluate(async()=>{localStorage.removeItem('credentials_ambitious-d0g1d26xm740dc3d6');await HansenAuth._app();
  const a=(await HansenAuth._app()).auth({persistence:'local'});let rejected=false,val;try{val=await a.getLoginState();}catch(e){rejected=true;}
  let r=await HansenAuth.ensureSession(); return {getLoginStateRejected:rejected,val, ensure:r};})));
await browser.close();
