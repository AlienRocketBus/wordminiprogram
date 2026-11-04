export const meta = {
  name: 'v1164-max-review',
  description: 'Max-effort adversarial review of the v1164 ladder/room/auth/friends rebuild: 7 lenses → per-lens skeptic verification → fix → second round until dry',
  phases: [
    { title: 'Review', detail: '7 independent max-effort reviewers, each a different lens' },
    { title: 'Verify', detail: 'a max-effort skeptic per lens reproduces or refutes every finding' },
    { title: 'Fix', detail: 'one max-effort fixer applies all confirmed fixes with tests' },
    { title: 'Re-review', detail: 'fresh reviewers on the fixed tree; loop until a round finds nothing confirmed' },
  ],
}

const SCR = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad'
const REPO = '/home/user/wordminiprogram'
const CTX = `
CONTEXT: "单词大冒险" (Chinese kids' English-vocabulary H5 game) — repo ${REPO} (symlink /home/claude/work/repo; run node tests from there with env HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs). Base v1163 = commit 73e1b69 (origin/main). The working tree contains the v1164 rebuild of the online ladder (天梯排位), room battles (房间对战), session/auth, backup, friends, leaderboard and profile, plus a real-SDK CloudBase emulator (cloudbase_emulator.mjs, cloudbase_e2e_harness.mjs) and new real-SDK E2E tests (test_*_v1164.mjs). Review the FULL change: \`git -C ${REPO} diff 73e1b69 -- . ':!*.png'\` plus untracked files (\`git -C ${REPO} status --short\`).
Design spec: ${SCR}/SPEC_v1164.md. Original forensic evidence (why v1163 never worked): ${SCR}/verdicts.txt. Implementation reports: ${SCR}/impl_reports.txt. CloudBase wire spec + SDK offsets: ${SCR}/emulator-poc/SPEC.md. Vendored SDK: vendor_cloudbase_esm_v965.js (@cloudbase/js-sdk 2.30.0, single-line minified; slice with python by offset).
Real backend facts (inferred, cannot be observed here — the sandbox has no route to Tencent): collection permission 「读取全部数据，修改本人数据」 (READONLY: everyone reads, only the creator — server-stamped _openid — updates/removes); the SDK RESOLVES server business errors as {code,message} and REJECTS only transport errors ('network request error') and auth errors; duplicate-_id add fails on the server (exact code unknown); reads are eventually consistent.
The product is used by 7–10-year-olds on phones in WeChat's browser; the owner is a non-technical teacher who demands that NOTHING be broken. You have unlimited time: be exhaustive and precise.
RULES: this is a REVIEW: do not edit repo files (use ${SCR}/review/<lens>/ for scripts and copies). Prove every finding: a failing experiment (browser/emulator/node script) or exact code reasoning with file:line. No speculative or style-only findings unless they would plausibly hurt a kid/teacher. Rank by severity. Your final output is data for an orchestrator.
`
const FINDINGS = { type: 'object', properties: {
  summary: { type: 'string' },
  coverage: { type: 'array', items: { type: 'string' } },
  findings: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, title: { type: 'string' },
    severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
    file: { type: 'string' }, line: { type: 'string' },
    scenario: { type: 'string', description: 'concrete steps/inputs/state → wrong outcome the user sees' },
    proof: { type: 'string', description: 'experiment path + output, or exact code trace' },
    fix: { type: 'string' } },
    required: ['id', 'title', 'severity', 'file', 'line', 'scenario', 'proof', 'fix'] } },
}, required: ['summary', 'coverage', 'findings'] }
const VERDICTS = { type: 'object', properties: {
  verdicts: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, verdict: { type: 'string', enum: ['confirmed', 'refuted', 'uncertain'] },
    reason: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'n/a'] } },
    required: ['id', 'verdict', 'reason', 'severity'] } },
}, required: ['verdicts'] }
const FIXREP = { type: 'object', properties: {
  summary: { type: 'string' },
  fixed: { type: 'array', items: { type: 'string' } },
  not_fixed: { type: 'array', items: { type: 'string' }, description: 'with reason' },
  tests: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' } }, required: ['name', 'result'] } },
  guards: { type: 'string' },
}, required: ['summary', 'fixed', 'not_fixed', 'tests', 'guards'] }

const LENSES = [
  { key: 'protocol', prompt: `LENS: own-document room protocol correctness under concurrency (hansen_pk_room_v1065.js). Model every interleaving: seat claim races (2–4 guests), host ACK vs guest timeout/cancel, seat epochs and stale-seat bumps, deterministic win docs (claimRound vs skipRound vs late claims, round index drift between the two sides, out-of-range rounds), merged-view monotonicity under stale reads, ladder rescan + oldest-wins switchTo (including a guest seating in the switching host's room at the same moment, two hosts switching to each other, three hosts), deferred removal + sweep (could a sweep remove a doc still needed? could the guest lose the result?), reload/close mid-match on either side, the same account on two devices, partial failures (seat added but ACK read fails; win doc added but response lost → read-back), duplicate-add error shapes (resolved {code} vs rejection vs silent success) and eventual consistency lags up to several seconds, clock skew of ±10 min on either device (what is still clock-dependent?). Also adversarial clients: an outsider pre-creating seat docs or win docs (R._id + '_w' + i) for someone else's room — can a stranger block or corrupt a match? Is a squatted win doc ignored and is there a way to still decide the round? Write emulator experiments (cloudbase_emulator.mjs supports latency/lag/permission modes) to prove problems.` },
  { key: 'session-auth', prompt: `LENS: session/auth/backup changes (hansen_auth_v1004.js ensureSession/ensureSessionOnce, loginByPhoneCode, loginByPassword, registerByPassword, friendly(), hansen_auth_ui_v1004.js, hansen_signup_gate_v1030.js, hansen_cred_guard_v1092.js, hansen_backup_v944.js + bootstrap, hansen_cloud_save_v965.js dbChk, hansen_cloud_diag_v1027.js). Hunt for: false "expired" that logs a genuinely signed-in kid out (e.g. SDK keeps creds in memory while storage differs; cred_guard shadow restore timing; iframe vs top; the 60 s fresh window; tab sleeping in background for hours then waking); false "notReady" loops; timeouts too short for real 4G (10 s whole call, 6 s user/me) and what the user sees then; single-flight result sharing bugs (one caller mutating a shared object, stale cached failure); uid recovery returning a wrong uid (getClaims sub vs /user/me uid mismatch); restoring an OLD cloud snapshot that contains SDK keys (dropped? checksum still valid? any data loss?); account switch flows; username-login-only UI still reachable for registration anywhere (signup gate, onboarding, settings); every user-facing auth message reachable and honest. Run the auth tests and write real-SDK emulator experiments for the risky paths.` },
  { key: 'ui-flows', prompt: `LENS: UI flows and state machines (hansen_ladder_ui_v1108.js, hansen_pk_room_ui_v1065.js, hansen_pk_watchdog_v1155.js, hansen_sb_pk_v1022.js, spelling_pk.html, template.html integration). Drive the REAL pages with the emulator and touch taps on BOTH the island path (index.html → island iframe → 拼写大PK → 天梯/房间) and spelling_pk.html: every screen, every button, every cancel/back/×, every error route by kind (network/slow/session/expired/config/self/taken/gone), every re-entry (再找一次对手, 再来一局, rescue 重新找对手), name screen first-time path, signed-out user, reload mid-flow, background/foreground (visibilitychange), rapid double taps, Android back (history), overlay stacking with auth UI / signup gate / toasts / version watcher / onboarding. Check timers and intervals are cleared on every exit (count them before/after 10 open/close cycles), no listeners pile up, no stale callbacks repaint a new game (e.g. leftover pollResult loops), the B/C waitAll scoring now follows the published rules (先拼对 100, 后拼对 80/60, 两人都答完才翻篇), the keyboard can answer every word the game can serve (words with spaces/hyphens), and the 「已等 N 秒」 counter is smooth. Report each broken transition with the exact screen text.` },
  { key: 'friends-board', prompt: `LENS: friends, leaderboard and profile (hansen_friends_v1106.js, hansen_friends_ui_v1107.js, hansen_ladder_board_v1156.js, hansen_sb_profile_v1002.js, ensureProfile/assignCid in hansen_auth_v1004.js). Check the own-row friends protocol (mutual = both own rows; requests; removal; forged rows ignored; inbox only from mutual friends; seen state), quick-message delivery both ways, cid assignment correctness and uniqueness under concurrency and read lag (two kids registering at the same second; lag 300–1500 ms), board ordering/fallback/filters, name updates propagating, error kinds and screens (missing collection → which collection + which permission), XSS in any rendered name/field, and the UI (z-index, input not wiped, focus, refresh cadence, watchdog disarm). Prove with emulator experiments (two or three accounts).` },
  { key: 'regressions', prompt: `LENS: regressions outside the rebuilt subsystems and whole-product side effects. Every island page loads the battle/auth/cloud modules (template.html script list) — check island pages and home for new console errors, slower startup, extra network/cloud calls at load (e.g. ensureSession or board/friends polling started on every island), CloudBase READ/WRITE VOLUME per minute for an idle player (home, island, ladder home, friends page open), a waiting host, a guest waiting for ACK, and a match in progress in each mode A/B/C — MEASURE it by counting emulator requests per op type in real-SDK runs. The integrator estimated ~3 reads/s per phone during a match (~600–1000 reads per game). Find the real CloudBase 个人版 database quota/pricing (web search; Tencent doc domains may be blocked — use search snippets and state the date/confidence) and compute daily use for a class of 30 kids playing 5 ranked games each plus normal idle use. If that can exhaust the quota or create surprising cost (an exhausted quota would also break cloud save and login for everyone), report it as MAJOR and give a concrete, safe reduction plan (e.g. apply own patches to a local cache instead of re-reading own docs, adaptive polling intervals by phase, pause polling while the page is hidden, single combined probe per tick, longer intervals for idle screens) with the expected read count after the change, localStorage growth, cloud save upload/restore correctness (hansen_cloud_save_v965.js put/get changes), backup coverage, account switching, offline behaviour, version watcher. Run the broader test set that touches these modules (grep test_*.mjs for HansenCloudSave/HansenBackup/HansenAuth/HansenPk/HansenLadder/HansenFriends) and test_ui_walkthrough_v969.mjs; investigate any failure to a root cause (no "flake" without proof). Check guards (python3 hansen_guards_v1068.py), check_resources.py, 防下载总闸.py, deploy/package rules for the new helper files (cloudbaserc.json ignore, package_release.py).` },
  { key: 'security-privacy', prompt: `LENS: security & kids' privacy of the rebuilt code. Under READONLY every logged-in user can read every doc of hansen_pk_rooms, sb_profile, hansen_friends, hansen_friend_msgs, hansen_saves: list exactly what each doc type now contains and whether anything identifies or locates a child (phone numbers, usernames, real names, uid-to-phone linkability, cid enumeration), what a malicious logged-in client (edited JS) can do to OTHER kids: block/corrupt matches (seat/win squatting, fake abandonWin, fake hostRating/guestRating to farm ELO), spoof names, spam friend requests/messages to strangers, forge leaderboard entries, read others' cloud saves (is the AES-GCM key derivable from public data such as the uid/cid/phone?), XSS through any field rendered with innerHTML (names, room fields, friend rows, board rows, technical-info lines), and the client-side admin panel (hansen_boss_attack.js 'hbafx' password in code?). Prove each with a concrete attack script against the emulator. Propose proportionate fixes for a kids' game (no server code available; CloudBase security rules may be an option the teacher can set — say exactly what rule text would be needed and its trade-offs).` },
  { key: 'tests-integrity', prompt: `LENS: test-suite integrity and fidelity. For every existing test that was modified (git diff 73e1b69 -- 'test_*.mjs'), judge whether the change preserved the test's intent or weakened it (removed assertions, loosened thresholds, skipped cases) — list any weakening. For every new test (test_*_v1164.mjs, test_auth_session_v1164.mjs, emulator self-test), check it would FAIL on v1163 (run it against a copy of the v1163 files: \`git -C ${REPO} show 73e1b69:<file>\` into a mirror dir) and passes now; check determinism (run each twice), runtime, hidden dependencies on machine speed, use of forbidden hooks in the zero-stub tests, network leaks. Audit the emulator's fidelity against the real CloudBase/SDK behaviour documented in ${SCR}/emulator-poc/SPEC.md and verdicts.txt: list every assumption the emulator makes that the real server might violate (duplicate-_id error shape, _openid stamping value, read-your-writes, error HTTP status codes, orderBy/index behaviour, auth token shapes) and, for each, whether the product code is robust if the assumption is wrong (prove by flipping the emulator knob or patching a copy). Do NOT run the full batch runner (分批跑测试.py) — the release phase runs it; run the specific tests you need.` },
]

async function reviewRound(round, priorConfirmed, lensList) {
  const prior = priorConfirmed.length
    ? `\nAlready found and fixed in earlier rounds (re-check that these fixes are correct and complete; do not re-report them unless the fix is wrong):\n${JSON.stringify(priorConfirmed.map(f => ({ id: f.id, title: f.title, file: f.file })), null, 1)}\n`
    : ''
  const results = await pipeline(
    lensList,
    l => agent(`${CTX}${prior}\nROUND ${round}.\n${l.prompt}`, { label: `r${round}:review:${l.key}`, phase: round === 1 ? 'Review' : 'Re-review', schema: FINDINGS, effort: 'max' }),
    (res, l) => {
      if (!res) return null
      if (!res.findings.length) return { key: l.key, res, confirmed: [] }
      return agent(`${CTX}\nYou are an adversarial SKEPTIC for lens "${l.key}" (round ${round}). Independently try to REPRODUCE each finding below with your own experiment or code trace. "confirmed" only if you reproduced it (or the code trace is airtight); "refuted" with counter-evidence; "uncertain" otherwise. Adjust severity if wrong.\n\nREVIEWER TASK:\n${l.prompt}\n\nFINDINGS:\n${JSON.stringify(res.findings, null, 1)}`,
        { label: `r${round}:verify:${l.key}`, phase: round === 1 ? 'Verify' : 'Re-review', schema: VERDICTS, effort: 'max' })
        .then(v => {
          const ok = new Set((v ? v.verdicts : []).filter(x => x.verdict === 'confirmed').map(x => x.id))
          const sev = Object.fromEntries((v ? v.verdicts : []).map(x => [x.id, x.severity]))
          const unc = (v ? v.verdicts : []).filter(x => x.verdict === 'uncertain').map(x => x.id)
          return { key: l.key, res, verify: v,
            confirmed: res.findings.filter(f => ok.has(f.id)).map(f => ({ ...f, lens: l.key, severity: sev[f.id] && sev[f.id] !== 'n/a' ? sev[f.id] : f.severity })),
            uncertain: res.findings.filter(f => unc.includes(f.id)).map(f => ({ ...f, lens: l.key })) }
        })
    },
  )
  return results.filter(Boolean)
}

const BASE = (args && args.base) || '73e1b69'
const FIXLENS = { key: 'fix-regressions', prompt: `LENS: review ONLY what the fixer changed since commit ${BASE} (\`git -C ${REPO} diff ${BASE}\` — the uncommitted working-tree changes made by the fix rounds). For every hunk: is the fix correct and complete for the finding it addresses, did it break anything nearby (callers, return shapes, timers, UI routes, tests, guards), and are the new tests real (fail before / pass after)? Run the affected tests.` }
const allConfirmed = []
const rounds = []
let lenses = LENSES
let round = 1
while (round <= 4 && lenses.length) {
  log(`review round ${round}: ${lenses.map(l => l.key).join(', ')}`)
  const res = await reviewRound(round, allConfirmed, lenses)
  const confirmed = res.flatMap(r => r.confirmed || [])
  const uncertain = res.flatMap(r => r.uncertain || [])
  rounds.push({ round, lenses: res.map(r => ({ key: r.key, summary: r.res.summary, n: r.res.findings.length, confirmed: (r.confirmed || []).length })), confirmed, uncertain })
  const blockerUnc = uncertain.filter(f => f.severity === 'blocker')
  log(`round ${round}: ${confirmed.length} confirmed, ${uncertain.length} uncertain (${blockerUnc.length} blocker)`)
  if (!confirmed.length && !blockerUnc.length) break
  phase('Fix')
  const fix = await agent(`${CTX}
You are the FIXER (round ${round}). You now own every file in the repo (except vendor_*.js, VERSION / ?v= stamps, hansen_audio_lock.json, hansen_bug_registry.py, CHANGELOG/handoff docs). Fix EVERY confirmed finding below completely and at the root cause (not a patch over the symptom), and investigate the uncertain blocker ones (fix if real). For each fix add or extend a test that fails before and passes after (prove it). Keep the design principles of ${SCR}/SPEC_v1164.md (every player writes only own docs; {code} checks; kinds; no phone/username in docs). After all fixes: run every test touching the changed modules, all test_*_v1164.mjs (each twice), test_real_path_smoke_v1163.mjs, python3 hansen_guards_v1068.py (green), python3 check_resources.py (0 problems), python3 防下载总闸.py. If you add guards, add jarvis_selftest.py samples and prove they bite. Do not commit/push/bump/package. Report precisely.

CONFIRMED FINDINGS TO FIX:
${JSON.stringify(confirmed, null, 1)}

UNCERTAIN BLOCKER FINDINGS TO INVESTIGATE:
${JSON.stringify(blockerUnc, null, 1)}`, { label: `r${round}:fix`, phase: 'Fix', schema: FIXREP, effort: 'max' })
  rounds[rounds.length - 1].fix = fix
  allConfirmed.push(...confirmed)
  const hit = new Set(confirmed.map(f => f.lens))
  lenses = LENSES.filter(l => hit.has(l.key)).concat([FIXLENS])
  round++
}
return { rounds, allConfirmed }
