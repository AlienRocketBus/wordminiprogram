# CloudBase wire spec for vendor_cloudbase_esm_v965.js (@cloudbase/js-sdk 2.30.0, offset 547338)

Legend: [code] = read from SDK source (offsets), [obs] = captured in local Chromium with emulator (wire_log.json),
[inf] = inferred about the real server (cannot reach Tencent from sandbox).

## Hosts (env = ambitious-d0g1d26xm740dc3d6; app calls init({env}) because hansen_cloud_config_v965.js:7 region:'')
- DB:   POST https://ambitious-d0g1d26xm740dc3d6.ap-shanghai.tcb-api.tencentcloudapi.com/web?env=ambitious-d0g1d26xm740dc3d6
  [code 118311 init registers CLOUD_API baseUrl "//<env>.<region||ap-shanghai>.tcb-api.tencentcloudapi.com/web", protocol "https:" 102977]
- Auth: https://ambitious-d0g1d26xm740dc3d6.ap-shanghai.tcb-api.tencentcloudapi.com/auth/v1/...  [code 286322 apiOrigin, 126760 paths, apiPath "/auth"]
- GATEWAY https://<env>.api.tcloudbasegateway.com/v1 is registered (118549) but unused by the app paths [obs: never requested].
- With region:'ap-shanghai' passed explicitly: same hosts + header X-TCB-Region: ap-shanghai on DB calls [obs exp.mjs].

## Auth (oauth2client We.request 146028 -> Le 138182 = window.fetch, body JSON.stringify, NO content-type set)
Headers [obs]: content-type text/plain;charset=UTF-8 (browser default), x-sdk-version @cloudbase/js-sdk/2.30.0,
x-device-id <32hex from localStorage 'device_id'>, x-request-id <32hex>. Unauthenticated calls get ?client_id=<env> appended;
withCredentials calls get `Authorization: Bearer <access_token>` instead. No signing, no cookies.
Response handling (Le 138182): status code IGNORED; body parsed as JSON; if body.error -> reject that object (+error_uri);
also body.code -> reject {error:code,error_description:message} (146028 case 14). Fetch TypeError -> {error:'unreachable'},
retried 2 more times with 1 s gap (defaultRetry=2, retryInterval=1e3 at 159139) [obs: 3 attempts, ~2 s].
No timeout on auth fetch [code Le has no AbortController].

| SDK call (app) | Request | Success body the SDK needs |
|---|---|---|
| getVerification({phone_number}) | POST /auth/v1/verification {phone_number:"+86 138..."} (185492) | {verification_id, expires_in, is_user} |
| verify({verification_id,verification_code}) | POST /auth/v1/verification/verify (186033) | {verification_token, expires_in} |
| signUp({phone_number, verification_code|verification_token}) | POST /auth/v1/signup (183817) | token response (below) |
| signIn({username,password}) / ({username,verification_token}) | POST /auth/v1/signin plaintext body (182890) | token response |
| (auto) refresh | POST /auth/v1/token {client_id:<env>,client_secret:"",grant_type:"refresh_token",refresh_token} (153658) | token response |
| (auto after signIn/signUp) user refresh | GET /auth/v1/user/me + Bearer (192611) | {sub, name, username, email, phone_number, groups, ...}; SDK sets uid = sub |
| signInAnonymously / anonymousAuthProvider().signIn() | POST /auth/v1/signin/anonymously {} | token response with scope "anonymous" |
| signOut() | POST /auth/v1/revoke {token} | {} |

Token response: {token_type:"Bearer", access_token, refresh_token, expires_in, scope, sub, groups}.
MUST contain expires_in, else Me.setCredentials (140420) REMOVES stored credentials and still resolves.
Error body: {error:"invalid_password"|"not_found"|"invalid_grant"|"unauthenticated"|..., error_code:<int>, error_description}
(enum 129636; app evidence of real server: HTTP 400 /auth/v1/token invalid_grant "invalid refresh token. for it may be has been
refreshed by" — hansen_cloud_save_v965.js:300-302, hansen_auth_v1004.js:157-158 => refresh tokens are single-use).

Encryption: getEncryptParams (200518) only encrypts when params.isEncrypt is truthy (dn gate 181255) — only
signInWithPassword({is_encrypt:true}) sets it. App's a.signIn({username,password}) is plaintext [obs].
Then it would call POST /auth/v2/signin/publichkey and send {params:<RSA blob>, public_key_thumbprint} to /auth/v2/signin/username.

## localStorage keys (persistence 'local')
- credentials_<env> : JSON token response + version:"v1" + expires_at ISO (= now + (expires_in-30) s) (143042, 140420)
- user_info_<env>   : {version:"localCachev1", content:{...user/me..., uid}} — getLoginState().user.uid comes from HERE (225717)
- lang_<env>, device_id (unprefixed). getLoginState() (266134 -> 193912 -> _getCredentials 158014) returns null when
  credentials missing, or expired and refresh fails; a refresh 'invalid_grant' deletes credentials_<env> [obs exp.mjs refreshRace].

## Database (xt.request 108758 via XMLHttpRequest class U 91807; database reqClass = subclass of xt, throw=false 546621)
POST /web?env=<env>, headers content-type: application/json;charset=UTF-8, x-sdk-version, x-seqid <hex>, [X-TCB-Region].
Body JSON: {action, dataVersion:"2020-01-10", env, ...params, access_token:<oauth access token>, seqId}  (access_token in BODY,
not header; whitelist Pt 105522 excludes only legacy auth.* actions). No signature.
Response: HTTP status != 200 or empty body -> reject new Error("network request error") (110887) — status/body are lost.
HTTP 200 + {code,message} -> SDK RESOLVES with that object (send() only throws when throw:true, which the DB client lacks)
[obs: DATABASE_PERMISSION_DENIED, DATABASE_COLLECTION_NOT_EXIST, INVALID_ACCESS_TOKEN all resolve].
Not logged in -> rejects plain object {error:"unauthenticated",error_description:"credentials not found"} before any request.
Timeout: XHR aborted after 15 s (timeout:15e3 116647, restrictedMethods post 106489) -> "network request error" [obs 15007 ms].

| SDK | action | request params [obs] | success body |
|---|---|---|---|
| collection(c).add(doc) | database.addDocument | {collectionName, data:<doc, Date->{$date:ms}>} (499726, Ku 495191) | {data:{_id}} (array add: {data:{insertedIds}}) |
| where(q).get() / orderBy / limit / skip / field | database.queryDocument | {collectionName, queryType:"WHERE", query:{status:"open"} or {f:{$gt:0},g:{$in:[..]}}, order:[{field,direction}], limit (default 100, max 1000), offset, projection} (505942) | {data:{list:[plain docs; {$date} -> Date], limit, offset}} |
| doc(id).get() | database.queryDocument | {collectionName, query:{_id}, queryType:"DOC", multi:false} | same |
| where(q).count() | database.countDocument | {collectionName, queryType:"WHERE", query} | {data:{total}} |
| where(q).update(d) | database.updateDocument | {collectionName, query, queryType:"WHERE", multi:true, merge:true, upsert:false, data:{$set:{...}}} (508119, nc 497331) | {data:{updated}} |
| doc(id).update(d) | database.updateDocument | {query:{_id}, queryType:"DOC", multi:false, merge:true, upsert:false, data:{$set}} (501014) | {data:{updated}} |
| doc(id).set(d) | database.updateDocument | {query:{_id}, queryType:"DOC", multi:false, merge:false, upsert:true, data:<raw>} | {data:{updated, upserted_id}} |
| doc(id).remove() / where(q).remove() | database.deleteDocument | {query, queryType, multi} (508937) | {data:{deleted}} |

## Permission enforcement (emulator knob permissionMode)
READONLY = 「读取全部数据，修改本人数据」: everyone reads; add stamps _openid = caller uid; update/remove only own docs.
- 'legacy' (default) [inf, WeChat/CloudBase "simple permission" behaviour widely reported]: server ANDs {_openid:caller}
  into write queries -> HTTP 200 {data:{updated:0}} / {deleted:0}, no error.
- 'rules' [inf, security-rule semantics]: HTTP 200 {code:"DATABASE_PERMISSION_DENIED",message:"Permission denied"}.
Either way the SDK resolves, and hansen_pk_room realTransport.claim() maps both to {updated:0} -> joinRoom returns
"这间房刚被别人占了，换一间吧" [obs poc_app.mjs]. ADMINONLY: reads and writes -> DATABASE_PERMISSION_DENIED.

## Playwright pitfalls [obs]
- context.route() on the Tencent hosts is enough; CORS preflight never reaches the handler (0 OPTIONS seen) and fulfilled
  responses are accepted even WITHOUT Access-Control-Allow-Origin (noCors experiment). So the emulator CANNOT reveal
  CORS / 安全域名 problems — model them explicitly as route.abort() (DB -> "network request error"; auth -> 'unreachable').
- Use serviceWorkers:'block' for real app pages (sw_v944.js) so the SW cannot bypass routing.
- Use context.route (not page.route) so iframes (island pages, spelling_pk inside index.html) and popups are covered.
- Each browser context = separate localStorage = separate account (two players).
