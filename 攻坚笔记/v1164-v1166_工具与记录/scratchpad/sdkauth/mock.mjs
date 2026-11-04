// Mock CloudBase auth server for page.route
export function b64u(o){return Buffer.from(typeof o==='string'?o:JSON.stringify(o)).toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');}
export function jwt(sub,expSec){const now=Math.floor(Date.now()/1000);return b64u({alg:'RS256',kid:'k1'})+'.'+b64u({iss:'https://mock',sub,aud:'ambitious-d0g1d26xm740dc3d6',exp:now+expSec,iat:now,scope:'user',project_id:'ambitious-d0g1d26xm740dc3d6'})+'.c2ln';}
export function makeMock(opts={}){
  const st={log:[],users:{'+86 13800000001':{sub:'uid_existing_001',password:'secret123'}},
    rt:{}, /* refresh_token -> {sub, used} */ nextUid:100, failUserMe:false, userMeMode:'ok', tokenMode:'ok', expiresIn:7200, ...opts};
  function tokenFor(sub){const rt='rt_'+Math.random().toString(36).slice(2);st.rt[rt]={sub,used:false};
    return {token_type:'Bearer',access_token:jwt(sub,st.expiresIn),refresh_token:rt,expires_in:st.expiresIn,scope:'user',sub};}
  st.tokenFor=tokenFor;
  async function handler(route){
    const req=route.request(); const url=new URL(req.url()); const m=req.method();
    const cors={'access-control-allow-origin':req.headers()['origin']||'*','access-control-allow-credentials':'true','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','content-type':'application/json'};
    if(m==='OPTIONS') return route.fulfill({status:204,headers:cors,body:''});
    let body={}; try{body=JSON.parse(req.postData()||'{}');}catch(e){}
    const auth=req.headers()['authorization']||'';
    const p=url.pathname; st.log.push(m+' '+url.host.split('.')[0].slice(0,8)+'… '+p+(p.includes('token')?' grant='+body.grant_type:'')+(auth?' [auth]':''));
    const J=(status,obj)=>route.fulfill({status,headers:cors,body:JSON.stringify(obj)});
    if(p.endsWith('/auth/v1/verification')){const isUser=!!st.users[body.phone_number];return J(200,{verification_id:'vid_'+Date.now(),is_user:isUser,expires_in:600});}
    if(p.endsWith('/auth/v1/verification/verify')){if(body.verification_code!=='123456')return J(400,{error:'invalid_argument',error_description:'verification code invalid'});return J(200,{verification_token:'vtok_'+Date.now(),expires_in:600});}
    if(p.endsWith('/auth/v1/signup')){const ph=body.phone_number||body.email;if(st.users[ph])return J(400,{error:'already_exists',error_description:'user already exists'});
      if(body.verification_code && body.verification_code!=='123456')return J(400,{error:'invalid_argument',error_description:'verification code invalid'});
      const sub='uid_new_'+(st.nextUid++);st.users[ph]={sub};return J(200,tokenFor(sub));}
    if(p.endsWith('/auth/v1/signin')){const u=st.users[body.username];if(!u)return J(400,{error:'not_found',error_description:'user not found'});
      if(body.password!==undefined && body.password!==u.password)return J(400,{error:'invalid_password',error_description:'password invalid'});return J(200,tokenFor(u.sub));}
    if(p.endsWith('/auth/v1/signin/anonymously')){return J(200,tokenFor('anon_'+(st.nextUid++)));}
    if(p.endsWith('/auth/v1/token')){ if(st.tokenDelay) await new Promise(r=>setTimeout(r,st.tokenDelay));
      if(st.tokenMode==='abort') return route.abort('internetdisconnected');
      const r=st.rt[body.refresh_token];
      if(!r||r.used||st.tokenMode==='invalid_grant')return J(400,{error:'invalid_grant',error_description:'invalid refresh token. for it may be has been refreshed by other'});
      r.used=true;return J(200,tokenFor(r.sub));}
    if(p.endsWith('/auth/v1/user/me')){
      if(st.userMeMode==='abort') return route.abort('internetdisconnected');
      if(st.userMeMode==='500') return J(500,{error:'internal',error_description:'boom'});
      const tok=auth.replace(/^Bearer /,'');let sub='';try{sub=JSON.parse(Buffer.from(tok.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString()).sub;}catch(e){}
      if(!sub)return J(401,{error:'unauthenticated',error_description:'credentials not found'});
      return J(200,{sub,name:'',phone_number:'',username:'',groups:[{id:'user'}],created_from:'phone',providers:[]});}
    if(p.endsWith('/auth/v1/user/signout')||p.endsWith('/auth/v1/revoke'))return J(200,{});
    // database / other
    return J(200,{requestId:'r',data:{}});
  }
  return {st,handler};
}
