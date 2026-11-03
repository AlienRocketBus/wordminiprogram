# v1164 天梯 + 房间对战 彻底修复 —— 设计规格（实现者必读）

Repo: /home/user/wordminiprogram (symlink /home/claude/work/repo — run tests from there).
Playwright: env HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs
Forensics (evidence, SDK offsets, experiments): /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/verdicts.txt
plus per-topic scratch dirs: sdkauth/, skeptic-*/, ladder-logic/, emulator-poc/ (SPEC.md = CloudBase wire spec; emulator.mjs = working emulator).

## 0. Facts we build on (verified from SDK 2.30.0 source + local runs; server behaviour inferred)

F1. Every DB op (add / doc.get/update/set/remove / where.get/update/count) RESOLVES with `{code, message, requestId}`
    when the server returns a business error (HTTP 200 + code). It REJECTS only on transport problems:
    `Error('network request error')` (any HTTP≠200, empty body, CORS/abort, 15 s XHR timeout) or plain objects like
    `{error:'unauthenticated', error_description:'credentials not found'}` / oauth refresh errors (`invalid_grant`).
    Today no app transport checks `r.code` → permission denied / missing collection look like success / empty / updated:0.
F2. Console permission of `hansen_pk_rooms` (and the recommended one for friends) is 「读取全部数据，修改本人数据」
    (READONLY): everyone may read, only the creator (server-stamped `_openid`) may update/remove. A non-creator's write
    silently does nothing (updated:0) or resolves DATABASE_PERMISSION_DENIED. Docs also suggest client-side
    `where().update()` (multi) may be refused entirely under basic permissions.
    ⇒ The current protocol (guest updates the host's room doc: claim, guestBeat, guestReady, claimRound, reportResult,
      leave, abandon) can NEVER work. This is the root cause of 「建房不行 / 天梯匹配不到」.
F3. Auth.getLoginState() never rejects (except corrupt user_info JSON); returns null for: no credentials, refresh
    network failure, invalid_grant. `st.user.uid` comes ONLY from localStorage `user_info_<env>` cache.
    Recover uid via `auth.getCurrentUser()` (re-fetches /auth/v1/user/me and repopulates the cache) or
    `auth.getClaims()` (JWT sub). Credentials live in localStorage `credentials_<env>`.
F4. registerByPassword never creates a cloud account (SDK signUp({email}) only sends an email code) but writes the
    local "signed in" marker → permanent 「云端会话尚未就绪」. loginByPassword has no credentials check either.
F5. HansenBackup exports/restores SDK-owned keys (user_info_<env>, device_id, lang_<env>, x-tcb-trace_<env>).
F6. Island path: ladder (z 2147482000) and friends (z 2147482000) open BEHIND the 拼写大PK screen (z 2147483400).
F7. Many lifecycle bugs (see verdicts.txt ladder-logic + write-ownership): simultaneous-start deadlock, ghost room after
    2-min wait, watchdog false rescue after close (and rescue loop), join failure always shown as 「抢走了」, host
    deletes room before guest reads result, reportResult not retried, pollResult `st` ReferenceError, matching
    screen frozen while listRooms slow, `_netFail`/t0 not reset, state leaks (_fromLadder, _askMode, _ladderRating),
    me().name always 「无名蜂」 (HansenSbProfile has no status()), hostId/guestId = PHONE NUMBER readable by all,
    host never learns guest rating, ladder board first call returns null.

## 1. Core principle of the fix

**Every player writes ONLY documents they created.** All cross-player coordination uses either
(a) reading the other player's own documents, or (b) "insert with a deterministic `_id`" as the atomic primitive:
the database guarantees `_id` uniqueness, so of several clients adding the same `_id`, exactly one succeeds.
No `where().update()` anywhere in room/ladder code. Works under READONLY *and* under any looser custom rule.
No console change is required for rooms/ladder.

Because the exact error text of a duplicate-`_id` add is unknown, **never trust the add result alone**:
on any add failure (resolved `{code}` OR rejection), READ the doc back by `_id` (retry ~5× over ~3 s for eventual
consistency): exists & owner == me → success (my earlier retry landed); exists & owner != me → taken;
not found → real error (classify it). On add success, optionally read back too (cheap insurance) when the
outcome decides exclusivity.

## 2. Error classification contract (each module embeds its own small helper; same semantics)

Every failed data-layer call returns `{ ok:false, reason: '<人话> ⟨<原话>⟩', kind, expired: kind==='expired', code? }`.
`kind` ∈
- `network`  — 'network request error', Failed to fetch, Load failed, NetworkError, {error:'unreachable'}
- `slow`     — our own timeouts (mark Error with `.timeout = true`) and SDK 15 s timeout text
- `session`  — session not usable yet but credentials exist (transient; retry soon)
- `expired`  — definitely signed out: no credentials, unauthenticated, credentials not found, invalid_grant,
               invalid refresh token
- `config`   — server business error `{code}`: DATABASE_PERMISSION_DENIED, DATABASE_COLLECTION_NOT_EXIST,
               INVALID_PARAM, any other code → 人话 says which collection and what is wrong
- `gone`     — the room/doc no longer exists
- `taken`    — someone else got the seat
- `self`     — it is my own account's room (same account on another device)
- `other`
The `⟨原话⟩` part must contain the raw code/message (UI 技术信息 line shows it). Keep `人话 ⟨原话⟩` format (existing
callers split on ⟨⟩). Callers that only check `r.ok`/`r.reason` keep working.

## 3. Room data layer (hansen_pk_room_v1065.js) — new storage layout, same public API

Collection stays `hansen_pk_rooms`. All new docs carry `proto: 2` and `kind`. listRooms/findByCode/joinRoom ignore
docs without proto 2 (old-version rooms). Identity key = `'u' + uid` (uid from HansenAuth.ensureSession(); cache it;
`_setMeForTest` still overrides). NEVER write phone numbers / usernames into room docs. Display name from
HansenSbProfile (find the real getter, e.g. readProfile().name / fullName()).

Docs:
- Room R  `_id = 'r…'` (existing generator), kind 'room', host-owned. Host-only fields: status ('open'|'playing'|'done'),
  isPrivate, code, mode, askMode, seed, wordCount, hostId(key), hostName, hostRating, hostTier, createdAt,
  heartbeatAt, hostBeat, hostReady, hostReadyAt, hostScore, seat (epoch number, starts 0), guestId/guestName/
  guestRating (copied by host on ACK), startedAt, endedAt, endedBy, abandonWin.
- Seat S  `_id = R._id + '_s' + epoch`, kind 'seat', guest-owned: roomId, epoch, guestId(key), guestName,
  guestRating, createdAt, guestBeat, guestReady, guestReadyAt, guestScore, left, abandonWin.
  Created by `add` with that fixed `_id` ⇒ atomic seat claim among guests.
- Win W_i `_id = R._id + '_w' + i`, kind 'win', owned by its creator: roomId, i, winner ('host'|'guest'|'' = skip),
  by(key), at (ms). Created by `add` ⇒ atomic round decision (claimRound / skipRound).

Merged view returned to UI keeps the LEGACY field names (hostId, guestId, hostName, guestName, hostRating, guestRating,
status, mode, askMode, seed, wordCount, round, roundAt, winners, hostReady, guestReady, hostScore, guestScore,
heartbeatAt, hostBeat, guestBeat, startedAt, endedBy) so UI code reading room fields keeps working.
Merges must be monotonic against stale reads: status never regresses (open→playing→done), decided winners are
cached per room and never shrink, scores once seen stay.
- round-0 `roundAt` = both ready ? max(hostReadyAt, guestReadyAt) : 0 ; round k>0 `roundAt` = W_{k-1}.at.

API semantics (same names/return shapes as today; extra fields allowed):
- `createRoom(opts)`: R with proto 2. add with retry; on failure read back own `_id`. Words probe stays.
- `listRooms()`: identity; listOpen; keep proto 2, status open, no guestId, heartbeat fresh, not mine. Also return
  `sameAccount: <count of my-key rooms that are not _myRoomId>` so the UI can hint. Sanitize as today.
- `findByCode(code)`: same filters.
- `joinRoom(roomId)`: read R (retry for lag) → validate (proto 2, open, alive, not mine → kind 'self') →
  add S(epoch=R.seat||0) → on failure read-back decides mine/taken/error → start guest heartbeat on S →
  wait for host ACK (poll R ~every 1 s, up to ACK_MS ≈ 15 s): R.guestId === myKey && R.seat === epoch → ok.
  R gone / guestId other / seat bumped / status done → remove my S, `{ok:false, kind:'taken'|'gone'}`;
  timeout → remove S, `{ok:false, kind:'other', reason:'房主没有回应，换一间吧'}`.
  Success return: `{ok:true, roomId, room: merged, words, mySide:'guest'}`. Fix L14 orphan claims (always remove
  S on any failure after it was created).
- `waitForOpponent(roomId, onChange, timeoutMs, opts)`: host polls S (by computed id) + own R. Seat present & fresh
  & !left → patch R {status:'playing', guestId, guestName, guestRating, startedAt} → `onChange({joined:true, room})`.
  Seat present but stale (no beat change for SEAT_STALE_MS ≈ 20 s, observed with LOCAL clock) → bump R.seat
  (cannot delete other's doc) and keep waiting. Events {gone}/{timeout}/{error} as today.
  `opts.ladder = { rating, band(waitedSec) }`: also rescan (listRooms) every ~3rd tick; if no seat is pending and an
  OLDER (createdAt asc, tie `_id` asc) fitting open ladder room (mode 'A', public, proto 2, rating within band) exists
  → `onChange({switchTo: thatRoomId})` (UI leaves own room and joins that one). Deterministic tie-break ⇒ two
  simultaneous starters converge.
- Heartbeat: host patches R {heartbeatAt, hostBeat}; guest patches S {guestBeat}. Stop after 3 consecutive
  "doc missing" (gone) results; network errors do not count.
- `opponentGone(roomId)`: skew-proof — remember the opponent's beat VALUE and the LOCAL time it last changed;
  idle = localNow − lastChangeLocal; gone when idle > ABANDON_MS (60 s). Host with no guest → waitingForGuest.
- `claimAbandonWin(roomId)`: write own doc only (host: R {status:'done', endedBy:'abandon', abandonWin:'host',
  hostScore:1}; guest: S {abandonWin:'guest', guestScore:1}); merged view derives scores (winner 1, loser 0).
- `markReady(roomId)`: own doc {xReady:true, xReadyAt:now, xBeat:now}; start heartbeat.
- `claimRound(roomId, i)`: add W_i {winner: mySide}. Success → won. Failure → read W_i → lost (winner known).
  Return `{ok, won, first, score, winner, round, winners, mode}` as today. Respect existing sanitizing (cap by wordCount).
- `skipRound(roomId, i)`: add W_i {winner:''}; duplicate ⇒ already decided. Return as today.
- `roundState(roomId)`: read R + S(current epoch) + probe W_k for k = cached decided count (up to 3 per call), plus
  occasional where({roomId, kind:'win'}) backfill. Return today's shape + oppName, oppRating for BOTH sides
  (host gets guestRating from S/R), mySide, hostReady/guestReady, roundAt, heartbeatAt, wordCount.
- `reportResult(roomId, score)`: write own doc score with retries (3×); read both → result/waiting as today.
- `leaveRoom(roomId)`: host & no guest yet → remove R. Host & match started/done → patch R {status:'done', endedAt}
  and DEFER removal (grace ≥ 60 s, done by sweep) so the guest can still read the result.
  Guest before ACK/start → remove own S. Guest after start → patch S {left:true}; removal deferred to sweep.
  `_byeOnUnload` follows the same role-aware rules (never touches other people's docs).
- `sweepMyDeadRooms()`: remove MY OWN leftovers only (rooms by hostId==key, seats by guestId==key, wins by==key)
  that are done/stale beyond grace; ≤ 10 removals per sweep; never blocks callers.
- realTransport: every op checks `r && r.code` → throw an Error carrying {code, cloud:true, message}. `patch` returns
  {updated} and the data layer treats updated:0 on an own doc as `gone`. listOpen: orderBy query returning a code
  → fallback query without orderBy; still a code → throw. `read` returns null when data is empty.
- E(): add `network request error` → network; Chinese timeout text → slow; `{code}` errors → config with collection
  name; session/expired split per §2. Export `kindOf` (or put kind on results) for the UI.
- Keep test hooks (_setTransportForTest, _setMeForTest, _setDbForTest, _currentRoomId, etc.). Existing test fakes
  that implement `add` without rejecting duplicate `_id` must be updated to behave like the real DB (reject duplicate
  `_id`), because the stub must mirror the real transport's capabilities.

## 4. Auth / session (hansen_auth_v1004.js, hansen_backup_v944.js, hansen_backup_bootstrap_v944.js, hansen_cred_guard_v1092.js)

- ensureSession(): whole-call timeout (~10 s → {ok:false, notReady:true, slow:true}); getLoginState null →
  credentials_<env> absent (and no live cred_guard rescue pending) → definite expired (existing 60 s fresh-login
  window still protects; broadcast hsn-auth-changed); present → transient notReady. st non-null but no uid →
  getCurrentUser() (timeout ~6 s) then getClaims().sub as fallback; ok with uid. Corrupt user_info → remove that key,
  retry once. Keep the trace T() lines (they are the phone-side diagnostics) and add lines for the new branches.
  Return `{ok:true, uid}` exactly as today on success.
- loginByPassword: same credentials check as the phone path before writing the marker.
- registerByPassword: the SDK cannot create username accounts → reject honestly with a clear Chinese message that
  points to phone registration (家长手机也可以); never write the marker without credentials. Adjust
  hansen_auth_ui_v1004.js / signup gate so the username *registration* option does not pretend to work
  (username LOGIN may stay). Keep wording for teachers/kids: say why and what to do.
- iframe: cache the auth object per app instance (don't call app.auth({persistence}) on every call).
- HansenBackup: never export/restore SDK-owned keys: credentials_*, user_info_*, lang_*, x-tcb-*, device_id,
  anything containing the env id, access/refresh token keys. Same in the bootstrap if it has its own list.
- ensureProfile/assignCid: check `{code}` results; never assign cid from an error count.

## 5. Friends / ladder board / profile

- hansen_ladder_board_v1156.js: db() must not return null on first call (await HansenAuth._app() + ensureSession);
  check `{code}`; distinguish empty board vs error; push errors reported (not ok:true).
- hansen_friends_v1106.js: no cross-user writes — each user writes only own rows; mutual friendship = both own rows
  exist; check `{code}`; missing collection → clear config error (which collection to create, which permission).
  Use HansenAuth's app instance (no extra SDK instance).
- hansen_sb_profile_v1002.js: expose a reliable display-name getter for the room layer if none exists.

## 6. UI (hansen_ladder_ui_v1108.js, hansen_pk_room_ui_v1065.js, hansen_pk_watchdog_v1155.js, hansen_sb_pk_v1022.js,
##    hansen_friends_ui_v1107.js, spelling_pk.html)

- z-index: ladder + friends overlays above the 拼写大PK screen (2147483400) and below room UI (2147483600) and
  auth UI (2147483645) — e.g. 2147483500. Every ladder re-entry path (再找一次对手, 再来一局, rescue) must be visible.
- kLadder (island 拼写大PK screen) gets the same sign-in / cloud-ready gate as kRooms.
- Routing by `kind`: network/slow → retry, after 4 → 连不上网络 screen with 技术信息; session → silent retries with
  「正在连接云端…」 up to ~20 s, then a 「云端还没连上」 screen with retry (NOT 「排位要先登录」); expired → login
  screen (「云端登录过期了」); config → new 「云端设置还差一步」 screen with 技术信息 and plain-language steps;
  self → hint 「这是你自己账号开的房，要用另一个账号才能对战」.
- Matching loop: independent 1 s timer updates 「已等 N 秒」; reset _netFail/t0 per start; try fitting rooms
  oldest-first; on taken → next; never a dead-end screen; self-host after 20 s with waitForOpponent opts.ladder
  (handle {switchTo}); on wait timeout → leaveRoom + back to ladder home with 「暂时没有对手，等会儿再来」.
  Public lobby wait timeout → leaveRoom + lobby with a correct message (sayHuman must understand it).
- doJoin: show the real reason (taken vs gone vs network vs config); ladder failures go back into matching
  automatically (no extra taps). Reset _fromLadder on success; ladder rooms use askMode 'cn' explicitly and don't
  inherit lobby state; _createForLadder failure returns to the ladder with the reason.
- Settlement: guest records its result even if the host finished first (data layer defers removal); reportResult
  failures retried before giving up; fix pollResult `st` ReferenceError; reset per-game counters.
- Watchdog: HansenLadderUI.close() / friends closePeers must not arm it; rescue quit() must not re-arm (no loop).
- oppName/oppRating for both sides from the merged room; ELO uses the real opponent rating.

## 7. Tests (zero app stubs; only the network is emulated)

- Port the PoC emulator (scratchpad emulator-poc/emulator.mjs + harness.mjs) into the repo as a helper whose name
  is excluded from deploy and from test discovery (e.g. `_cloudbase_emulator.mjs`; check cloudbaserc.json ignore and
  package_release.py rules; `test_*.mjs` files are auto-discovered as tests).
- New real-SDK E2E tests (`test_*_v1164.mjs`), each self-contained, deterministic, < ~4 min, no network:
  ladder 2 players (spelling_pk.html), ladder from island page (visibility above PK screen), simultaneous start,
  public room + private code, modes A/B/C to settlement, 3 guests racing for one seat, guest leaves while waiting,
  abandon both directions, settlement when host finishes first, permission modes (READONLY legacy & rules — both
  must work; ADMINONLY/missing collection → 「云端设置还差一步」), network abort → 连不上网络 + 技术信息,
  expired → login, user_info missing → auto recover, registerByPassword honest, backup excludes SDK keys.
- Update existing tests whose fakes/assertions encode the old (broken) protocol, keeping their intent. Never weaken a
  test to make it pass; never skip/quarantine.

## 8. Guards / docs

- `python3 hansen_guards_v1068.py` must stay green. If a guard encodes the old protocol (e.g. requires `claim` usage),
  update the guard AND its self-test sample in jarvis_selftest.py consistently, with the reason in the guard's text.
  Add guards for: realTransport checks r.code; no where().update in room code; no phone/username in room docs;
  ladder z-index above sb_pk; ensureSession has a timeout.
- Do NOT bump the version, do NOT run package_release.py / jarvis_gate.py, do NOT commit or push (the integrator does).
- Comments in code: Chinese, short, explain why (match the repo's style but keep them brief).
