import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { makeMock } from './mock.mjs';
const ENV='ambitious-d0g1d26xm740dc3d6';
const browser=await chromium.launch(); const ctx=await browser.newContext();
const {st,handler}=makeMock({tokenDelay:400});
await ctx.route(u=>u.hostname!=='127.0.0.1', async (route)=>{const r=route.request(); if(r.url().includes('/token')) console.log('  token req from frame:', r.frame().url().split('/').pop(), Date.now()%100000); return handler(route);});
const page=await ctx.newPage(); page.on('pageerror',e=>console.log('  [pageerror]',e.message));
await page.goto('http://127.0.0.1:8765/__s/top.html'); await page.waitForFunction(()=>!!window.HansenAuth);
await page.evaluate(async()=>{await HansenAuth.sendPhoneCode('13800000001');await HansenAuth.loginByPhoneCode('123456');});
await page.evaluate(()=>{document.getElementById('islandFrame').src='/__s/frame_own.html';});
let fr; for(let i=0;i<50&&!fr;i++){fr=page.frames().find(f=>f.url().includes('frame_own.html')); if(!fr) await new Promise(r=>setTimeout(r,100));}
await fr.evaluate(()=>window.__ready);
console.log('same module instance across realms?', await fr.evaluate(async()=>{const m1=await import('/vendor_cloudbase_esm_v965.js');const m2=await window.top.eval("import('/vendor_cloudbase_esm_v965.js')");return m1===m2;}));
await page.evaluate((ENV)=>{const k='credentials_'+ENV;const c=JSON.parse(localStorage.getItem(k));c.expires_at=new Date(Date.now()-1000).toISOString();localStorage.setItem(k,JSON.stringify(c));},ENV);
st.log.splice(0);
// Trigger both in the same tick from the top page using the frame's own auth object
const res=await page.evaluate(async()=>{const fw=document.getElementById('islandFrame').contentWindow;const topAuth=(await HansenAuth._app()).auth();
  const p1=topAuth.getLoginState().then(s=>s&&s.user.uid); const p2=fw.__auth.getLoginState().then(s=>s&&s.user.uid);
  const r=await Promise.all([p1,p2]); return {r,credPresent:!!localStorage.getItem('credentials_ambitious-d0g1d26xm740dc3d6')};});
console.log(JSON.stringify(res)); console.log('  net:',st.log.splice(0));
console.log(JSON.stringify(await page.evaluate(async()=>HansenAuth.ensureSession())));
console.log(JSON.stringify(await page.evaluate(()=>HansenAuth.readLocal())));
await browser.close();
