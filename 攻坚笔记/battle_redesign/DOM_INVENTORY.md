# Online-battle UI: DOM / text / API inventory, constrained by the existing tests

Repo: `/home/user/wordminiprogram` (read-only survey, done 2026-11-03). Line numbers are for the current HEAD.

## 0. How the tests constrain the UI (read this first)

There are three kinds of check, and they constrain a redesign in different ways:

1. **Playwright DOM tests.** These open a real page and select by id or class, then assert on `innerText`, `textContent`, `onclick`, computed colour, or bounding box. If you rename the selector or change the asserted text, the test breaks.
2. **Static source-regex tests (`fs.readFileSync(...).test(src)`).** Most of the battle "tests" are this kind. They grep the module source for literal ids, function names, code fragments and Chinese strings. Many grep raw `src`, so a match inside a comment still counts; others grep comment-stripped code. A rename or rewording breaks them even when the behaviour is the same.
3. **Python guards (`hansen_guards_v1068.py`) plus mutation self-tests (`jarvis_selftest.py`).** A guard greps the source. `jarvis_selftest` injects a mutation at an **exact anchor string** and expects the guard to fire. If the anchor disappears, the injector returns `None` and the self-test reports that guard as untestable. So anchor strings are constraints too.

Other things to know:
- Every `.mjs` test hard-codes `ROOT='/home/claude/work/repo'`, so tests run against that path, not this checkout.
- `hansen_bug_registry.py` checks that registered test files and guard functions exist **by name**. Renaming or removing the test files listed in §7 breaks the registry.
- Two runtime dependents outside the five modules also select these DOM nodes (they are not tests, but a rename breaks them):
  - `hansen_pk_watchdog_v1155.js:58` uses `document.querySelector('.pr_wrap') || document.querySelector('.ld_wrap')`. At `:185` and `:273` it matches screen text against `/正在找对手|等对手进来|等对手交卷|正在拼/` (the "waiting-type" screens get a 90 s limit instead of 25 s). If the container is not visible it checks `parentElement.classList.contains('on')`.
  - `hansen_palette.js:517-542` holds light-theme overrides. For `spelling_pk.html` it targets `.pk_h1 .pk_nm .pk_rn .pk_v .pk_sub .pk_l .pk_rm .pk_sec .pk_empty .pk_cid .pk_back .pk_me .pk_row .pk_note .pk_it .pk_tier .pk_prov .pk_ava .pk_card .pk_btn .pk_join .pk_ab .pk_ab.primary .pk_acct_tip`. For the in-page hub it targets `#hsn_pk_screen` plus `.k_h1 .k_nm .k_v .k_sub .k_l .k_sec .k_cid .k_tip .k_back .k_ab .k_me .k_note .k_it .k_tier .k_ava .k_card .k_ab.primary`. `test_pk_account_v1016` relies on these overrides for `#pkReg` / `#pkSwitch` colours.
- Test-only globals used by the tests: `window.__hsnLadderWaitSec` (the ladder auto-create threshold, default 20) and `window.__rooms` (test-side only).

---

## 1. `hansen_pk_room_ui_v1065.js` — rooms, mode chooser, waiting, battle, result (root `#hsn_pkroom_screen`)

### 1a. Generated ids

| selector | element / screen | generated at | tested by |
|---|---|---|---|
| `#hsn_pkroom_screen` | Root overlay, `role=dialog`, `aria-label="公开房间"`, toggled by class `.on`, z-index 2147483600 (CSS :59) | `ID` const :18; `host()` :120-130; also read by `getElementById` :525 | Not selected by id in any test. Tests go through `.pr_wrap`. `test_account_switch_v1142.mjs:434` asserts a z-index comment in the auth file: tab-stale overlay 2147483646 > battle 2147483600. |
| `#hsn_pkroom_css` | Injected `<style>` | :35-37 | `test_theme_v1110.mjs:30-89` (CSS var source rules, see §1e) |
| `#prBack` | Back / close button: lobby "← 返回" :278, chooser ghost "← 返回" :523, waiting "← 关掉房间" :621, ladder join-fail "← 返回" :705 | :278, :523, :621, :705 | — |
| `#prLogin` | "🔑 重新登录" button inside the error block | :220 | — |
| `#prNew` | Lobby "➕ 开一间" | :305 | `hansen_guards_v1068.py:2652` `guard_tip_matches_button`: the hint `点上面的「➕ 开一间」` (:358) must match the text of some `>…</button>`. `jarvis_selftest.py:592` anchor `点上面的「➕ 开一间」`. |
| `#prPriv` | Lobby "🔒 私密房" | :307 | Indirectly by `test_pk_room_code_v1105.mjs:114`: `/开私密房\|私密房，邀请好友/` on raw src. **This currently passes only because of the comment at :290 ("开私密房（整行）").** |
| `#prRef` | Lobby "🔄 刷新" | :309 | — |
| `#prList` | Room-list container (initially "正在找房间…") | :313 | — |
| `#prCode` | Room-code `<input maxlength=4>`, `aria-label="输入好友给你的四位房间码"`, inside `<details>` | :322-327 | `test_pk_room_code_v1105.mjs:112` `/prCode/` (static) |
| `#prJoinCode` | "进房" button (busy text "找房中…") | :328 | `test_pk_room_code_v1105.mjs:112` `/prJoinCode/` (static) |
| `#prCodeTip` | Error line inserted under the code input (created on demand) | :436 | — |
| `#prCodeBig` | Waiting screen, private room: big 44px code box | :573 | `test_pk_room_code_v1105.mjs:107` `/prCodeBig/`; `:108` `/font-size:44px/` |
| `#prCopy` | "📋 复制房间码" (states "✅ 已复制，去微信发给好友" / "长按上面的码复制") | :576 | `test_pk_room_code_v1105.mjs:109` `/prCopy/`; `:110` `/navigator\.clipboard/` and `/长按/` |
| `#prWaited` | Waiting "已等 N 秒" ticker | :627 | — (the watchdog keys on the "等对手进来" text) |
| `#prReMatch` | Ladder join-failed "⚡ 再找一次对手" | :712 (read :714) | Text checked indirectly (see §1c "被别人抢走\|再找一次") |
| `#prMy` | Battle: my score `<b>` | :958 | `test_pk_battle_ui_v1101.mjs:65` `/prMy/` |
| `#prOpp` | Battle: opponent score `<b>` | :973 | `test_pk_battle_ui_v1101.mjs:65` `/prOpp/`; **DOM**: `test_ladder_e2e_v1155.mjs:221` reads `#prOpp.textContent` and expects a number > 0; `hansen_guards_v1068.py:1867` requires the string `prOpp` in the e2e test |
| `#prClock` | Battle: "⏱ Ns" countdown span (red + scale ≤5 s) | :981 | `test_pk_battle_ui_v1101.mjs:71` `/prClock/` |
| `#prSpk` | Battle (TTS mode): 🔊 button | :989 | `test_pk_ask_mode_v1102.mjs:56,57,59,61` (in the askIsTts branch, no `w.cn`/`en.charAt(0)` before it) |
| `#prIn` | Battle answer `<input class="pr_in">`, `readonly inputmode="none"`, `aria-label="在这里拼出这个单词"`, placeholder "拼出这个词" | :1006-1010 | **DOM**: `test_ladder_e2e_v1155.mjs:249` `#prIn` must still exist after a network drop; static `test_pk_keyboard_v1118.mjs:34-36` |
| `#prHint` | Battle feedback line ("对手：<span#prOppSt>正在拼…</span>", "不对，再试试", round result) | :1011 | — |
| `#prOppSt` | Opponent status span ("正在拼…", "🔥 你抢先拼对！", "对手掉线了…N 秒后判他负", "🏆 对手已离场，本局你胜") | :1012, :1051 | `test_pk_battle_ui_v1101.mjs:78` `/prOppSt/` |
| `#prKb` | Battle on-screen keyboard container `.pr_kb` | :859 | — |
| `#prNetWarn` | Battle: "📶 网络不稳，正在重连…（进度不会丢）" bar appended into `.pr_wrap`, removed on recovery | created :1241 (get :1238, removed :1275) | **DOM**: `test_ladder_e2e_v1155.mjs:248`; static `test_ladder_v1108.mjs:205` (`prNetWarn` + `_netMiss === 5`) and `:208` (`_netMiss = 0;…{0,160}prNetWarn…{0,40}remove()`) |
| `#prAgain` | Result "再来一局" | :1808 | — (static `test_ladder_board_v1156.mjs:266` needs `HansenLadderUI.open()` followed within 300 chars by `ldGo`, see :1836) |
| `#prBack2` | Result "← 回到房间列表" | :1809 | — |
| `#ldGo` (foreign) | Read from the room UI to auto-click ladder start after "再来一局" | :1836 | `test_ladder_board_v1156.mjs:266` |

### 1b. Generated classes / data attributes / ARIA

| selector | element / screen | generated at | tested by |
|---|---|---|---|
| `.on` (on root) | Root visible state | `paint()` :135; ladder paths :1894, :1924; removed :154 | `test_ladder_v1108.mjs:151,159` and `test_ladder_e2e_v1155.mjs:331`: `classList.add('on')` within 400/300/700 chars of `function _createForLadder` / `_joinForLadder`, and **no** `lobby()` there. The watchdog falls back to `.on` on the parent. |
| `.pr_wrap` | Single inner wrapper of every screen | `paint()` :134; ladder placeholder :1896, :1926; queried :1247 | **DOM**: `test_ladder_e2e_v1155.mjs:103` (screen text), `test_ladder_contrast_v1156.mjs:142,155` (text contrast ≥4.5 / ≥3 for big text on battle and room-list screens), `test_pk_watchdog_v1155.mjs:103,254,292` (the test builds its own `.pr_wrap`, which constrains the watchdog selector) |
| `.pr_top` | Header row | :278, :518, :621, :705, :938, :1560 | — |
| `.pr_h` | Header title (also the battle score row :954) | :279, :518, :622, :706, :954, :1560 | — |
| `.pr_sub` | Subtitle / battle "第 i / n 词 · ⏱" | :519, :980 | — |
| `.pr_back` | Header back button | :278, :621, :705 | — |
| `.pr_btn`, `.pr_btn2`, `.pr_ghost` | Buttons (primary / secondary / ghost) | :220, :305-328, :523, :576, :712, :1808-1809 | — |
| `.pr_err` | Error block | :218 | — |
| `.pr_empty` | Empty/info text ("正在找房间…", "现在还没有人开房…", waiting info, "交卷了" info, result score line) | :313, :358, :399, :580, :631, :1561, :1704 | — |
| `.pr_room` + child `.n` | Room-list row (`<b>hostName</b>`, badge, tier, word count, age) | :374 | Contrast via `.pr_wrap` (`test_ladder_contrast_v1156.mjs:155`) |
| `button[data-rid]` | "进去打" join button per room (busy "进入中…") | :396; queried :402-403 | — |
| `.pr_mode[data-mode][role=button][tabindex=0][aria-label="选择玩法：X"]` | Mode-chooser cards A/B/C | :488-490; queried :530-531 | — |
| `.pr_ask[data-ask=cn\|tts]` | Ask-mode cards (看中文 / 听发音) | :510; queried :527-528 | `test_pk_ask_mode_v1102.mjs:91` `/data-ask/` |
| `.pr_cn` | Battle Chinese prompt (34px) | :991 | `test_pk_ask_mode_v1102.mjs:55` slices on the literal `'<div class="pr_cn"` |
| `.pr_word` | Battle first-letter hint (`en.charAt(0) + '_ '…`) | :992 | `test_pk_ask_mode_v1102.mjs:61` (`en.charAt(0)` must not precede `prSpk`) |
| `.pr_in` | Answer input class | :1006 | — |
| `.pr_kb`, `.pr_kbrow`, `.pr_indent` | Keyboard container / rows | :859-862 | **DOM** `test_tap_targets_v1120.mjs:122`: no `.pr_kbrow` wider than the viewport at 320/360/390/430 |
| `.pr_key[data-k][aria-label="字母 x"]` | Keyboard key | :868; queried :874 | **DOM** `test_tap_targets_v1120.mjs:121`: every `.pr_key` ≥27px wide |
| `.pr_key.pr_del[data-k="⌫"][aria-label="删除一个字母"]` | Backspace key | :863 | `test_pk_keyboard_v1118.mjs:48` `/pr_del/` within 900 chars of `function pkKeyboard` |
| `.pr_res` | Result headline (🎉 你赢了！ / 💪 这局输了 / 🤝 打平 / 🏆 对手已离场，本局你胜) | :1790 (CSS :116) | — |
| `@keyframes hsnWaitSpin` | Waiting hourglass animation | :616 | — |
| CSS vars `--pk-*` | Dark (`html:root{…}` :42) and light (`html.hsn-pal-light…{…}` :53) | :42-58 | `test_theme_v1110.mjs:45-56,65-71,80-88`; `test_pk_keyboard_v1118.mjs:64-72` (`--pk-kb-bg`, `--pk-key-bg`, light `--pk-key-fg` dark) |

All buttons on the battle screen: `test_tap_targets_v1120.mjs:95-103` requires **every** visible `button,a[href],[onclick],input[type=button]` to be at least 27×27 px (320×568 viewport).

### 1c. Visible text that tests assert on

| text | where generated | tested by | type |
|---|---|---|---|
| `等对手进来` (header "⏳ 等对手进来") | :622 | `test_ladder_e2e_v1155.mjs:157` (screen text after auto-create); watchdog regex | DOM |
| `被别人抢走` / `再找一次` ("这间房刚被别人抢走了", "⚡ 再找一次对手") | :709, :712 | `test_ladder_e2e_v1155.mjs:178` | DOM |
| `抢先拼对` ("🔥 你抢先拼对！") | :1366, :1513 | `test_pk_battle_ui_v1101.mjs:80`; `guard_copy_consistent` :2700 (only one of `🔥 你抢先拼对！` / `⚡ 抢先拼对了！`) | static |
| `掉线了…` ("对手掉线了…N 秒后判他负") | :1183 | `test_pk_abandon_v1104.mjs:111`; `guard_copy_consistent` forbids `+ 's 后判` | static |
| `对手已离场，本局你胜` | :1169, :1717 | `test_pk_abandon_v1104.mjs:116`; `guard_copy_consistent` (no "对手离场，本局你胜" variant); `jarvis_selftest.py:601` anchor `'🏆 对手已离场，本局你胜'` | static |
| `〔` (answer reveal ` 〔en cn〕`) | :1510 | `test_pk_ask_mode_v1102.mjs:85` | static |
| `天梯分` | result :1773 etc. | `test_pk_record_v1103.mjs:104` | static |
| `只有 ⚡ 抢答赛计分` / `不计天梯` | :1781 | `test_pk_record_v1103.mjs:105` | static |
| `长按` ("长按上面的码复制") | :673 | `test_pk_room_code_v1105.mjs:110` | static |
| `开私密房` (in a comment at :290) | — | `test_pk_room_code_v1105.mjs:114` | static, raw src |
| `点上面的「➕ 开一间」` and the button text `➕ 开一间` | :358, :306 | `guard_tip_matches_button`; jarvis anchor | guard |
| `未定级` (`return '未定级'`) | :272 | `test_ladder_board_v1156.mjs:288` | static |
| `/词库/.test(t)` | :212 | `guard_no_room_without_words` :3352 | guard |
| Watchdog waiting texts `正在找对手 / 等对手进来 / 等对手交卷 / 正在拼` | `等对手进来` :622, `正在等对手交卷…` :1564, `正在拼…` :1012/:1051 | `hansen_pk_watchdog_v1155.js:185,273` (rescue-timeout class); `test_pk_watchdog_v1155.mjs:42` asserts that regex in the watchdog | runtime |
| Not asserted but notable: "📨 交卷了" :1560, "正在等对手交卷…" :1564, "现在还没有人开房。…" :358, "正在开房间…" :1897/1927 | | | |

### 1d. Code-shape (static) constraints on this file

From `test_pk_battle_ui_v1101`, `_ask_mode_v1102`, `_keyboard_v1118`, `_abandon_v1104`, `_room_code_v1105`, `_modes_v1100`, `_record_v1103`, `room_match_v1135`, `ladder_v1108`, `ladder_e2e_v1155`, `ladder_board_v1156`, `pk_watchdog_v1155`, and the guards:
- Function names that must exist: `askRound` (with `words[idx]` within 3000 chars), `pollOpponent` (body contains `waitAll`), `submitRound` (body has `claimRound`, `askRound(idx + 1)`, `toFixed(1)`), `pkKeyboard` (row literals `'q','w',…'p'` / `'a',…'l'` / `'z',…'m'` and `pr_del` within 900 chars), `bindKeyboard` (within 1600 chars: `input.value += k`, `slice(0, -1)`, `submitRound(idx, true)`, `length < 24`), `stopKb`, `speak` (within 900 chars: `en-US`, `rate = 0.82`, `HansenTTSVolume`, `speechSynthesis.cancel`), `checkOpponentAlive`, `thisGameBlock`, `nextTierLine`, `tierText`, `numOr0`, `txtOf`, `esc(`, `showResult`, `finish() {` (jarvis anchor), `_createForLadder`, `_joinForLadder`, `waiting(r.roomId`.
- Literal fragments: `oninput`, `deadline`, `left <= 0…{0,80}submitRound`, `left <= 5 && left > 0`, `scale(1.45)`, `#fb923c`, `readonly inputmode="none"`, `_kbKeyHandler`, `/^[a-zA-Z]$/`, `removeEventListener('keydown', _kbKeyHandler)`, `ASK_MODES`, `cn: {`, `tts: {`, `askIsTts`, `setTimeout(function () { speak(en); }`, `spk.onclick…speak(en)`, `askMode: _askMode`, `S() && S().MODES` (no copied rule text like `抢答赛…先拼对 100`), `_goneChecked`, `HansenPkRecord`, `toUpperCase`, `navigator.clipboard`, `font-size:44px`, `pagehide`, `visibilityState !== 'hidden'`, `30000`, `_pickedMode = 'A'`, `hostRating`, `st.oppScore = _opp`, `_ob.textContent = String(_opp)`, `_waitResult > 22`, `byAbandon: true…{0,60}mine: score`, `)['catch'](function () {…_waitResult`, `_netMiss === 5`, `_lastStats` (`_lastStats = Object.assign` before the `_state = null;` that follows `function showResult`), `if (!w) return '';`, `if (!sm || !sm.placed) return '';`, no `.onclick = lobby;`, `_cameFromLadder`, `hostTier) return x.hostTier`, `L.tierOf(r)`, `_rt.bgLeft = Math.max(0, _rt.deadline - Date.now())`, `_rt.deadline = Date.now() + _rt.bgLeft`, `esc(st.oppName`, `esc(txtOf(w.cn))`, `_oppRating`, `oppRating: (_state && _state._oppRating)`, `if (first) st.st.firstWins++`, `HansenPkWatchdog.arm('开排位房')`, `HansenPkWatchdog.arm('进排位房')`, exports `_createForLadder\s*:` and `_joinForLadder\s*:`.
- Guards: `MAX_ROOMS` + `.slice(0, MAX_ROOMS` (`guard_list_capped`; jarvis anchor `rooms.slice(0, MAX_ROOMS).map` :373); `r.room.winners` followed within 500 chars by `Array.isArray` + `slice` (`guard_score_capped`; jarvis anchor `if (_ws.length > _wcap) _ws = _ws.slice(0, _wcap);` :1316); `skipRound` (`guard_round_advance_covers_noone_wins`); `r.mySide ||` (`guard_server_known_facts_not_guessed` :1363); `guard_no_orphan_state_fields` (every `st.x` / `_state.x` that is read must be assigned somewhere); `guard_theme_fg_follows_bg` (any CSS string with `background:var(--…)` must not set `color:` to a light hex).

### 1e. Public JS API (`window.HansenPkRoomUI`, :1965-2004)

| member | tests calling it |
|---|---|
| `open()` → `lobby()` | `test_ladder_contrast_v1156.mjs:165`; called by `hansen_sb_pk_v1022.js:262`, `spelling_pk.html:523`, friends `frPk`, ladder fallback |
| `close()` | `test_account_switch_v1142.mjs:414,421` (auth `notifyTabStale` must call `HansenPkRoomUI.close()` before `appendChild`); `closePeers()` in the ladder and friends UIs |
| `_startMatchForTest(words, oppName, askMode, mode, roomId?)` | `test_ladder_e2e_v1155.mjs:216,243`, `test_ladder_contrast_v1156.mjs:152`, `test_tap_targets_v1120.mjs:102,117`; required string in `guard_ladder_has_e2e` |
| `_createForLadder()`, `_joinForLadder(roomId)` | Called by the ladder UI (`hansen_ladder_ui_v1108.js:~716-738`); static `test_ladder_v1108.mjs:171-176` |
| `_stateForTest()`, `_rtForTest()` | Exported (no test currently calls them) |

Service-side APIs the tests call (`window.HansenPkRoom`, `hansen_pk_room_v1065.js`): `_setTransportForTest`, `_setMeForTest`, `_setDbForTest` (static), `createRoom`, `joinRoom`, `listRooms`, `leaveRoom`, `reportResult`, `wordsFromSeed`, `claimRound`, `MODES{A,B,C}.ranked/.waitAll/.rules`, `ABANDON_MS`, `opponentGone`, `claimAbandonWin`, `makeCode`, `findByCode`, `sweepMyDeadRooms`, `waitForOpponent`. The UI also uses `markReady`, `roundState`, `modeOf`, `stopHeartbeat`, `skipRound`.

---

## 2. `hansen_ladder_ui_v1108.js` — ladder home, matching, login/offline errors (root `#hsn_ladder_screen`)

### 2a. Ids

| selector | element / screen | generated at | tested by |
|---|---|---|---|
| `#hsn_ladder_screen` | Root overlay, `role=dialog`, `aria-label="天梯排位"`, `.on`, z-index 2147482000 (CSS :83) | `ID` :26; `host()` :170-177 | Not selected directly (tests use `.ld_wrap`) |
| `#hsn_ld_css` | Injected style | :79-81 | `test_theme_v1110.mjs` (`--hpk-*` vars) |
| `#ldX` | Close "×": `aria-label="关闭"` on the not-ready screen :226, `aria-label="关闭天梯排位"` on home :247 | :226, :247 | — |
| `#ldRetryOpen` | Not-ready screen "再试一次" (summary not ready, "还在准备中") | :233 | — |
| `#ldGo` | Home "⚡ 开始排位（找实力差不多的对手）" (also "对战模块还在加载…") | :264 | **DOM click**: `test_ladder_e2e_v1155.mjs:134,152,175,191,269,294`; `test_ladder_board_v1156.mjs:266` (static, from the room UI); `guard_ladder_has_e2e` needs the string `ldGo` in the e2e test |
| `#ldBoardCard` | Leaderboard card | :324 | — |
| `#ldBoard` | Leaderboard body ("正在看看大家打得怎么样…", rows, "暂时看不到排行榜", "🌱 还没有人上榜", "还没什么人上榜，你是第一个 🎈") | :326 | **DOM**: `test_ladder_board_v1156.mjs:122` (innerText has `小红`, `1420`, `(你)`, `🥇`) and `:135` (`/暂时看不到/`); static `:78` |
| `#ldCancel` | Matching "×" `aria-label="取消匹配"` :643; also the "×" `aria-label="关闭"` on need-login :798 and offline :831 | :643, :798, :831 | — |
| `#ldCancel2` | Matching "取消，回天梯" | :664 | — |
| `#ldGoLogin` | Need-login "去登录" / "重新登录" | :809 | — |
| `#ldLater` | Need-login secondary | :811 | — |
| `#ldRetry` | Offline "重新找对手" | :838 | Text checked by DOM (below) |
| `#pkLadder .pk_d` (foreign) | `refreshEntry()` rewrites the description of the spelling_pk.html entry card | :882-899 | Exported `_refreshEntryForTest` (no test calls it) |

### 2b. Classes

| selector | element | generated at | tested by |
|---|---|---|---|
| `.ld_wrap` | Inner wrapper of every screen (`paint()`) | :181 (CSS :86) | **DOM**: `test_ladder_e2e_v1155.mjs:103`; `test_ladder_board_v1156.mjs:136` (innerText must contain `开始排位` even when the board fails); `test_ladder_contrast_v1156.mjs:123` (contrast); watchdog :58 |
| `.on` | Root visible | :182; removed :191 | — |
| `.ld_top`, `.ld_h`, `.ld_x` | Header / title / close button | :226-227, :246-247, :642-644, :798-799, :831-832 | — |
| `.ld_card`, `.ld_tier`, `.ld_te`, `.ld_tn`, `.ld_ts` | Tier card (emoji / name / sub) | :250-253 | — |
| `.ld_bar` (+ `<i>` width%) | Placement progress bar ("定级赛 x / 3") | :258 | — |
| `.ld_btn`, `.ld_btn2` | Buttons | :233, :264, :664, :809, :811, :838 | — |
| `.ld_lbl` | Card labels ("我的实力", "🏅 排行榜", "最近对局") | :275, :288, :325, :332 | — |
| `.ld_grid`, `.ld_kv`, `.ld_k`, `.ld_v`, `.ld_vs` | Stats grid (`kv()` :346-351) | :289, :347-348 | — |
| `.ld_hi`, `.ld_w`, `.ld_l` | Recent-game row (`hiRow()` :353), win / loss colours | :356-358 (CSS :107) | — |
| `@keyframes hsnLdSeek` | Matching 🔍 wobble | :653 | — |
| CSS vars `--hpk-*` | Dark (`html:root{--hpk-…`) and light (`html.hsn-pal-light…` :64) | :50-75 | `test_theme_v1110.mjs` |

All ladder-home buttons ≥27px: `test_tap_targets_v1120.mjs:91` (opened via `page.click('#pkLadder')`).

### 2c. Visible text tests assert on

| text | where | tested by | type |
|---|---|---|---|
| `天梯排位` (header "🏆 天梯排位") | :246 (also :227, :799, :832) | `test_ladder_e2e_v1155.mjs:116` | DOM |
| `开始排位` (in `#ldGo`) | :264 | `test_ladder_board_v1156.mjs:138` | DOM |
| `连不上网络` / `重新找对手` | :835, :838 | `test_ladder_e2e_v1155.mjs:194` | DOM |
| `(你)`, `🥇` `🥈` `🥉`, names/ratings | renderBoard :519, :537 | `test_ladder_board_v1156.mjs:79-81,125-127` | DOM + static |
| `暂时看不到` (排行榜) | renderBoard | `test_ladder_board_v1156.mjs:140` | DOM |
| `胜率`, `抢先率`, `平均用时`, `最快一次`, `正确率`, `最高连胜`, `最近对局`, `不计分`, `定级赛` | open() :259-332, hiRow :364 | `test_ladder_v1108.mjs:99-104` | static |
| `大约再赢 `, `已经是最高段位`, `重新点燃`, `你是第一个` | :441, :~411, :~308, :552 | `test_ladder_board_v1156.mjs:163,165,173,240` | static |
| `正在找对手` ("⚡ 正在找对手…") | :644 | watchdog waiting regex (runtime) | runtime |

### 2d. Code-shape constraints

`matchBand(waited)`, `gap <= band`, `Math.min(4000,`, `gap > band * 2`, `waited >= (window.__hsnLadderWaitSec || 20)` (`test_ladder_v1108.mjs:81-89`); `function startMatching` with `if (_cancel) { try { _cancel(); }` in its first 400 chars, `lr && lr.ok === false`, `function showOffline` (:213-224); `HansenPkRoomUI._createForLadder` call (:175); `HansenPkWatchdog.arm('排位')` (`test_pk_watchdog_v1155.mjs:337`, `guard_pk_watchdog`); `function renderBoard`, `ldBoard`, `function nextTierBlock`, `sm.streak >= 2 ? kv('当前连胜'`, `kv('最高连胜'`, `if (x.rating === lastRating) x.rank = lastRank`, `var tied = `, `ranked.length === 1`, `gap.textContent = '···'` (`test_ladder_board_v1156.mjs`); `MAX_ROWS` + `.slice(0, MAX_ROWS` (`guard_list_capped`); `guard_no_orphan_state_fields`; `guard_theme_fg_follows_bg`.

### 2e. Public API (`window.HansenLadderUI = {open, close, _refreshEntryForTest}`, :910)

`open()` is called by `test_ladder_e2e_v1155.mjs:113,132,150,173,189,267,292`, `test_ladder_board_v1156.mjs:109`, `test_ladder_contrast_v1156.mjs:139`. `close()` is called by `test_ladder_e2e_v1155.mjs:271`, `test_ladder_contrast_v1156.mjs:143`, `test_tap_targets_v1120.mjs:92`, and the auth `notifyTabStale` (`test_account_switch_v1142.mjs:417`). Related hooks: `HansenLadderBoard.fetchTop` (overridden by tests), `HansenPkRecord.record/summary/_reset`, `HansenSilentWatch.clear/count`.

---

## 3. `hansen_sb_pk_v1022.js` — in-page 拼写大PK hub (`#hsn_pk_screen`, `k_*`)

### 3a. Ids

| selector | element | generated at | tested by |
|---|---|---|---|
| `#hsn_pk_screen` | Root overlay, `role=dialog`, `aria-label="拼写大PK"`, `.on`, z-index 2147483400 (CSS :54-55) | `ID` :26; `host()` :270-279 | **DOM** `test_pk_inpage_v1022.mjs:32-40` (`.on` after `openSpellPK()` on `island_animal.html`, opened in under 250 ms, no `#__hsn_pk_ov` iframe); palette.js light overrides |
| `#hsn_pk_css` | Style | :52, :91 | — |
| `#kBack` | "← 返回" `.k_back` | :107 | — |
| `#kMe` | Identity card `.k_me` (`.k_ava`, `.k_nm`, `.k_cid`, `.k_tier`, `.k_go`) | :111-125 | **DOM** `test_pk_inpage_v1022.mjs:35,47` (must exist) |
| `#kPull` | "☁️ 从云端恢复进度" `.k_ab.primary` (logged in) | :134 | `test_startup_restore_v1048.mjs:60` `/kPull/` + `/从云端恢复进度/` |
| `#kSwitch` | "🔄 切换账号" | :135 | `test_toast_v1156.mjs:139`: the body of the literal `q('kSwitch').onclick` must contain `HansenToast.ask` |
| `#kOut` | "🚪 退出登录" | :136 | `test_toast_v1156.mjs:139`: the same for `q('kOut').onclick` |
| `#kReg` | "🔐 注册 / 登录" (logged out) | :138 | — |
| `#kRooms` | Mode card "大PK · 公开房间" `.k_card.k_c1` | :143 | `test_pk_inpage_v1022.mjs:36` (computed, not asserted) |
| `#kLadder` | Mode card "天梯排位" `.k_card.k_c2` | :146 | `test_ladder_v1108.mjs:110` literal `kLadder').onclick = openLadder` (:263); `test_pk_inpage:37` (computed, not asserted) |
| `#kDiag` | "☁️ 云同步自检…" | :160 | — |

### 3b. Classes

`.k_hd` :107, `.k_back` :107, `.k_h1` :108 (**DOM** `test_pk_inpage_v1022.mjs:40,48`: computed colour luminance >150 in dark theme), `.k_sub` :108, `.k_me` / `.k_ava` / `.k_nm` / `.k_cid` / `.k_tier` / `.k_go` :111-125, `.k_tip` :129/:132/:139, `.k_acct` :134-138, `.k_ab` (+ `.primary`) :134-138/:160, `.k_card` + `.k_c1` / `.k_c2` :143/:146 (**DOM** `test_pk_inpage_v1022.mjs:38,47`: **exactly 2** `.k_card` in `#hsn_pk_screen`), `.k_ic` / `.k_t` / `.k_d` :143-148, `.k_sec` :151/:159/:163, `.k_grid` :151, `.k_it` / `.k_v` / `.k_l` :152-155 (**DOM** `test_pk_inpage_v1022.mjs:39,47`: **exactly 4** `.k_it`), `.k_note` :164, `.on` :285/:290/:297. All are also styled by the palette.js light overrides (§0).

### 3c. Text / code constraints

- `登录后自动分配` (code, :121) and `未定级` (:124) must appear in **both** this file (comment-stripped) and `spelling_pk.html` (`guard_no_parallel_pk_panel` :1221). The jarvis anchor `opacity:.85">登录后自动分配</span>` must exist (`jarvis_selftest.py:252`).
- `不会丢` and `都还在` (toast copy in the kSwitch/kOut handlers) (`test_toast_v1156.mjs:144`).
- `notReadyOr` must be used, and no `alert('…模块未加载` (`test_toast_v1156.mjs:65-71`).
- `reportFail` (`test_session_truth_v1059.mjs:248`).
- `从云端恢复进度` (`test_startup_restore_v1048.mjs:60`).
- `guard_page_wiring` / `test_page_wiring_v1063.mjs:57-59`: any page that includes `hansen_sb_pk_v1022` (or has `id="pkRooms"`) must also load `hansen_pk_room_v1065` and `hansen_pk_room_ui_v1065`.

### 3d. Public API

`window.HansenSbPK = {open, close, _render}` (:301). Tests reach it only through the island-page global `openSpellPK()` (`test_pk_inpage_v1022.mjs:30`; `island_animal.html:3264` calls `HansenSbPK.open()`, with an iframe fallback `#__hsn_pk_ov`).

---

## 4. `hansen_friends_ui_v1107.js` — `#hsn_friends_screen`

### 4a. Ids

| selector | element | generated at | tested by |
|---|---|---|---|
| `#hsn_friends_screen` | Root, `role=dialog`, `aria-label="好友"`, `.on`, z-index 2147482000 | `ID` :22; host :177-187 | — |
| `#hsn_fr_css` | Style | :79-81 | `test_theme_v1110.mjs` |
| `#frX` | Close "×" `aria-label="关闭好友"` | :251 | — |
| `#frGoLogin` | Not-logged-in "去登录" | :260 | — |
| `#frOn` / `#frHide` | Status toggles "🟢 在线" / "🌙 隐身" inside `.fr_st` (class `sel` when active) | :268, :269 | `test_friends_ui_v1107.mjs:79` `/frHide/` + `setStatus('hidden')` |
| `#frCid` | Add-friend `<input class="fr_in" inputmode=numeric>`, `aria-label="输入好友的竞赛 ID 数字"` | :283-285 | — |
| `#frAdd` | "加好友" (busy "添加中…") | :286 | — |
| `#frCidTip` | Inline add-result tip | :394 | — |
| `#frList` | Friends list container | :297 | — |
| `#frBack` | Detail "←" `aria-label="返回好友列表"` | :431 | — |
| `#frSent` | Detail quick-message status | :450 | — |
| `#frPk` | Detail "⚔️ 开个房间叫他来打" → `HansenPkRoomUI.open()` | :453 | — |
| `#frDel` | Detail "删除好友" | :455 | — |

### 4b. Classes / data attributes

`.fr_wrap` :191, `.on` :192/:200, `.fr_top` / `.fr_h` / `.fr_x` :250-251/:431-432, `.fr_card` :254/:265/:280/:295/:434/:444, `.fr_btn` / `.fr_btn2` :260/:286/:453/:455, `.fr_lbl` :266/:281/:296/:445, `.fr_st` + `div.sel` :267 (CSS :114-116; `guard_theme_fg_follows_bg` incident; jarvis anchor `background:var(--hpk-sel-bg);color:var(--hpk-txt)!important` :116), `.fr_row` :282, `.fr_in` :283, `.fr_empty` :298/:300/:321/:331, `.fr_item.on2` / `.fr_item.off` `[data-i]` :335, `.fr_av` :336/:435, `.fr_dot` :336/:437, `.fr_nm` :338, `.fr_sub` :339, `.fr_q[data-q]` :447.

Static CSS tests (`test_friends_ui_v1107.mjs:25-30`): `.fr_item.off{opacity:.45}` (:102), `fr_item.on2 .fr_av{…box-shadow` (:105), `fr_dot{…#22c55e` (:106-107), the literal `f.online ? 'on2' : 'off'`, and the literal `f.online ? '<span class="fr_dot">`.

All friends-page buttons ≥27px: `test_tap_targets_v1120.mjs:93` (opened via `page.click('#pkFriends')`).

### 4c. Text / code constraints

`不能打字` (:445), `网页不能像 App 那样一直挂着` (:275), `隐身时好友看到的你和「不在线」一模一样` (:273), and **no** `在线中` (comment-stripped). `function detail` must contain no `<input`, `textarea` or `contenteditable` within 3000 chars, and must use `QUICK.map`, `sendQuick(f.cid, qid)` and `没发出去` (`test_friends_ui_v1107.mjs:41-81`). Guards: `MAX_FRIENDS` + `.slice(0, MAX_FRIENDS` (`guard_list_capped`), `guard_no_orphan_state_fields`, `guard_theme_fg_follows_bg`. Theme vars: `--hpk-*` (`test_theme_v1110`).

### 4d. Public API

`window.HansenFriendsUI = {open, close, _detail}` (:485). `close()` is called by `test_tap_targets_v1120.mjs:94` and the auth `notifyTabStale` (`test_account_switch_v1142.mjs:417`). The service `HansenFriends._setTransportForTest`, `sendQuick` and `QUICK` are used in `test_friends_v1106.mjs`.

---

## 5. `spelling_pk.html` — standalone hub page

### 5a. Ids / classes (static markup unless noted)

| selector | element | at | tested by |
|---|---|---|---|
| `#hsnSelfRescue` | Inline file:// self-rescue script (must be inline) | :21 | `hansen_guards_v1068.py:1484-1491` |
| `.pk_screen#pkHome.on` | Home screen | :110 | — |
| `.pk_hd`, `a.pk_back[href=index.html]`, `.pk_h1`, `.pk_sub` | Header | :111-114 | palette overrides |
| `#pkMe.pk_me` | Identity card (renderMe :223 → `.pk_ava .pk_nm .pk_cid .pk_tier .pk_go`) | :116, :254-259 | — |
| `#pkAcct` | Account area (renderAcct :271) | :117 | — |
| `#pkReg` `.pk_ab.primary` | "🔐 注册 / 登录" (logged out, JS) | :298 | **DOM** `test_pk_account_v1016.mjs:25-38`: exists when logged out, white text (lum >200), click opens `#hsn_auth_panel.on`, absent when logged in |
| `#pkSwitch` / `#pkOut` `.pk_ab` | "🔄 切换账号" / "🚪 退出登录" (logged in, JS) | :285-286 | **DOM** `test_pk_account_v1016.mjs:29,32,44,50,53`: absent when logged out, present when logged in; pkSwitch colour lum <130 light / >150 dark |
| `.pk_acct_tip` | Account tip ("✅ 已登录 …") | :275, :284, :299 | **DOM** `test_pk_account_v1016.mjs:45,52` contains `已登录` |
| `.pk_acct` | Account button row | :285, :298 | — |
| `#pkRooms` `.pk_card.pk_c1` | Entry "大PK · 公开房间" | :119 | **DOM** `test_real_path_smoke_v1163.mjs:162,170` (`el.onclick` must be a function); `test_page_wiring_v1063.mjs:57` + `guard_page_wiring` :183 (`id="pkRooms"` marks a PK page) |
| `#pkFriends` `.pk_card.pk_c1` | Entry "我的好友" | :126 | **DOM** `test_real_path_smoke_v1163.mjs:162,172` (onclick function), `test_tap_targets_v1120.mjs:93` (click); static `test_friends_ui_v1107.mjs:73` |
| `#pkLadder` `.pk_card.pk_c2` (+ `.pk_d` rewritten by the ladder `refreshEntry`) | Entry "天梯排位" | :132 | **DOM** `test_real_path_smoke_v1163.mjs:162,171`, `test_tap_targets_v1120.mjs:91` (click); `guard_no_double_binding` :3628; jarvis anchor `  var _lb = document.getElementById('pkLadder');` (:556) |
| `.pk_ic`, `.pk_t`, `.pk_d` | Card parts | :120-135 | — |
| `.pk_sec`, `#pkGlance` (`.pk_grid` > `.pk_it` > `.pk_v`/`.pk_l`) | "📊 我的战绩" glance | :138-139, :340-344 | — |
| `.pk_screen#pkRoomScreen`, `#pkRoomList`, `#pkCreate.pk_btn`, `.pk_empty` | Legacy rooms sub-screen (placeholder) | :143-149, :452/:457 | — |
| `.pk_screen#pkLadderScreen`, `#pkLadderBody`, `#pkMatch.pk_btn`, `.pk_row`, `.pk_note` | Legacy ladder sub-screen | :153-158, :489-510 | — |
| `button.pk_back[data-home="1"]` | Sub-screen back buttons (bound :531-532) | :145, :155 | — |
| `#pkNameAsk.pk_screen`, `#pkNameBack`, `#pkNameIn`, `#pkNameOk.pk_card`, `#pkNameErr` | "✏️ 先起个名字" identity gate (`askName` / `requireIdentity` :432) that blocks the PK / ladder / friends entries | :387-421 | Indirect: `test_tap_targets_v1120.mjs:56-62` pre-seeds `hansen_sb_profile_v1002` so this gate does not block |

### 5b. Static / guard constraints on the page

- Must contain the strings `HansenLadderUI` (`test_ladder_v1108.mjs:113`), `HansenFriendsUI` and `pkFriends` (`test_friends_ui_v1107.mjs:73-74`).
- `hsn-profile-reset` listener must come before `function renderMe`, within 800 chars (`test_account_switch_v1142.mjs:91-98`; currently :215 vs :223).
- Every `readLadder()` call must have `HansenPkRecord` within the next 25 lines (`guard_ladder_one_source`; jarvis anchor `var _R3 = window.HansenPkRecord;` :472).
- `登录后自动分配` and `未定级` must be present (`guard_no_parallel_pk_panel`).
- No variable may get `.onclick =` twice (regex `(\w+)\s*\)?\.onclick\s*=`, except `b`/`btn`/`el`) (`guard_no_double_binding`; `test_real_path_smoke_v1163.mjs:175-180`). The entries must be bound with **`.onclick =`** (not `addEventListener`), because the smoke test checks `typeof el.onclick === 'function'`.
- Script tags and order:
  - `<script … vocab_all …>` before `hansen_pk_room_v1065` (`guard_pk_page_has_vocab`; jarvis anchor `<script defer src="vocab_all.js?v=1163"></script>` :186).
  - `hansen_pk_watchdog_v1155.js` after `hansen_sw_upgrade_gate_v944.js` (`test_pk_watchdog_v1155.mjs:322-330`, `guard_pk_watchdog`).
  - `hansen_silent_watch_v1155.js` after the SW gate (`test_silent_watch_v1155.mjs:77-92`).
  - `hansen_tts_volume` loaded early, not deferred (`test_tts_volume_v1032.mjs:22-28`, `guard_page_wiring`).
  - Must load `hansen_pk_room_v1065` and `hansen_pk_room_ui_v1065` (`guard_page_wiring`).
  - Must have the cloud-save + auth + restore + signup-gate set (`test_page_wiring_v1063`, `test_account_wiring_v1021`).
  - No 404s (`test_real_path_smoke_v1163.mjs:201-205`).
- Runtime globals that must exist (`test_real_path_smoke_v1163.mjs:99-116`): `HansenPkRoom`, `HansenPkRoomUI`, `HansenAuth` (with `_app()` returning a Promise), `HansenLadderUI`, `HansenSbProfile`, and `HANSEN_VOCAB_ALL` (>100 words).
- Version stamps: every `?v=NNN` in any `.html` / `.js` must equal `VERSION` (`check_resources.py:47-60`; `guard` ⑤; jarvis `_inj_stamp` on spelling_pk). Any new asset URL with `?v=` must follow this.

---

## 6. Summary: what a redesign can and cannot rename freely

**DOM-selected by Playwright, so they must keep their name (or the tests change):**
- `.pr_wrap` (+ the parent `.on` fallback), `#prOpp` (numeric textContent), `#prIn`, `#prNetWarn`, `.pr_key` (≥27px wide), `.pr_kbrow` (fits the viewport).
- `.ld_wrap`, `#ldGo` (clickable), `#ldBoard`.
- `#hsn_pk_screen.on`, `#kMe`, `.k_card` ×2, `.k_it` ×4, `.k_h1` (light text in dark theme).
- `#pkRooms` / `#pkLadder` / `#pkFriends` (onclick property, clickable), `#pkReg` / `#pkSwitch` / `#pkOut`, `.pk_acct_tip`.

**Text asserted on screens:** `天梯排位`, `开始排位`, `等对手进来`, `被别人抢走|再找一次`, `连不上网络|重新找对手`, `暂时看不到`, `(你)`, `🥇`, `已登录`. Watchdog waiting tokens: `正在找对手|等对手进来|等对手交卷|正在拼`.

**Visual / interaction contracts:**
- Text contrast ≥4.5 (≥3 for big text) on `.ld_wrap` and `.pr_wrap` (battle and room list).
- All tap targets ≥27×27 on the PK home, ladder, friends and battle screens.
- Dark/light via `--pk-*` (room UI) and `--hpk-*` (ladder, friends) on `html:root` / `html.hsn-pal-light`, with no `var()` inside variable definitions, ≤2 hard-coded non-white `color:#hex`, no clash with palette.js variable names, and ≥12 variables.

**Everything else** (most `pr*` ids, all `pr_*` / `ld_*` / `fr_*` / `k_*` presentational classes) is not DOM-selected by tests. However, many ids are grepped as **literal strings in source**: `prMy`, `prOpp`, `prOppSt`, `prClock`, `prSpk`, `prCode`, `prCodeBig`, `prCopy`, `prJoinCode`, `prNetWarn`, `pr_del`, `pr_cn` (as `'<div class="pr_cn"`), `data-ask`, `ldBoard`, `ldGo`, `kLadder`, `kPull`, `kSwitch`, `kOut`, `frHide`, `fr_item.off/on2`, `fr_dot`, `pkFriends`. So a rename needs a matching edit to the static tests listed above.

## 7. Test / guard files that touch these modules (keep their names; `hansen_bug_registry.py` references several)

- **DOM tests:** `test_ladder_e2e_v1155.mjs`, `test_ladder_board_v1156.mjs`, `test_ladder_contrast_v1156.mjs`, `test_tap_targets_v1120.mjs`, `test_pk_inpage_v1022.mjs`, `test_pk_account_v1016.mjs`, `test_real_path_smoke_v1163.mjs`, `test_pk_watchdog_v1155.mjs`, `test_toast_v1156.mjs` (toast part), `test_account_wiring_v1021.mjs` (page-level only).
- **Static tests:** `test_pk_battle_ui_v1101.mjs`, `test_pk_ask_mode_v1102.mjs`, `test_pk_keyboard_v1118.mjs`, `test_pk_abandon_v1104.mjs`, `test_pk_room_code_v1105.mjs`, `test_pk_modes_v1100.mjs`, `test_pk_record_v1103.mjs`, `test_room_match_v1135.mjs`, `test_ladder_v1108.mjs`, `test_friends_ui_v1107.mjs`, `test_theme_v1110.mjs`, `test_page_wiring_v1063.mjs`, `test_account_switch_v1142.mjs`, `test_silent_watch_v1155.mjs`, `test_tts_volume_v1032.mjs`, `test_startup_restore_v1048.mjs`, `test_session_truth_v1059.mjs`.
- **Service-only tests (no DOM):** `test_pk_room_v1065.mjs`, `test_friends_v1106.mjs`.
- **Guards** (`hansen_guards_v1068.py`): `guard_page_wiring` :161, `guard_theme_fg_follows_bg` :1146, `guard_no_parallel_pk_panel` :1221, `guard_no_orphan_state_fields` :1295, `guard_round_advance_covers_noone_wins` :1373, `guard_server_known_facts_not_guessed` :1389, `guard_ladder_has_e2e` :1830, `guard_pk_watchdog` :1874, `guard_tip_matches_button` :2639, `guard_copy_consistent` :2673, `guard_ladder_one_source` :2925, `guard_list_capped` :2967, `guard_pk_page_has_vocab` :3232, `guard_no_room_without_words` :3318, `guard_score_capped` :3547, `guard_no_double_binding` :3628. Plus the self-rescue check (~:1484) and the stamp guard ⑤.
- **Mutation anchors** (`jarvis_selftest.py`): `_inj_theme_fg`, `_inj_panel_drift`, `_inj_orphan_field`, `_inj_tip_button`, `_inj_copy`, `_inj_ladder_source`, `_inj_list_cap`, `_inj_pk_vocab`, `_inj_score_cap`, `_inj_double_bind`, `_inj_stamp`. All anchors exist today (verified, count ≥1).
