import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { makeMock } from './mock.mjs';
const ENV='ambitious-d0g1d26xm740dc3d6';
const browser=await chromium.launch();
const ctx=await browser.newContext();
const {st,handler}=makeMock();
await ctx.route(u=>u.hostname!=='127.0.0.1', handler);
const page=await ctx.newPage();
page.on('pageerror',e=>console.log('  [pageerror]',e.message));
const show=x=>console.log(JSON.stringify(x));
const boot=async()=>{await page.goto('http://127.0.0.1:8765/__s/top.html');await page.waitForFunction(()=>!!window.HansenAuth);};
const keys=()=>page.evaluate(()=>{const o=[];for(let i=0;i<localStorage.length;i++)o.push(localStorage.key(i));return o.sort();});
const ens=(label)=>page.evaluate(async(label)=>{const t0=Date.now();const r=await HansenAuth.ensureSession();return {label,ms:Date.now()-t0,r,local:HansenAuth.readLocal()};},label);

await boot();
console.log('=== H1 phone NEW user via HansenAuth (top frame)');
show(await page.evaluate(async()=>{const a=await HansenAuth.sendPhoneCode('13900000003');let b;try{b=await HansenAuth.loginByPhoneCode('123456');}catch(e){b={err:e.message};}return {a,b};}));
console.log('  net:',st.log.splice(0)); show(await keys());
show(await ens('H1 ensureSession'));
console.log('  net:',st.log.splice(0));

console.log('=== H2 remove user_info_<env>, credentials kept → ensureSession');
await page.evaluate((ENV)=>localStorage.removeItem('user_info_'+ENV),ENV);
show(await ens('H2 ensureSession (no user_info)'));
console.log('  net:',st.log.splice(0));
console.log(await page.evaluate(()=>HansenAuth._trace()));
show(await page.evaluate(async()=>{const u=await HansenAuth.currentUserAsync();return {currentUserAsyncUid:u&&u.uid};}));
console.log('  net:',st.log.splice(0));
show(await ens('H2b ensureSession after currentUserAsync (getCurrentUser refresh)'));

console.log('=== H3 ensureSession inside iframe (borrowing top _app)');
await page.evaluate(()=>{document.getElementById('islandFrame').src='/__s/frame.html';});
const fr=await (async()=>{for(let i=0;i<50;i++){const f=page.frames().find(f=>f.url().includes('frame.html'));if(f){try{await f.waitForFunction(()=>!!window.HansenAuth,null,{timeout:3000});return f;}catch(e){}}await new Promise(r=>setTimeout(r,100));}})();
const cnt=await page.evaluate(()=>{const app=window.__dummy;return 0;});
show(await fr.evaluate(async()=>{
  const topApp=await window.top.HansenAuth._app();
  const before=topApp.authInstance;
  const r1=await HansenAuth.ensureSession();
  const mid=topApp.authInstance;
  const r2=await HansenAuth.ensureSession();
  const after=topApp.authInstance;
  const topAuth=window.top.HansenAuth._authObj();
  return {r1,r2, newInstancePerCall: before!==mid && mid!==after, topAuthIsAppAuthInstance: topAuth===after,
          sameRealmApp: topApp===await HansenAuth._app()};}));
console.log('  net:',st.log.splice(0));

console.log('=== H4 registerByPassword via HansenAuth (fresh storage)');
await page.evaluate(()=>localStorage.clear()); await boot();
show(await page.evaluate(async()=>{try{return await HansenAuth.registerByPassword('bobby','secret123','secret123');}catch(e){return {err:e.message};}}));
console.log('  net:',st.log.splice(0)); show(await keys());
show(await ens('H4 ensureSession after registerByPassword'));
console.log('  net:',st.log.splice(0));

console.log('=== H5 backup ownership of SDK keys + restore effect');
await page.evaluate(()=>localStorage.clear()); await boot();
const preCode=await page.evaluate(()=>{localStorage.setItem('wordIsland_test',JSON.stringify({learned:[1,2,3]}));return HansenBackup.exportCode();});
show(await page.evaluate(async()=>{const a=await HansenAuth.sendPhoneCode('13800000001');const b=await HansenAuth.loginByPhoneCode('123456');return {uid:b.uid};}));
show(await page.evaluate((ENV)=>({ownedUserInfo:HansenBackup.isOwnedKey('user_info_'+ENV),ownedDeviceId:HansenBackup.isOwnedKey('device_id'),ownedCred:HansenBackup.isOwnedKey('credentials_'+ENV),ownedLang:HansenBackup.isOwnedKey('lang_'+ENV)}),ENV));
const postCode=await page.evaluate(()=>HansenBackup.exportCode());
show(await page.evaluate((c)=>{const p=HansenBackup.parse(c);return {itemsKeys:(p.items||[]).map(x=>x.key)};},postCode));
show(await keys());
console.log('  restore a backup made BEFORE login (no user_info in it):');
show(await page.evaluate((c)=>{try{const r=HansenBackup.restore(HansenBackup.parse(c));return {restored:r.items};}catch(e){return {err:e.message};}},preCode));
show(await keys());
show(await ens('H5 ensureSession after restoring pre-login backup'));
console.log('  restore a backup containing ANOTHER account user_info:');
const foreign=await page.evaluate((ENV)=>{localStorage.setItem('user_info_'+ENV,JSON.stringify({version:'localCachev1',content:{sub:'uid_OTHER_999',uid:'uid_OTHER_999'}}));const c=HansenBackup.exportCode();return c;},ENV);
await page.evaluate((ENV)=>localStorage.removeItem('user_info_'+ENV),ENV);
await page.evaluate(async()=>{await HansenAuth.currentUserAsync();});
show(await ens('before foreign restore'));
await page.evaluate((c)=>HansenBackup.restore(HansenBackup.parse(c)),foreign);
show(await ens('after foreign restore'));
show(await page.evaluate(async()=>{const a=await HansenAuth._app();const au=a.auth();const c=await au.getClaims();return {tokenSub:c.data.claims&&c.data.claims.sub};}));
await browser.close();
