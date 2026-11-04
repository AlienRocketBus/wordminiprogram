UI-flows SKEPTIC · round 1 · own experiments (real pages + vendored SDK; network = repo cloudbase_emulator.mjs; touch taps)
Repo at 6573808 (code identical to 47a97f9). Run: cd /home/claude/work/repo && HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs node <this dir>/<x>.mjs [args]

UI-1  x1_island_back.mjs free|ladder|battle [wait]  (island_food, page.goBack())
      free:   wrapper none, iframe visible, data layer host; 35 s later room open, beat 3.4 s; other kid lists + joins; ghost battle;
              kid re-opens island -> "你 0 🔥同步赛 400 小F 第 4 / 10 词 · ⏱ 14s"
      ladder: ranked room open 35 s later; other kid matched; hidden kid finishes -> record losses 1, "💪 这局输了 … 🛡 段位保护 … 再打 2 局定级赛"
      battle: back mid-battle; other kid waits each word "⏳ 对手还在拼这一词，等他一下（最多 14 秒）"
UI-2  x2_scoring.mjs C|B|A, x2b_a_word2.mjs
      C: host 677 ms on own clock (⏱ 1s) after guest's W0(winner '') -> "✅ 拼对了 +60 分 · 14.5s 〔neck 脖子〕"
      B: 657 ms -> "+80"; A: 576 ms -> "⏱ 超时了 〔airport 机场〕" score 0; word-1 host−guest deadline 805–847 ms
      A word 2: winner of word 1 starts 1590 ms later; 904 ms left -> "⏱ 超时了 〔tiger 老虎〕"
UI-3  x3_join_cancel.mjs 500 <delay>: 321 ms -> stuck 17468 ms (counter 0..17); 720 ms ×2 -> 3.0 s; 1118/1523 ms -> 2.8/2.3 s
UI-4  x4_same_account.mjs timeout|bg|ladder <lag>: timeout (real 2 min, lag 0) and bg (31 s hidden, lag 0): warning shown at once and
      persists (own room already removed); ladder: lag 800 + immediate 开始排位 -> warning ~2.5 s; lag 0 -> none
UI-5  x5_double_tap.mjs 150 390x844|360x640: both directions reproduce (unplaced kid). x5b_placed.mjs: placed kid -> old point is a div (no overlap)
UI-6  x6_mode_double.mjs: single 1 timer / 10 queries per 10 s / 2 req after close; double 2 timers / 20 queries / +3 queries on removed room.
      x6b_double_join.mjs: guest still joins fine (2/2) — impact = duplicate polling
UI-7  x7_counter.mjs: ldWaited 21 -> prWaited 0 (≈1 s) -> 22
UI-8  x8_name.mjs 明 | 管理员小明: no error, name "", ladder opens, room hostName "无名蜂", name screen again next time
UI-9  x9_island_profile.mjs: #hsb_prof on z 70 under #hsn_pk_screen z 2147483400; screen unchanged; profile only appears after ← 返回
UI-10 x10_bg.mjs ui10, x10b_bg_nojoin.mjs (visibility emulated, timers running): self-hosts 20 s after hiding; other kid matched;
      room still open & listed 35/50/62 s after hiding (30 s clean-up never fires)
UI-11 x10_bg.mjs ui11 8000: hidden 8009 ms -> ≈7992 ms given back (cap 3000)
UI-12 x12_free_a_elo.mjs: free A room hostRating 0; guest oppRating 0 -> +20 (1020) vs real 1400 -> 1036; host side oppRating = real
