export const meta = {
  name: 'ladder-fix-implement',
  description: 'Implement the v1164 ladder/room fix: data layer, auth, friends/board, UI, real-SDK emulator tests, then integrate',
  phases: [
    { title: 'Implement', detail: 'data layer → UI chain, plus auth, friends/board/profile and emulator tests in parallel' },
    { title: 'Integrate', detail: 'one agent runs everything together, fixes cross-module issues, adds guards' },
  ],
}

const SCR = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad'
const COMMON = `
You are implementing part of the v1164 fix for the ranked ladder (天梯排位) and room battles (房间对战) of the H5 kids' game in /home/user/wordminiprogram (version v1163). The ladder has never worked on a real phone.
READ FIRST, COMPLETELY: ${SCR}/SPEC_v1164.md (the design you must follow). Evidence and SDK offsets: ${SCR}/verdicts.txt. Working CloudBase emulator PoC (real vendored SDK 2.30.0 + real app pages, network answered locally, permission modes): ${SCR}/emulator-poc/ (SPEC.md wire spec, emulator.mjs, harness.mjs, poc.mjs, poc_app.mjs). Earlier forensic scripts: ${SCR}/sdkauth/, ${SCR}/ladder-logic/, ${SCR}/skeptic-*/.
Environment: run node tests from /home/claude/work/repo (symlink to the repo; several tests hardcode that path) with env HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs . Single test: \`cd /home/claude/work/repo && HANSEN_PLAYWRIGHT_MODULE=... timeout 600 node test_x.mjs\`. Guards: \`python3 hansen_guards_v1068.py\` (must end green). No network to Tencent exists here; never add network downloads to tests.
HARD RULES:
- Edit ONLY the files you own (listed below). Other agents are editing other files in the same checkout at the same time. If you need a change in a file you do not own, do not make it — describe it precisely under notes_for_integrator.
- Shared files hansen_guards_v1068.py and jarvis_selftest.py: only make a minimal Edit (never rewrite the file) when an EXISTING guard encodes the old broken protocol and blocks your correct change; update that guard's self-test sample consistently. Do not add new guards — list wanted guards in your report.
- Do NOT modify vendor_*.js, VERSION, version stamps (?v=1163), hansen_audio_lock.json, hansen_bug_registry.py, CHANGELOG.md or the handoff docs. Do NOT run generate.py, bump_version.py, package_release.py or jarvis_gate.py. Do NOT git commit, push, stash, checkout or reset (read-only git commands like diff/status are fine).
- Never weaken, skip or delete a test to make it pass. When an existing test encodes the old broken protocol (e.g. a fake transport that lets two adds of the same _id both succeed, or asserts guest writes to the host doc), update the fake/assertion to match the REAL database behaviour and keep the test's intent; explain each such change in your report.
- Code comments: Chinese, short, say why. User-facing text: plain Chinese for kids/teachers: what happened and what to do.
- Before finishing: run every test you own plus test_real_path_smoke_v1163.mjs and the guards, and report exact results. Your final output is data for the integrator.
`

const REPORT = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files_changed: { type: 'array', items: { type: 'string' } },
    implemented: { type: 'array', items: { type: 'string' }, description: 'each spec item you implemented, with file:function' },
    api_contract: { type: 'string', description: 'exact public API / return shapes / events / error kinds other modules must rely on (empty if N/A)' },
    tests: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' } }, required: ['name', 'result'] } },
    guards: { type: 'string', description: 'result of python3 hansen_guards_v1068.py and any guard edits made' },
    test_changes: { type: 'array', items: { type: 'string' }, description: 'every edit to an existing test and why' },
    open_issues: { type: 'array', items: { type: 'string' } },
    notes_for_integrator: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'files_changed', 'implemented', 'api_contract', 'tests', 'guards', 'test_changes', 'open_issues', 'notes_for_integrator'],
}

const U1 = `${COMMON}
YOUR PART: the room/ladder DATA LAYER — SPEC §2 and §3, completely.
You own: hansen_pk_room_v1065.js; tests test_pk_room_v1065.mjs, test_pk_room_code_v1105.mjs, test_room_match_v1135.mjs, test_pk_abandon_v1104.mjs, test_pk_modes_v1100.mjs, test_pk_ask_mode_v1102.mjs, test_pk_record_v1103.mjs (only where they test the data layer).
Key requirements (see spec for details): every player writes only own docs; seat claim and round decisions via add with deterministic _id + read-back verification; host ACK handshake; seat epochs; monotonic merged room view with legacy field names; skew-proof opponentGone; role-aware leave/unload; deferred removal so the guest can read the result; sweep only own leftovers; realTransport checks r.code everywhere; E()/kind classification (network/slow/session/expired/config/gone/taken/self/other) with 人话 ⟨原话⟩; identity key 'u'+uid (no phone/username in docs); real display name; proto:2 filter; waitForOpponent opts.ladder rescan + oldest-wins tie-break emitting {switchTo}; listRooms sameAccount count.
STRONGLY RECOMMENDED: validate with the REAL SDK against the emulator in ${SCR}/emulator-poc/ (copy poc_app.mjs into ${SCR}/u1/ and extend it): two browser contexts (two accounts) under permission READONLY in BOTH 'legacy' (updated:0) and 'rules' (DATABASE_PERMISSION_DENIED) modes, with latency + eventual-consistency lag on: create → list → join (ACK) → markReady → several claimRound/skipRound races → reportResult → both see the same result; 3 guests racing for one seat → exactly one wins; guest leaves while waiting → next guest can join (epoch bump); host leaves mid-match → guest can still read final data. Put the exact commands and results in your report.
In api_contract, document precisely every exported function's arguments, return shape, events (waitForOpponent: joined/gone/timeout/error/switchTo), error kinds, and any new exports, because the UI agent will build on it next.`

const U3 = (r1) => `${COMMON}
YOUR PART: the UI layer — SPEC §6, completely. The data layer was just rewritten by another agent; its report (including api_contract) is below — build on it, and read hansen_pk_room_v1065.js yourself to confirm.
You own: hansen_ladder_ui_v1108.js, hansen_pk_room_ui_v1065.js, hansen_pk_watchdog_v1155.js, hansen_sb_pk_v1022.js, spelling_pk.html; tests test_ladder_e2e_v1155.mjs, test_ladder_v1108.mjs, test_ladder_contrast_v1156.mjs, test_pk_watchdog_v1155.mjs, test_pk_inpage_v1022.mjs, test_pk_battle_ui_v1101.mjs, test_pk_keyboard_v1118.mjs, test_tap_targets_v1120.mjs, test_real_path_smoke_v1163.mjs. (hansen_friends_ui_v1107.js belongs to another agent; its overlay z-index will also be set to 2147483500 — use the same value for the ladder.)
Must cover (spec §6): z-index above the 拼写大PK screen for every ladder entry/re-entry path; kLadder sign-in gate; routing by error kind (network/slow → 连不上网络 after 4 with 技术信息; session → 正在连接云端… silent retries then 云端还没连上 + retry; expired → login; config → 云端设置还差一步 with 技术信息; self → same-account hint); matching loop with independent 1 s counter, resets, oldest-first join attempts with automatic fall-through, self-host after 20 s using waitForOpponent opts.ladder and handling {switchTo}; wait timeout → leaveRoom + correct message (ladder home / lobby; sayHuman must understand it); doJoin shows the real reason; ladder state resets (_fromLadder, askMode 'cn' for ladder, _ladderRating, _pickedMode); _createForLadder failure returns to the ladder; settlement robustness (guest result recorded when host finishes first, reportResult retries, pollResult st bug, per-game counters); watchdog: close()/closePeers must not arm, rescue quit() must not re-arm; oppName/oppRating from the merged room and used for ELO.
Verify in a real browser: island page (e.g. island_animal.html inside index.html's iframe if practical, or the page directly) → 拼写大PK → 天梯排位 → ladder visible and 开始排位 hittable by touchscreen.tap; spelling_pk.html path; and two-player flows against the emulator (${SCR}/emulator-poc/ or the repo helper _cloudbase_emulator.mjs if it already exists) — two players starting simultaneously must get matched; a full ranked game must settle on both sides with rating changes.

DATA LAYER AGENT REPORT:
${JSON.stringify(r1, null, 1)}`

const U2 = `${COMMON}
YOUR PART: auth / session / backup — SPEC §4, completely.
You own: hansen_auth_v1004.js, hansen_auth_ui_v1004.js, hansen_signup_gate_v1030.js, hansen_backup_v944.js, hansen_backup_bootstrap_v944.js, hansen_cred_guard_v1092.js, hansen_cloud_save_v965.js (touch only if needed for the spec), hansen_cloud_diag_v1027.js (you may improve its session trace display); tests that exercise these modules: test_session_truth_v1059.mjs, test_session_retry_v1077.mjs, test_session_persist_v1031.mjs, test_username_signup_v1058.mjs, test_phone_signup_v1057.mjs, test_auth_errors_v1009.mjs, test_cloud_identity_v1028.mjs, test_backup_*.mjs, test_account_*.mjs, test_login_*.mjs, test_signup_gate_v1030.mjs, test_gate_login_v1054.mjs, test_cred_*.mjs, test_iframe_login_v1091.mjs, test_single_instance_v1088.mjs, test_cloud_save_v965.mjs, test_cloud_diag_v1027.mjs, and other test_*.mjs whose subject is auth/backup/cloud save.
Must cover: ensureSession timeout + null classification (credentials present → transient, absent → definite expired, respecting the 60 s fresh window and hansen_cred_guard_v1092.js shadow-rescue semantics — read that module and decide carefully; also fix its rescue counter never being reset if that is wrong), uid recovery via getCurrentUser()/getClaims() when user_info is missing, corrupt user_info repair, trace lines for every branch; loginByPassword credentials check; registerByPassword honest rejection + UI/signup-gate wording so username registration does not pretend to work (username login can stay); iframe auth object caching; HansenBackup (and bootstrap) never export/restore SDK-owned keys; ensureProfile/assignCid check {code}. Export what the room layer needs: ensureSession must keep returning {ok:true, uid} on success and {ok:false, notReady|expired|slow, reason} on failure — document the exact shapes in api_contract.
Validate with the REAL SDK against the emulator (${SCR}/emulator-poc/, copy into ${SCR}/u2/): user_info removed → ensureSession recovers uid; credentials removed → expired; /auth/v1/token hang → timeout → notReady; registerByPassword → honest error, no marker; loginByPassword with bad response → no marker.`

const U4 = `${COMMON}
YOUR PART: friends, ladder leaderboard, player profile — SPEC §5.
You own: hansen_friends_v1106.js, hansen_friends_ui_v1107.js, hansen_ladder_board_v1156.js, hansen_sb_profile_v1002.js; tests test_friends_v1106.mjs, test_friends_ui_v1107.mjs, test_ladder_board_v1156.mjs, test_cid_order_v1130.mjs, test_account_switch_v1142.mjs (only friends/profile parts — coordinate via notes if it touches auth).
Must cover: ladder board db() ready on first call (await app + session), {code} checks, empty vs error distinction, push errors surfaced; friends with NO cross-user writes (each user writes only own rows; mutual friendship = both own rows exist; removal = delete own row; the UI shows pending/accepted correctly), {code} checks, a missing collection produces a clear config error naming the collection and the permission to set (「读取全部数据，修改本人数据」), use HansenAuth's app instance; friends overlay z-index 2147483500 (above the 拼写大PK screen 2147483400, below room UI 2147483600) and opening friends must not arm the watchdog (if that needs a change in another file, note it); a reliable display-name getter in HansenSbProfile for the room layer (document it in api_contract: function name and return value).
Validate with the real SDK against the emulator (${SCR}/emulator-poc/, copy into ${SCR}/u4/): two accounts add each other → both see accepted; remove → other side sees it; quick message sent/received; missing hansen_friend_msgs → clear error; board lists both players after rating push; first board open after page load is not "登录之后才能看到".`

const U5 = `${COMMON}
YOUR PART: the real-SDK end-to-end test infrastructure and the new E2E tests — SPEC §7.
You own: a new repo helper (name it so it is excluded from deploy AND not auto-discovered as a test: check cloudbaserc.json ignore patterns and package_release.py / release contract rules; e.g. _cloudbase_emulator.mjs, plus a small harness helper if useful), and new files test_ladder_cloud_v1164.mjs, test_rooms_cloud_v1164.mjs, test_cloud_errors_v1164.mjs, test_auth_cloud_v1164.mjs (you may split differently; keep each test < ~4 min and deterministic). If the release contract / package rules need the helper registered or excluded, note it for the integrator.
1) Port ${SCR}/emulator-poc/emulator.mjs + harness.mjs into the helper: static server with correct MIME types for the repo; context-level routing of *.tcb-api.tencentcloudapi.com (+ tcloudbasegateway.com) to the emulator; abort every other external host and record leaks; serviceWorkers:'block'; seeded accounts (phone-code and password users), permission modes per collection (READONLY legacy|rules, ADMINONLY, PUBLIC_TEST_ONLY, missing collection), latency/jitter, eventual-consistency lag for reads/queries (writes atomic on newest state), duplicate _id add → resolved {code} error (document the code/message you chose and why), refresh-token rotation, fault injection (abort/HTTP 5xx/hang), knobs per test. Login helpers that drive the REAL HansenAuth (loginByPhoneCode via the emulator's fixed code, or loginByPassword) — no _setAuthForTest, no _setTransportForTest, no _setMeForTest.
2) Write the E2E tests listed in SPEC §7 against the REAL pages (spelling_pk.html; an island page for the island-entry check) and the API contract in the spec, driving the UI with page.touchscreen.tap where the user would tap (scrollIntoView + elementFromPoint check), with two (or three) browser contexts = two phones. Assert user-visible outcomes (screens/texts) AND database state (e.g. no doc written by a non-owner, no phone numbers in room docs, rooms cleaned up), both permission modes READONLY legacy and rules. Include: ladder two players full ranked game with ELO on both sides; simultaneous start converges; island entry visibility; public room + private code; modes A/B/C to settlement; 3 guests race; guest leaves while waiting; abandon both directions; host finishes first; ADMINONLY / missing collection → 「云端设置还差一步」 screen; network abort → 连不上网络 + 技术信息; expired session → login screen; user_info missing → auto recover; registerByPassword honest; HansenBackup excludes SDK keys.
Other agents are rewriting hansen_pk_room_v1065.js, the UI, auth and friends right now, so many tests will fail at first. That is expected: build the harness, make the tests correct against the SPEC, run them, and report precisely which assertions fail and why (spec mismatch vs not-yet-implemented). Make failure output self-explanatory (print screen text, db snapshot). Keep the no-network rule absolute.`

const INTEG = (reports) => `${COMMON}
YOUR PART: INTEGRATION. Five agents just implemented the v1164 fix in parallel (reports below). Now YOU own every file in the repo (except vendor_*, VERSION/version stamps, hansen_audio_lock.json, hansen_bug_registry.py, CHANGELOG/handoff docs). Your job is to make the whole thing work together, correctly and completely, per ${SCR}/SPEC_v1164.md.
1) Read every report, then read the diffs (git diff) of all changed files. Resolve every notes_for_integrator item and open issue, cross-module mismatch (data layer ↔ UI ↔ auth ↔ friends/board ↔ tests), and any spec item nobody implemented.
2) Run the new real-SDK E2E tests (test_*_v1164.mjs) and fix the PRODUCT code (or a test that is genuinely wrong vs the spec — explain) until they all pass reliably (run each at least twice). Then run every test file that references the changed modules (grep for HansenPkRoom, HansenPkRoomUI, HansenLadderUI, HansenSbPK, HansenAuth, HansenBackup, HansenFriends, HansenLadderBoard, HansenSbProfile, HansenCloudSave) and test_real_path_smoke_v1163.mjs; fix regressions. Finally run the full suite in batches: \`cd /home/claude/work/repo && HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs python3 分批跑测试.py 540\` repeatedly until it reports all passed (use --recheck for suspected parallel flakiness; a test that fails serially is a real failure). Note: 分批跑测试.py stores results in .jarvis_resume.json keyed by a source fingerprint, so any code edit invalidates earlier results — finish code changes first.
3) Add the guards the reports asked for (hansen_guards_v1068.py: write the guard function before \`GUARDS = [\`, register it at the end of GUARDS; use _code_only(_read(...))), each with a self-test sample in jarvis_selftest.py (CASES), and prove each new guard bites: inject the fault, run the guard, see red, restore. Minimum new guards: realTransport/ladder-board/friends check r.code; no where().update in room code; no phone/username written into room docs; ladder & friends overlay z-index above the 拼写大PK screen; ensureSession has an overall timeout; registerByPassword never writes the marker without credentials. Run \`python3 hansen_guards_v1068.py\` (green) and the self-test only for the guards you added/changed if a full jarvis_selftest.py run is too slow (report what you ran).
4) Check the deploy/release side: new helper files must be excluded from deploy (cloudbaserc.json) and from the release package if package_release.py has include/exclude lists or a contract test; check_resources.py must report 0 problems (\`python3 check_resources.py\`).
5) Do NOT bump the version, package, commit or push. Report precisely: what you changed, final results of every test you ran (names + pass/fail counts), guard results, remaining risks, and anything that can only be verified on a real phone.

REPORTS:
${JSON.stringify(reports, null, 1)}`

phase('Implement')
const results = await parallel([
  () => agent(U1, { label: 'impl:data-layer', phase: 'Implement', schema: REPORT })
          .then(r1 => agent(U3(r1), { label: 'impl:ui', phase: 'Implement', schema: REPORT })
          .then(r3 => ({ r1, r3 }))),
  () => agent(U2, { label: 'impl:auth-backup', phase: 'Implement', schema: REPORT }),
  () => agent(U4, { label: 'impl:friends-board-profile', phase: 'Implement', schema: REPORT }),
  () => agent(U5, { label: 'impl:e2e-tests', phase: 'Implement', schema: REPORT }),
])
const chain = results[0] || {}
const reports = {
  data_layer: chain.r1 || null,
  ui: chain.r3 || null,
  auth_backup: results[1],
  friends_board_profile: results[2],
  e2e_tests: results[3],
}
log('implementation agents done; starting integration')
phase('Integrate')
const integ = await agent(INTEG(reports), { label: 'integrate', phase: 'Integrate', schema: REPORT })
return { reports, integ }
