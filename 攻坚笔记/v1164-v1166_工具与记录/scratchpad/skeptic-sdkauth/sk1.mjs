// Independent skeptic check of SDK 2.30.0 auth claims. Serves repo via page.route (no server).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path';
const REPO='/home/user/wordminiprogram', ENV='ambitious-d0g1d26xm740dc3d6';
const b64u=o=>Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
const jwt=(sub,exp)=>b64u({alg:'RS256'})+'.'+b64u({sub,exp:Math.floor(Date.now()/1000)+exp,scope:'user'})+'.sig';
const S={log:[],users:{'+86 13800000001':{sub:'2081070553417920512',password:'secret123'}},rt:{},expiresIn:7200,tokenMode:'ok',userMe:'ok',includeSub:false};
function tok(sub){const rt='rt_'+Math.random().toString(36).slice(2);S.rt[rt]={sub,used:false};const o={token_type:'Bearer',access_token:jwt(sub,S.expiresIn),refresh_token:rt,expires_in:S.expiresIn,scope:'user'};if(S.includeSub)o.sub=sub;return o;}
const PAGE=`<!doctype html><meta charset=utf-8><script>
window.HANSEN_CLOUD_CONFIG={envId:'${ENV}',region:''};</script>
<script src="/hansen_backup_v944.js"></script><script src="/hansen_auth_v1004.js"></script>
<script>window.__ready=import('/vendor_cloudbase_esm_v965.js').then(m=>{const cb=m.default||m;window.__cb=cb;return 1;});</script>`;
const browser=await chromium.launch(); const ctx=await browser.newContext();
await ctx.route('**/*', async route=>{
  const req=route.request(); const u=new URL(req.url());
  if(u.hostname==='app.local'){
    if(u.pathname==='/p.html') return route.fulfill({status:200,contentType:'text/html',body:PAGE});
    const f=path.join(REPO,u.pathname); if(fs.existsSync(f)) return route.fulfill({status:200,contentType:f.endsWith('.js')?'text/javascript':'text/plain',body:fs.readFileSync(f)});
    return route.fulfill({status:404,body:''});
  }
  const cors={'access-control-allow-origin':'http://app.local','access-control-allow-credentials':'true','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};
  if(req.method()==='OPTIONS') return route.fulfill({status:204,headers:cors,body:''});
  let b={};try{b=JSON.parse(req.postData()||'{}')}catch(e){}
  const p=u.pathname; S.log.push(req.method()+' '+p);
  const J=(s,o)=>route.fulfill({status:s,headers:cors,body:JSON.stringify(o)});
  if(p.endsWith('/auth/v1/verification')) return J(200,{verification_id:'vid1',is_user:!!S.users[b.phone_number],expires_in:600});
  if(p.endsWith('/auth/v1/verification/verify')) return b.verification_code==='123456'?J(200,{verification_token:'vt1',expires_in:600}):J(400,{error:'invalid_argument',error_description:'bad code'});
  if(p.endsWith('/auth/v1/signin')){const x=S.users[b.username]; if(!x) return J(400,{error:'not_found',error_description:'user not found'}); return J(200,tok(x.sub));}
  if(p.endsWith('/auth/v1/signup')){const sub='2081070553400000'+Math.floor(Math.random()*999);S.users[b.phone_number||b.email]={sub};return J(200,tok(sub));}
  if(p.endsWith('/auth/v1/token')){ if(S.tokenMode==='hang') return; if(S.tokenMode==='500') return J(500,{error:'internal',error_description:'boom'}); if(S.tokenMode==='abort') return route.abort('internetdisconnected');
    const r=S.rt[b.refresh_token]; if(!r||r.used||S.tokenMode==='invalid_grant') return J(400,{error:'invalid_grant',error_description:'invalid refresh token'}); r.used=true; return J(200,tok(r.sub));}
  if(p.endsWith('/auth/v1/user/me')){ if(S.userMe==='401') return J(401,{error:'unauthenticated',error_description:'credentials not found'}); if(S.userMe==='500') return J(500,{error:'internal',error_description:'boom'});
    const a=(req.headers()['authorization']||'').split(' ')[1]||''; let sub=''; try{sub=JSON.parse(Buffer.from(a.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'),'base64')).sub}catch(e){}
    return J(200,{sub,phone_number:'+86 13800000001',groups:[{id:'user'}]});}
  return J(200,{});
});
const page=await ctx.newPage(); page.on('pageerror',e=>console.log('[pageerror]',e.message));
const boot=async()=>{await page.goto('http://app.local/p.html');await page.evaluate(()=>window.__ready);};
const keys=()=>page.evaluate(()=>Object.keys(localStorage).sort());
const out=(k,v)=>console.log(k.padEnd(28),JSON.stringify(v));
const probe=()=>page.evaluate(async()=>{const app=window.__cb.init({env:'ambitious-d0g1d26xm740dc3d6'});const a=app.auth({persistence:'local'});let rej=false,st=null;try{st=await a.getLoginState();}catch(e){rej=String(e&&e.error||e);}return {rej,st:st?{keys:Object.keys(st),uid:st.user&&st.user.uid,typeofSub:typeof (st.user&&st.user.sub)}:null};});
await boot();
out('T1 no creds',await probe()); out('T1 net',S.log.splice(0));
// T3 existing user verify+signIn
out('T3 signin', await page.evaluate(async()=>{const a=window.__cb.init({env:'ambitious-d0g1d26xm740dc3d6'}).auth({persistence:'local'});const v=await a.getVerification({phone_number:'+86 13800000001'});const t=await a.verify({verification_id:v.verification_id,verification_code:'123456'});await a.signIn({username:'+86 13800000001',verification_token:t.verification_token});return 1;}));
out('T3 net',S.log.splice(0)); out('T3 keys',await keys());
out('T3 user_info raw',await page.evaluate(()=>localStorage.getItem('user_info_ambitious-d0g1d26xm740dc3d6')));
out('T3 cred has sub?',await page.evaluate(()=>('sub' in JSON.parse(localStorage.getItem('credentials_ambitious-d0g1d26xm740dc3d6')))));
out('T3 probe',await probe());
// T4 remove user_info
await page.evaluate(()=>localStorage.removeItem('user_info_ambitious-d0g1d26xm740dc3d6'));
out('T4 probe no user_info',await probe()); out('T4 net',S.log.splice(0));
out('T4 ensureSession',await page.evaluate(async()=>{localStorage.setItem('hansen_auth_v1004',JSON.stringify({method:'phone',signedAt:Date.now()-120000}));const r=await HansenAuth.ensureSession();return r;}));
out('T4 claims/currentUser',await page.evaluate(async()=>{const a=window.__cb.init({env:'ambitious-d0g1d26xm740dc3d6'}).auth({persistence:'local'});const c=await a.getClaims();const g=a.currentUser;const u=await a.getCurrentUser();return {claimsSub:c.data&&c.data.claims&&c.data.claims.sub,getterUid:g&&g.uid,getCurrentUserUid:u&&u.uid,userInfoBack:!!localStorage.getItem('user_info_ambitious-d0g1d26xm740dc3d6')};}));
out('T4 net',S.log.splice(0));
out('T4 ensureSession after',await page.evaluate(async()=>HansenAuth.ensureSession()));
// T2 expired + refresh 500
await page.evaluate(()=>{const k='credentials_ambitious-d0g1d26xm740dc3d6';const c=JSON.parse(localStorage.getItem(k));c.expires_at=new Date(Date.now()-1000).toISOString();localStorage.setItem(k,JSON.stringify(c));});
await boot(); S.tokenMode='500';
out('T2 refresh500 probe',await probe()); out('T2 net',S.log.splice(0)); out('T2 keys',await keys());
out('T2 currentUser getter',await page.evaluate(()=>{const a=window.__cb.init({env:'ambitious-d0g1d26xm740dc3d6'}).auth({persistence:'local'});const g=a.currentUser;return g&&g.uid;}));
out('T2 ensureSession',await page.evaluate(async()=>HansenAuth.ensureSession()));
// T6 invalid_grant
await boot(); S.tokenMode='invalid_grant';
out('T6 invalid_grant probe',await probe()); out('T6 net',S.log.splice(0)); out('T6 keys',await keys());
out('T6 ensureSession',await page.evaluate(async()=>HansenAuth.ensureSession()));
out('T6 marker after',await page.evaluate(()=>localStorage.getItem('hansen_auth_v1004')));
// T5 email signUp
await page.evaluate(()=>localStorage.clear()); await boot(); S.tokenMode='ok';
out('T5 signUp email',await page.evaluate(async()=>{const a=window.__cb.init({env:'ambitious-d0g1d26xm740dc3d6'}).auth({persistence:'local'});let r;try{r=await a.signUpWithEmailAndPassword('x_1@u.wordadventure.local','secret123');}catch(e){return {rejected:String(e&&(e.message||e.error))};}return {resolved:true,keys:Object.keys(r||{}),dataKeys:Object.keys((r&&r.data)||{}),err:r&&r.error?String(r.error.message||r.error):null,typeofUpdateUsername:typeof a.updateUsername};}));
out('T5 net',S.log.splice(0)); out('T5 keys',await keys());
out('T5 registerByPassword',await page.evaluate(async()=>{try{const r=await HansenAuth.registerByPassword('bobby','secret123','secret123');return {ok:true,r:JSON.stringify(r).slice(0,200),signed:HansenAuth.isSignedIn()};}catch(e){return {err:e.message};}}));
out('T5 net',S.log.splice(0)); out('T5 keys',await keys());
// T7 user/me 401 during getCurrentUser when creds valid
await page.evaluate(()=>localStorage.clear()); await boot(); S.tokenMode='ok';
await page.evaluate(async()=>{const a=window.__cb.init({env:'ambitious-d0g1d26xm740dc3d6'}).auth({persistence:'local'});const v=await a.getVerification({phone_number:'+86 13800000001'});const t=await a.verify({verification_id:v.verification_id,verification_code:'123456'});await a.signIn({username:'+86 13800000001',verification_token:t.verification_token});});
S.log.splice(0); S.userMe='401';
out('T7 getCurrentUser 401',await page.evaluate(async()=>{const a=window.__cb.init({env:'ambitious-d0g1d26xm740dc3d6'}).auth({persistence:'local'});const u=await a.getCurrentUser();return {uid:u&&u.uid,credLeft:!!localStorage.getItem('credentials_ambitious-d0g1d26xm740dc3d6')};}));
out('T7 net',S.log.splice(0)); S.userMe='ok';
// T8 hang refresh: ensureSession pending?
await page.evaluate(async()=>{const a=window.__cb.init({env:'ambitious-d0g1d26xm740dc3d6'}).auth({persistence:'local'});const v=await a.getVerification({phone_number:'+86 13800000001'});const t=await a.verify({verification_id:v.verification_id,verification_code:'123456'});await a.signIn({username:'+86 13800000001',verification_token:t.verification_token});});
await page.evaluate(()=>{const k='credentials_ambitious-d0g1d26xm740dc3d6';const c=JSON.parse(localStorage.getItem(k));c.expires_at=new Date(Date.now()-1000).toISOString();localStorage.setItem(k,JSON.stringify(c));localStorage.setItem('hansen_auth_v1004',JSON.stringify({method:'phone',signedAt:Date.now()-120000}));});
await boot(); S.tokenMode='hang'; S.log.splice(0);
out('T8 hang ensureSession',await page.evaluate(async()=>{const r=await Promise.race([HansenAuth.ensureSession(),new Promise(r=>setTimeout(()=>r('PENDING after 12s'),12000))]);return r;}));
out('T8 net',S.log.splice(0));
await browser.close();
