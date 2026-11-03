# room-protocol lens — experiment log (real page + real SDK 2.30.0, network = repo cloudbase_emulator.mjs)

Run any script: `cd <this dir> && HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs node <script> [args]`
Helpers: lib.mjs (N phones, drives window.HansenPkRoom like the UI; optional clock-skewed phone), emulator_dupstyles.mjs (copy of the
repo emulator + duplicateStyle 'silent'|'overwrite').

| exp | args | key output |
|---|---|---|
| exp1_seat_race_lag.mjs | 400 request_failed | losers taken,taken (control) |
| exp1_seat_race_lag.mjs | 2600 / 3000 request_failed | losers taken,taken |
| exp1_seat_race_lag.mjs | 3500 request_failed | losers kind=config 「云端设置还差一步：云端拒绝了这次操作（DATABASE_REQUEST_FAILED）…⟨…E11000 duplicate key…⟩」 |
| exp1_seat_race_lag.mjs | 3500 http500 / 4800 http500 | taken,taken / network,network 「连不上网络」 |
| exp4_lost_response_flaky.mjs | (lag 0) | (a) join kind=config, seat on server created by guest, 6 s later room playing with that guest; (b) claimRound ok:false kind=config while W0 winner=guest created by guest, host sees winners ["guest"] |
| exp4c_create_lost_response.mjs | | createRoom kind=config; room exists, open, listed to others |
| exp17_ladder_race_ui.mjs | 3500 | UI ladder: loser lands on 「🛠️ 云端设置还差一步 … 这不是你的问题，把这一屏截图发给负责的老师就好 … 技术信息：DATABASE_REQUEST_FAILED … E11000」 |
| exp3_own_room_gone_lag.mjs | 5000 / 4000 | host gets {gone} 4.3 s after creating (2/2) / no event (2/2) |
| exp2_ack_window_lag.mjs | 4200 42 / 5000 42 | joins ok after 14.1/11.7 s / 15.1/12.9 s |
| exp2b_ack_window_phases.mjs | 6000 42 | 3/4 ok; 1/4 「房主没有回应，换一间吧」 after 16.2 s although room playing+guestId at 11.1 s; seat removed |
| exp5_abandon_shadowed.mjs | | returning guest opponentGone → {oppFinished:true} (not ended); claimRound in done room → first:true 100; only reportResult says lose; same for host side |
| exp15_ui_returning_player.mjs | | UI: returning guest plays words 5–10 「🔥 你抢先拼对！ +100」×6, then 「⌛ 你离开太久，这局判给了对手 / 你 600 分 · 对手 100 分」 |
| exp6_room_removed_after_ack.mjs | | host leaveRoom during ACK wait removes room; guest in match: opponentGone/roundState {ok:false,kind:gone} ×3; claimRound first:true; reportResult gone |
| exp6b_swept_after_abandon.mjs | | room swept after grace; returning guest: opponentGone/roundState gone; claimRound ok; reportResult gone |
| exp12_both_frozen.mjs | | 70 s shared outage → both opponentGone gone:true idle 79 s → both claimAbandonWin ok (room abandonWin=host, seat abandonWin=guest) |
| exp9_ui_round_deadlines.mjs | 0 | UI A mode: guest skip W1 landed while host clock 「⏱ 2s」; host types correct word → 「⏱ 超时了 〔orange 橙色〕」, score unchanged |
| exp9_ui_round_deadlines.mjs | 600000 | guest word-2 clock 「⏱ 617s」; 26 s later host on word 3, guest still word 2 「⏱ 591s」, W1="" |
| exp9_ui_round_deadlines.mjs | -15000 | guest word-2 clock starts at 「⏱ 2s」 (host 18 s) |
| exp8_clock_skew_rooms.mjs | | host clock −60 s: not listed, findByCode 「没找到这间房」, joinRoom 「房主已经离开了」; ladder slow-first: no event in 40 s (control: switchTo in 5 s); fast-clock dead host: still listed after 45 s, join 15 s 「房主没有回应」 |
| exp7_squatting.mjs | | stranger's W0 (by forged host key) accepted: host claimRound first:true 100, guest 0; winners decided before anyone typed; 8 squatted seats → guest 'taken' at t+2/7/11 s while host bumps 2→4→6 |
| exp16_list_flood.mjs | | 40 fake rooms (future createdAt) → guest list = 40 fakes, real room not listed; join fake → 16 s 「房主没有回应」 |
| exp13_kicked_guest_wins.mjs | | G1 (uplink failing) replaced after 21 s; G1's skip W0 makes real match word 1 '' (G2 first:false 0); G1 opponentGone {gone,left,kicked} with hostReady true → UI awards win; claimAbandonWin ok |
| exp11_stale_read_verdict.mjs | | one backwards read: guest reportResult {mine:500, theirs:1, result:'win'} after seeing abandonWin=host |
| exp10_dup_silent.mjs | silent 400 / overwrite 400 / silent 0 | both first:true on 4/4 words / 4/4 / 0/4 |
| exp14_ladder_n_hosts_ui.mjs | 3 400 / 4 400 / 3 1500 | all paired (2/3, 4/4, 2/3) — OK |
| exp18_watchdog_ladder_home.mjs | | incidental: idle ladder home (new player) → 「🛠️ 这一局卡住了」 overlay after 25 s |
