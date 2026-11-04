UI-flows lens · round 1 · experiments (real pages + real vendored SDK 2.30.0; only Tencent network = repo cloudbase_emulator.mjs; touch taps)
Run from /home/claude/work/repo with HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs
  node <scratch>/review/ui-flows/<exp>.mjs [args]
Repo state during all runs: clean at 47a97f9 (= full v1164 change vs 73e1b69).

exp1_bc_scoring.mjs C|B|A   correct answer after the opponent's timeout
  C: 房主 still had 974 ms (⏱ 1s), spelled 「straight」, nobody else did -> "✅ 拼对了 +60 分 · 14.9s 〔straight 直走〕" score 60 (rule: 先拼对 100)
  B: same -> "✅ 拼对了 +80 分 · 14.9s 〔sheep 羊〕" score 80
  A: 946 ms left (⏱ 1s), spelled 「park」 -> "⏱ 超时了 〔park 公园〕" score 0
  word-1 deadlines: host - guest = +1033..+1096 ms in all runs (guest starts first; host waits for acked)
  OK: 两人都答完才翻篇 (X stayed on word 2 for 4 s until Y answered), second correct = 60/80
exp2_census.mjs 10           10× ladder open/开始排位/×/×, 10× lobby open/back, 10× 开一间/关掉房间: no interval / listener growth, no background DB polling
exp3b_ldgo_double.mjs        double tap 开始排位 at (195,313) on 390x844, 360x640, 375x667: 1st tap paints 「取消，回天梯」 exactly under the finger -> back on ladder home
exp3d_cancel_double.mjs      double tap 「取消，回天梯」 at (195,335): 2nd finger lands on #ldGo -> "× ⚡ 正在找对手… 已等 1 秒"
exp3c_mode_card_double.mjs   double tap a mode card: 1 room but 2 waiting timers, 16 vs 8 room/seat reads per 10 s, 5 vs 2 requests after 关掉房间
exp4_index_back.mjs          index.html -> island iframe -> 拼写大PK -> 天梯 -> 开始排位 -> 等对手进来 -> history.back():
                             wrapper display=none, iframe visibilityState=visible, data layer still host of the room; 35 s later room open, heartbeat 5.5 s old;
                             2nd phone matched into it (battle); kid re-opens island -> "你 0 ⚡抢答赛 0 小蜂己 第 3 / 10 词 · ⏱ 16s …"
exp5_counter.mjs / exp5b_counter_lat.mjs (LAT=110/160/210/260)
                             「已等 N 秒」: 20@matching -> 0@waiting (≈1 s) -> 22 ; at other latencies 21 -> 0 -> 23 (22 skipped)
exp6_join_cancel.mjs 500 700 取消 tapped 720 ms after 进去打 (seat claim in flight): screen stayed on 「正在进房，等房主确认…」 16932 ms, counter 0..17 kept running
exp7_name_screen.mjs         「明」 / 「管理员小明」 + 开始吧: no error, name not saved, ladder opens, room hostName 「无名蜂」, name screen again next time
exp8_island_reentry.mjs      island tap identity bar -> #hsb_prof on, z 70, top layer still 拼写大PK (hidden behind);
                             full ranked game island vs page, 再来一局 on island -> matching on top -> rematch forms (OK)
exp9_background.mjs          a) waiting room hidden 33 s -> room removed + 「你切出去太久…」 (OK) but list shows 「同一个账号在另一台设备上开着房…」
                             b) 开始排位 then hidden: 26 s later the hidden phone owns a ranked room; another kid is matched into a battle while it is hidden
                             c) hidden 8 s mid-word -> ≈7974 ms given back (v1126 cap is 3 s)
exp10_timeouts.mjs           lobby room 2-min timeout -> 「等了两分钟还没人来…」 then 3 s later 「同一个账号在另一台设备上开着房，要用另一个账号才能对战」 (own room);
                             ladder timeout -> 「暂时没有对手，等会儿再来」 (OK); tap 开始排位 again -> matching screen shows the same false hint
exp11_kinds.mjs              taken/gone/self/network-mid-wait (lobby + ranked)/slow texts all sensible (log: exp11.log)
exp12_reload.mjs             reload on 等对手进来 -> room removed; reload on 正在进房 -> seat removed, host back to clean open room (OK)
exp13_game_census.mjs        full mode-B game 900:900 both sides, 再来一局 -> new room -> close: no timers/pollers left, 0 DB requests in 15 s (OK)
exp14_rescue.mjs             rescue 重新找对手 -> matching on top; 回到大PK首页 -> island PK screen; no rescue loop (OK)
exp15_free_a_elo.mjs         free 抢答赛 room (ranked): guest 1000 -> 1020 (vs real host rating 1400 should be 1036); room hostRating 0 on server
