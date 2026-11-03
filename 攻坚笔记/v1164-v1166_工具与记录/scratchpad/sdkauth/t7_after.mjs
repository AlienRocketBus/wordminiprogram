import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { makeMock } from './mock.mjs';
const browser=await chromium.launch(); const ctx=await browser.newContext();
const {st,handler}=makeMock({tokenDelay:400,expiresIn:31});
await ctx.route(u=>u.hostname!=='127.0.0.1', handler);
const page=await ctx.newPage();
const boot=async()=>{await page.goto('http://127.0.0.1:8765/__s/top.html'); await page.waitForFunction(()=>!!window.HansenAuth);};
await boot();
await page.evaluate(async()=>{await HansenAuth.sendPhoneCode('13800000001');await HansenAuth.loginByPhoneCode('123456');});
console.log('=== Q1 same realm, 6 instances created like iframe auth() (one per call), real expiry, concurrent');
await new Promise(r=>setTimeout(r,1500)); st.log.splice(0);
console.log(JSON.stringify(await page.evaluate(async()=>{const app=await HansenAuth._app();const xs=[0,1,2,3,4,5].map(()=>app.auth({persistence:'local'}));xs.push(HansenAuth._authObj());
  const r=await Promise.all(xs.map(a=>a.getLoginState().then(s=>s&&s.user.uid)));return {r,credPresent:!!localStorage.getItem('credentials_ambitious-d0g1d26xm740dc3d6')};})));
console.log('  net:',st.log.splice(0));
console.log('=== Q2 same realm, staggered: refresh by inst A completes, then inst B (old creds in memory) refreshes');
await new Promise(r=>setTimeout(r,1500)); st.log.splice(0);
console.log(JSON.stringify(await page.evaluate(async()=>{const app=await HansenAuth._app();const A=HansenAuth._authObj();const B=app.auth({persistence:'local'});
  await B.oauthInstance.oauth2client.localCredentials.getCredentials(); /* B caches soon-expired creds */
  const a=await A.getLoginState(); const b=await B.getLoginState();return {a:a&&a.user.uid,b:b&&b.user.uid,credPresent:!!localStorage.getItem('credentials_ambitious-d0g1d26xm740dc3d6')};})));
console.log('  net:',st.log.splice(0));
console.log('=== Q3 after cross-realm invalid_grant wiped storage: reload, ensureSession');
await page.evaluate(()=>localStorage.removeItem('credentials_ambitious-d0g1d26xm740dc3d6'));  /* = state left by t6 */
await boot();
console.log(JSON.stringify(await page.evaluate(async()=>({isSignedIn:HansenAuth.isSignedIn(),r:await HansenAuth.ensureSession()}))));
await browser.close();
