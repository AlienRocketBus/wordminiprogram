import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { makeMock } from './mock.mjs';
const ENV='ambitious-d0g1d26xm740dc3d6';
const browser=await chromium.launch(); const ctx=await browser.newContext();
const {st,handler}=makeMock({tokenDelay:400}); await ctx.route(u=>u.hostname!=='127.0.0.1', handler);
const page=await ctx.newPage(); page.on('pageerror',e=>console.log('  [pageerror]',e.message));
const show=x=>console.log(JSON.stringify(x));
await page.goto('http://127.0.0.1:8765/__s/top.html'); await page.waitForFunction(()=>!!window.HansenAuth);
await page.evaluate(async()=>{await HansenAuth.sendPhoneCode('13800000001');await HansenAuth.loginByPhoneCode('123456');});
st.log.splice(0);
const expire=()=>page.evaluate((ENV)=>{const k='credentials_'+ENV;const c=JSON.parse(localStorage.getItem(k));c.expires_at=new Date(Date.now()-1000).toISOString();localStorage.setItem(k,JSON.stringify(c));},ENV);
console.log('=== R1 same realm: 5 concurrent instances (as iframe auth() does) after expiry');
await expire();
show(await page.evaluate(async()=>{const app=await HansenAuth._app();
  // force all instances to see the expired creds: new instances read storage
  const insts=[0,1,2,3,4].map(()=>app.auth({persistence:'local'}));
  const rs=await Promise.all(insts.map(a=>a.getLoginState().then(s=>s&&s.user&&s.user.uid).catch(e=>'ERR')));
  return {rs, credPresent:!!localStorage.getItem('credentials_ambitious-d0g1d26xm740dc3d6')};}));
console.log('  net:',st.log.splice(0));
console.log('=== R2 staggered same realm: instance A refreshes, then instance B that cached old creds in memory');
await expire();
show(await page.evaluate(async()=>{const app=await HansenAuth._app();
  const A=app.auth({persistence:'local'}), B=app.auth({persistence:'local'});
  // B loads (expired) creds into memory without refreshing: localCredentials.getCredentials reads storage
  await B.oauthInstance.oauth2client.localCredentials.getCredentials();
  const a=await A.getLoginState(); const b=await B.getLoginState();
  return {a:a&&a.user.uid,b:b&&b.user.uid,credPresent:!!localStorage.getItem('credentials_ambitious-d0g1d26xm740dc3d6')};}));
console.log('  net:',st.log.splice(0));
console.log('=== R3 cross realm: iframe with its OWN SDK module + top, concurrent after expiry');
await expire();
await page.evaluate(()=>{document.getElementById('islandFrame').src='/__s/frame_own.html';});
let fr; for(let i=0;i<50&&!fr;i++){fr=page.frames().find(f=>f.url().includes('frame_own.html')); if(!fr) await new Promise(r=>setTimeout(r,100));}
await fr.evaluate(()=>window.__ready);
const [t,f]=await Promise.all([
  page.evaluate(async()=>{const s=await (await HansenAuth._app()).auth().getLoginState();return s&&s.user.uid;}),
  fr.evaluate(async()=>{const s=await window.__auth.getLoginState();return s&&s.user.uid;})]);
show({top:t,iframeOwnRealm:f,credPresent:await page.evaluate(()=>!!localStorage.getItem('credentials_ambitious-d0g1d26xm740dc3d6'))});
console.log('  net:',st.log.splice(0));
show(await page.evaluate(async()=>HansenAuth.ensureSession()));
await browser.close();
