export const meta = {
  name: 'ladder-forensics',
  description: 'Investigate why the ranked ladder never works on real phones: SDK auth, DB permissions, write ownership, matchmaking logic, emulator spec',
  phases: [
    { title: 'Investigate', detail: '5 parallel investigators over SDK auth, SDK db/permissions, write ownership, ladder logic, emulator spec' },
    { title: 'Verify', detail: 'adversarial skeptic per investigator tries to refute critical claims' },
  ],
}

const SCRATCH = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad'
const CTX = `
PROJECT CONTEXT (read carefully):
- Repo: /home/user/wordminiprogram (also reachable via symlink /home/claude/work/repo — several tests hardcode that path, so RUN TESTS FROM /home/claude/work/repo). Branch main, version v1163. A Chinese kids' English-word H5 game ("单词大冒险").
- Symptom from the only real tester (phone, WeChat webview): tapping 天梯排位 (ranked ladder) shows "连不上网络 / 检查一下 Wi-Fi 或数据再试" although the network is fine; the ladder has never worked on a real phone. Earlier, in this sandbox, the real code path failed with "云端会话尚未就绪（已重试 5 次）" (from ensureSession in hansen_auth_v1004.js) — but the sandbox has no real account, so that may not be the phone's real cause.
- Backend: Tencent CloudBase env "ambitious-d0g1d26xm740dc3d6" (region ap-shanghai). The web SDK is vendored as vendor_cloudbase_esm_v965.js — it is really @cloudbase/js-sdk 2.30.0 (new oauth-style auth), a ~557KB single-line minified ESM file importing sibling vendor_*.js files. To read it, use python to find/slice by character offsets and cite offsets. Known offsets: Auth.getLoginState ~266134; LoginState class Gn ~228903; User class Vn ~222201; Auth.createLoginState ~274219; Hn.signInWithPassword ~233725; Hn.signIn ~265030.
- THIS SANDBOX CANNOT REACH TENCENT CLOUD (HTTPS proxy returns 403 for *.tcloudbase.com, *.tencentcloudapi.com, etc.). Do not pretend you observed real server behavior. Clearly separate: (a) verified from code, (b) empirically observed in a local browser run, (c) inferred about server behavior from docs/knowledge.
- DB collection permissions, per the user's console screenshots: hansen_pk_rooms = 「读取全部数据，修改本人数据」 (all users read, only the creator writes); hansen_saves = same; sb_profile exists (permission unknown); counters = ADMINONLY; hansen_friends was being created; hansen_friend_msgs might not exist.
- Playwright + Chromium are preinstalled. The repo loader playwright_loader.mjs needs env HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs . In your own scripts import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'.
- Key app files: hansen_auth_v1004.js (login, ensureSession ~L1003, _app/app() ~L135, auth() ~L219), hansen_pk_room_v1065.js (room data layer, realTransport ~L149, E() ~L46, joinRoom ~L823, claimRound ~L1131), hansen_pk_room_ui_v1065.js (room UI, _joinForLadder/_createForLadder), hansen_ladder_ui_v1108.js (ladder UI, startMatching ~L587, showOffline ~L828), hansen_ladder_board_v1156.js, hansen_pk_record_v1103.js, hansen_sb_profile_v1002.js, hansen_sb_pk_v1022.js, hansen_friends_v1106.js, hansen_cloud_save_v965.js, hansen_cloud_config_v965.js, spelling_pk.html, template.html (island pages are generated from it and run inside iframe#islandFrame of index.html).
- THIS IS A READ-ONLY INVESTIGATION PHASE: do NOT edit, create or delete any file inside the repo. Put any scratch scripts/notes under ${SCRATCH}/<your-topic>/ . If a test you run leaves files changed in the repo, report them; do not revert them yourself.
- Your final output is data for an orchestrator, not a message to a human. Be precise; cite file:line or SDK offsets as evidence.
`

const FINDINGS = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'A dense paragraph: the most important conclusions' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'short unique id like A1, A2' },
          claim: { type: 'string' },
          evidence: { type: 'string', description: 'file:line / SDK offset / experiment output' },
          kind: { type: 'string', enum: ['verified-code', 'empirical', 'inferred-server'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'info'] },
          implication: { type: 'string', description: 'what this means for making the ladder work; suggested fix if any' },
        },
        required: ['id', 'claim', 'evidence', 'kind', 'confidence', 'severity', 'implication'],
      },
    },
    critical_claim_ids: { type: 'array', items: { type: 'string' }, description: 'ids of the claims the fix will depend on most' },
    open_questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'findings', 'critical_claim_ids', 'open_questions'],
}

const VERDICTS = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          verdict: { type: 'string', enum: ['confirmed', 'refuted', 'uncertain'] },
          reason: { type: 'string', description: 'concrete evidence you checked yourself' },
          correction: { type: 'string', description: 'if refuted/partially wrong: the corrected claim' },
        },
        required: ['id', 'verdict', 'reason'],
      },
    },
    missed: { type: 'array', items: { type: 'string' }, description: 'important things the investigator missed' },
  },
  required: ['verdicts', 'missed'],
}

const INVESTIGATIONS = [
  {
    key: 'sdk-auth',
    prompt: `TOPIC: CloudBase SDK 2.30.0 login state & uid — can ensureSession() report "尚未就绪" for a genuinely logged-in user?
1) Trace Auth.getLoginState() → this.oauthInstance.authApi.getLoginState(): when does it resolve null vs truthy; does it refresh tokens; what can throw.
2) LoginState Gn and User Vn: User's constructor calls setUserInfo() which copies fields (uid, ...) from cache store key "user_info_<env>". Determine the ACTUAL localStorage key(s) CloudbaseCache uses with persistence 'local' (any prefix?), and whether hansen_auth's app().auth({persistence:'local'}) cache is the same store that login writes to.
3) For EACH login path the app uses (read hansen_auth_v1004.js fully: sendPhoneCode → a.getVerification; loginByPhoneCode → new users a.signUp({phone_number, verification_code}) with fallback a.verify + a.signUp({phone_number, verification_token}); existing users a.verify + a.signIn({username, verification_token}); loginByPassword → a.signIn({username,password}) w/ fallback mail; registerByPassword — read it), determine from SDK code whether user_info_<env> gets populated (e.g., createLoginState → user.refresh → getUserInfo → setLocalUserInfo) or NOT. Pay special attention to Hn.signUp and Hn.verify.
4) Find any path that clears user_info while credentials remain valid (e.g., refresh() with INVALID_ACCESS_TOKEN → setLocalUserInfo({})), and behavior across page reloads and inside iframes (island pages run in iframe#islandFrame and borrow window.top.HansenAuth._app()).
5) Determine the most robust way for app code to get the current uid when a valid session exists (e.g. getLoginState() then await st.user.checkLocalInfoAsync()/refresh(); auth.getCurrentUser(); auth.getUserInfo(); decoding the access token's sub claim via the credentials stored in localStorage; auth.currentUser) — with exact code evidence, and what each does when user_info cache is empty.
6) STRONGLY PREFERRED: confirm empirically. Serve the repo dir with a tiny local http server (correct MIME types: .js → text/javascript), load a page that imports ./vendor_cloudbase_esm_v965.js, init({env:'ambitious-d0g1d26xm740dc3d6', region:'ap-shanghai'}), auth({persistence:'local'}), and use page.route to intercept the SDK's network calls and return plausible auth responses (find the exact endpoints and response shapes in the SDK: signin, signup, verification, token, user/me). Then check what getLoginState() returns and whether .user.uid is set after each login path, after reload, and when the user_info key is removed but credentials remain.
Conclude: precisely under which conditions ensureSession() returns notReady while logged in, and a robust replacement for its uid check.`,
  },
  {
    key: 'sdk-db-perms',
    prompt: `TOPIC: CloudBase SDK 2.30.0 database requests, error surfacing, and server permission behavior.
1) From the SDK source, determine how these calls become HTTP requests and what the SDK does with responses: collection(c).add(doc); .where(cond).update(patch) (used for the atomic room claim — see claim() in hansen_pk_room_v1065.js ~L318); .doc(id).update/remove/get; .where().orderBy().limit().get(); .count(). Endpoint URL/host pattern, method, body (action names such as database.addDocument / updateDocument / queryDocument / deleteDocument), how the access token is attached, response shape, how the "updated" count is returned for where().update().
2) CRITICAL: how errors surface — does the SDK reject the promise, or RESOLVE with an object containing code/message (some CloudBase versions resolve {code:'DATABASE_PERMISSION_DENIED', message} instead of throwing)? Check for each op the app uses. If it resolves with {code}, trace what the app code (hansen_pk_room_v1065.js realTransport, hansen_ladder_board_v1156.js, hansen_sb_profile_v1002.js, hansen_auth ensureProfile, hansen_friends_v1106.js) would do with such a value (e.g. r.updated undefined → 0 → "这间房刚被别人占了"; r.data undefined → [] → treated as "no rooms").
3) List the SDK's error code constants related to permission / collection-not-exist / index / auth (search strings like PERMISSION, COLLECTION_NOT_EXIST, INVALID_ACCESS_TOKEN, unauthenticated).
4) Server behavior (inferred; say so): under 「读取全部数据，修改本人数据」 (= 所有用户可读，仅创建者可写 / READONLY), what happens when user B runs where({_id: roomOfA, status:'open', guestId:''}).update({...}) on a doc created by user A — error vs {updated:0}; and B running doc(roomOfA).update(...) / .remove(). Is _openid auto-stamped on add for web-SDK users, and is it what the permission compares? What custom security rule would allow any logged-in user to claim/update/delete rooms (e.g. {"read": true, "write": "auth != null"}), and does security-rule mode impose the "query condition must be a subset of the rule" constraint that could break the app's where()/orderBy queries? Try WebSearch/WebFetch for docs.cloudbase.net / cloud.tencent.com docs (Tencent domains may be blocked from this sandbox — if so, say so and rely on knowledge, marking confidence).
Return findings with evidence and confidence.`,
  },
  {
    key: 'write-ownership',
    prompt: `TOPIC: Ownership audit of every cloud read/write in the 天梯排位 (ladder) flow and the 公开房间 (room) flow.
Enumerate EVERY cloud database operation along these flows: hansen_ladder_ui_v1108.js (open/startMatching/refreshEntry/renderBoard), hansen_pk_room_v1065.js (createRoom, findByCode, sweepMyDeadRooms, listRooms, joinRoom→claim, startHeartbeat, opponentGone, claimAbandonWin, leaveRoom, claimRound, roundState, any submit/finish/settle functions), hansen_pk_room_ui_v1065.js (_joinForLadder, _createForLadder, waiting/battle/settle screens), hansen_pk_record_v1103.js, hansen_ladder_board_v1156.js (fetchTop, myRoughRank), hansen_sb_profile_v1002.js (readProfile, ensureCid, any writes), hansen_auth_v1004.js (ensureProfile, assignCid, syncOnLogin), hansen_friends_v1106.js.
For each op: function, file:line, collection, op type (add / where-update / doc-update / doc-remove / get / count), who triggers it (host / guest / self), and whose document it touches (own vs other player's). Given hansen_pk_rooms permission = all-read / creator-only-write, list exactly which steps would FAIL when performed by the guest (or by the host on a doc the guest created), and trace the failure value through the code to the exact text the user would see on screen (and whether it would loop, dead-end, or silently misbehave, e.g. the host waiting forever).
Also: sb_profile — what _id does ensureProfile/assignCid create, who writes ratings/names, what count/where queries run, what permission each needs; hansen_friends / hansen_friend_msgs similarly.
Finish with a narrative: "what happens, step by step, when two real logged-in phones try to play one ladder match under the current permissions", assuming the session check passes.`,
  },
  {
    key: 'ladder-logic',
    prompt: `TOPIC: Logic/state-machine audit of ladder matchmaking and match lifecycle (independent of DB permissions).
Trace from both entry points: spelling_pk.html #pkLadder click handler (requireIdentity / askName) and hansen_sb_pk_v1022.js kLadder (island 拼写大PK screen) → HansenLadderUI.open() → startMatching() → S().listRooms() → HansenPkRoomUI._joinForLadder / _createForLadder → waiting for opponent → battle → claimRound → settle → HansenPkRecord rating update → leaderboard.
Look for bugs that would stop two real players from getting matched and finishing, e.g.: both players wait 20s then each creates their own room and never see each other (does a host waiting in its own ladder room keep scanning/merging with other ladder rooms? tie-break?); listOpen filters (isPrivate/status/heartbeat/guestId/hostId, 40-row limit, createdAt orderBy fallback) that might hide ladder rooms; mode/hostRating mapping (r.mode !== 'A'); rating band filters that exclude each other (new players' default rating, placement games); eventual-consistency windows (just-created rooms invisible ~1-2s); _joinForLadder failure handling (taken → back to matching or dead end?); timers/cancel leaks; what the user sees in each failure.
Also explain the field report "点天梯 → 连不上网络；点了也不直接进匹配界面": in v1163 which code paths end at showOffline() (4× listRooms {ok:false} with a reason NOT matching /登录|会话|session|unauthenticated|credential|未加载/i, or 4× exceptions) vs showNeedLogin, and enumerate every concrete reason string that could reach showOffline (e.g. permission denied, collection not exists, timeouts '网络太慢', HBErrText outputs...). Check whether "云端会话尚未就绪" would go to showNeedLogin ("排位要先登录") instead — and what the first screen after tapping 天梯 is (does it show the board first? does board loading fail and show 连不上网络?). Look at renderBoard/fetchTop too.
Use the existing tests (test_ladder_e2e_v1155.mjs, test_ladder_v1108.mjs, test_ladder_board_v1156.mjs) to understand the harness; you may run them from /home/claude/work/repo with HANSEN_PLAYWRIGHT_MODULE set, but do not modify repo files. Output findings with file:line, severity and a concrete failure scenario for each.`,
  },
  {
    key: 'emulator-spec',
    prompt: `TOPIC: Specification + proof-of-concept for a high-fidelity CloudBase emulator, so we can test the REAL vendored SDK end-to-end without network.
Goal: a future end-to-end test runs the real app pages + real vendor_cloudbase_esm_v965.js in Playwright Chromium, with ALL requests to Tencent hosts intercepted by page.route() (or context.route) and answered by a local emulator that mimics the CloudBase HTTP API: auth (verification code send/verify, signup, signin with username+password, signin with verification_token, token refresh, user info/me, anonymous if used) and database (add, query with where/orderBy/limit/skip, count, update by where (multi) and by doc id, remove), INCLUDING server-side permission enforcement (READONLY: everyone reads, only creator — tracked via _openid — writes; denied writes must behave like the real server: decide error vs updated:0 and document your basis) and knobs for latency and eventual consistency.
1) Reverse-engineer from the SDK source the exact request hosts/URLs (for env ambitious-d0g1d26xm740dc3d6, region ap-shanghai), methods, headers, body encodings, and the response JSON shapes the SDK expects for each operation above, including error responses. Cite offsets.
2) Build a minimal PoC under ${SCRATCH}/emulator-poc/ (NOT in the repo): a node script that starts a static server for the repo dir (correct MIME types), launches chromium, routes Tencent requests to an in-script emulator, loads a tiny page that imports ./vendor_cloudbase_esm_v965.js, inits the SDK exactly like hansen_auth_v1004.js app() does (init({env, region}) then app.auth({persistence:'local'})), then: signIn({username, password}) → getLoginState() non-null and .user.uid set → app.database().collection('hansen_pk_rooms').add(doc) → where({status:'open'}).get() returns it → a SECOND browser context logged in as another user does where({_id, status:'open', guestId:''}).update({...}) and gets the permission-enforced result.
3) Report: the spec, PoC file paths, exact commands to run it, what worked and what did not, and pitfalls (CORS preflight, request signing, credentials storage keys, any crypto/encryption of request params such as getEncryptParams for signin).`,
  },
]

const verifyPrompt = (inv, res) => `${CTX}
You are an adversarial SKEPTIC. Another investigator studied topic "${inv.key}" and produced the findings below. Your job is to try to REFUTE the critical claims (ids: ${JSON.stringify(res.critical_claim_ids)}), plus any blocker/major claim. Independently re-check the evidence yourself (open the files, slice the SDK at the cited offsets, re-run experiments if cheap). Default to "uncertain" if you cannot verify; use "refuted" only with concrete counter-evidence, and give the corrected claim. Also list important things the investigator missed.

INVESTIGATOR TASK:
${inv.prompt}

INVESTIGATOR RESULT (JSON):
${JSON.stringify(res, null, 1)}
`

phase('Investigate')
const results = await pipeline(
  INVESTIGATIONS,
  inv => agent(`${CTX}\n${inv.prompt}`, { label: `investigate:${inv.key}`, phase: 'Investigate', schema: FINDINGS }),
  (res, inv) => {
    if (!res) return null
    if (inv.key === 'emulator-spec') return { key: inv.key, res, verify: null }
    return agent(verifyPrompt(inv, res), { label: `verify:${inv.key}`, phase: 'Verify', schema: VERDICTS })
      .then(v => ({ key: inv.key, res, verify: v }))
  },
)
return results.filter(Boolean)
