import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { makeMock } from './mock.mjs';
const ENV='ambitious-d0g1d26xm740dc3d6';
const base='http://127.0.0.1:8765/__s/sdk.html';
const browser=await chromium.launch();
const ctx=await browser.newContext();
const {st,handler}=makeMock();
await ctx.route(u=>u.hostname!=='127.0.0.1', handler);
const page=await ctx.newPage();
page.on('console',m=>{const t=m.text(); if(!/DevTools/.test(t)) console.log('  [console]',m.type(),t.slice(0,200));});
page.on('pageerror',e=>console.log('  [pageerror]',e.message));
async function boot(){await page.goto(base);await page.evaluate(()=>window.__ready);}
const snap=()=>page.evaluate((ENV)=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k).slice(0,140);}return o;},ENV);
const probe=(label)=>page.evaluate(async(label)=>{
  const a=window.__auth; const out={label};
  try{const s=await a.getLoginState(); out.getLoginState= s?{ctor:s.constructor&&s.constructor.name,keys:Object.keys(s),userUid:s.user&&s.user.uid, userKeys:s.user?Object.keys(s.user).filter(k=>s.user[k]!==undefined&&k!=='cache'&&k!=='oauthInstance'):null}:null;}catch(e){out.getLoginState='THROW '+JSON.stringify(e);}
  try{out.currentUserGetter=(a.currentUser&&a.currentUser.uid)||null;}catch(e){out.currentUserGetter='THROW '+e;}
  try{const c=await a.getClaims(); out.claimsSub=c&&c.data&&c.data.claims&&c.data.claims.sub; out.claimsErr=c&&c.error&&String(c.error.message||c.error);}catch(e){out.claimsSub='THROW '+JSON.stringify(e);}
  return out;},label);
const probeCU=(label)=>page.evaluate(async(label)=>{const a=window.__auth;const out={label};
  try{const u=await a.getCurrentUser(); out.getCurrentUserUid=u&&u.uid;}catch(e){out.getCurrentUserUid='THROW '+JSON.stringify(e);}
  try{const s=await a.getLoginState(); out.afterLoginStateUid=s&&s.user&&s.user.uid;}catch(e){}
  return out;},label);
function show(x){console.log(JSON.stringify(x));}

console.log('=== S0 fresh boot (no login)');
await boot(); show(await snap()); show(await probe('fresh')); console.log('  net:',st.log.splice(0));
console.log('  typeof signUpWithEmailAndPassword:', await page.evaluate(()=>typeof window.__auth.signUpWithEmailAndPassword), ' typeof updateUsername:', await page.evaluate(()=>typeof window.__auth.updateUsername));

console.log('=== S1 phone NEW user: getVerification + signUp({phone_number, verification_code})');
const r1=await page.evaluate(async()=>{const a=window.__auth;const v=await a.getVerification({phone_number:'+86 13900000002'});const r=await a.signUp({phone_number:'+86 13900000002',verification_code:'123456'});return {v, rType:r&&r.constructor&&r.constructor.name, rKeys:r&&Object.keys(r), rUserUid:r&&r.user&&r.user.uid};});
show(r1); console.log('  net:',st.log.splice(0)); show(await snap()); show(await probe('after S1'));
console.log('=== S1b reload page');
await boot(); show(await probe('after reload')); console.log('  net:',st.log.splice(0));
console.log('=== S1c remove user_info key, keep credentials');
await page.evaluate((ENV)=>localStorage.removeItem('user_info_'+ENV),ENV);
show(await probe('no user_info')); console.log('  net:',st.log.splice(0));
show(await probeCU('getCurrentUser repopulates?')); console.log('  net:',st.log.splice(0)); show(await snap());

console.log('=== S2 phone EXISTING user: verify + signIn({username, verification_token})');
await page.evaluate(()=>localStorage.clear()); await boot();
const r2=await page.evaluate(async()=>{const a=window.__auth;const v=await a.getVerification({phone_number:'+86 13800000001'});const t=await a.verify({verification_id:v.verification_id,verification_code:'123456'});const r=await a.signIn({username:'+86 13800000001',verification_token:t.verification_token});return {isUser:v.is_user, rType:r&&r.constructor&&r.constructor.name, rUserUid:r&&r.user&&r.user.uid};});
show(r2); console.log('  net:',st.log.splice(0)); show(await probe('after S2'));

console.log('=== S3 password signIn({username,password}) (existing phone user w/ password)');
await page.evaluate(()=>localStorage.clear()); await boot();
const r3=await page.evaluate(async()=>{const a=window.__auth;try{const r=await a.signIn({username:'+86 13800000001',password:'secret123'});return {ok:1,rUserUid:r&&r.user&&r.user.uid};}catch(e){return {err:JSON.stringify(e)};}});
show(r3); console.log('  net:',st.log.splice(0)); show(await probe('after S3'));

console.log('=== S4 registerByPassword path: signUp({email,password}) (no signUpWithEmailAndPassword)');
await page.evaluate(()=>localStorage.clear()); await boot();
const r4=await page.evaluate(async()=>{const a=window.__auth;try{const r=await a.signUp({email:'bob_abc@u.wordadventure.local',password:'secret123'});return {resolved:1,keys:r&&Object.keys(r),dataKeys:r&&r.data&&Object.keys(r.data),error:r&&r.error&&String(r.error.message||r.error)};}catch(e){return {rejected:JSON.stringify(e)};}});
show(r4); console.log('  net:',st.log.splice(0)); show(await snap()); show(await probe('after S4'));

console.log('=== S5 signIn where /user/me fails (abort) -> does signIn reject? are creds stored?');
await page.evaluate(()=>localStorage.clear()); await boot(); st.userMeMode='abort';
const r5=await page.evaluate(async()=>{const a=window.__auth;const v=await a.getVerification({phone_number:'+86 13800000001'});const t=await a.verify({verification_id:v.verification_id,verification_code:'123456'});try{await a.signIn({username:'+86 13800000001',verification_token:t.verification_token});return {resolved:1};}catch(e){return {rejected:JSON.stringify(e).slice(0,200)};}});
show(r5); console.log('  net:',st.log.splice(0)); show(await snap()); show(await probe('after S5 (user/me down)'));
st.userMeMode='ok'; show(await probeCU('S5 getCurrentUser once user/me back')); console.log('  net:',st.log.splice(0));

console.log('=== S6 expired access token: refresh OK');
await page.evaluate(()=>localStorage.clear()); await boot();
await page.evaluate(async()=>{const a=window.__auth;const v=await a.getVerification({phone_number:'+86 13800000001'});const t=await a.verify({verification_id:v.verification_id,verification_code:'123456'});await a.signIn({username:'+86 13800000001',verification_token:t.verification_token});});
st.log.splice(0);
const expire=()=>page.evaluate((ENV)=>{const k='credentials_'+ENV;const c=JSON.parse(localStorage.getItem(k));c.expires_at=new Date(Date.now()-1000).toISOString();localStorage.setItem(k,JSON.stringify(c));},ENV);
await expire(); await boot(); show(await probe('expired+refresh ok')); console.log('  net:',st.log.splice(0));
console.log('=== S7 expired access token: refresh network failure');
await expire(); await boot(); st.tokenMode='abort'; show(await probe('expired+refresh abort')); console.log('  net:',st.log.splice(0)); show(Object.keys(await snap()));
console.log('=== S8 expired access token: refresh invalid_grant');
st.tokenMode='invalid_grant'; await boot(); show(await probe('expired+invalid_grant')); console.log('  net:',st.log.splice(0)); show(Object.keys(await snap()));
st.tokenMode='ok';
await browser.close();
