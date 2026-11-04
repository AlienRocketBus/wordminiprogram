# protocol lens — skeptic round 1 (independent reproductions; own helpers in slib.mjs, own patched emulator emu_dup.mjs)
Run: HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs node <script> [args]

| finding | script / args | result |
|---|---|---|
| F1a | sk_f1a_seat_race.mjs 1500/2500 request_failed | losers taken,taken (OK) |
| F1a | sk_f1a_seat_race.mjs 3500 request_failed / duplicate_write | losers kind=config 「云端设置还差一步…DATABASE_REQUEST_FAILED / DUPLICATE_WRITE」 |
| F1a | sk_f1a_seat_race.mjs 3500 http500 | taken,taken (retries delay the read-back) |
| F1b | sk_f1b_lost_reply.mjs 3 | join=config but seat is guest's + room playing with him; claimRound ok:false config while W0 winner=guest (host sees ["guest"]); createRoom=config while room open+listed to strangers |
| F1c | sk_f1c_variants.mjs 2 abort | all OK (needs 3 consecutive failed reads) |
| F1c | sk_f1c_variants.mjs 1 hang | ONE hung read (9 s > 8 s timeout) -> join/create config again |
| F2 | sk_f2_abandon.mjs | returning guest opponentGone {oppFinished:true}; claimRound x3 first:true 100 in done room; reportResult lose byAbandon; mirror same |
| F2 | sk_f2_ui_return.mjs 68 | real UI: guest words 4-10 「🔥 你抢先拼对！ +100」, final 「⌛ 你离开太久，这局判给了对手 你 700 分 · 对手 0 分」 |
| F3a | sk_f3_room_vanishes.mjs a | host leaveRoom with ACK pending removes R; guest opponentGone/roundState {ok:false,kind:gone}; claimRound first:true; reportResult gone |
| F3b | sk_f3_room_vanishes.mjs b | (grace 5 s stand-in) host sweep removes done room; same guest outcome |
| F4 | sk_f4_shared_outage.mjs 70 4 | both sides gone+claimAbandonWin in 3/4 runs (room abandonWin=host, seat abandonWin=guest) |
| F5 | sk_ui_deadlines.mjs 0 A ; sk_ui_spread.mjs A/A/C/B | A: skip lands at host 「⏱ 2s」 -> correct word 「⏱ 超时了」 score unchanged (x3); C: only correct speller +60; B: +80 |
| F6 | sk_f6_lag_ceiling.mjs 4000/4600/5000 1 2 | 4000 none; 4600/5000 host {gone} at 4.2 s (room open on server) |
| F6 | sk_f6b_ack.mjs 5000/6000 2 4 | 5000: 4/4 ok (11-15.3 s); 6000: 2/4 「房主没有回应」 while room playing with that guest |
| F7 | sk_ui_deadlines.mjs 600000 / -15000 | +10 min: guest word-2 clock 613 s, stuck on word 2 (588 s) after host moved on; -15 s: guest word 2 lasted ~3 s, sides desync |
| F8 | sk_f8_skew_rooms.mjs | slow host (-60 s) not listed / code not found / join 「房主已经离开了」; ladder slow-first no event in 40 s vs control switchTo 4 s; fast (+10 min) dead host listed at 45 s, join 16 s 「房主没有回应」 |
| F9/F10 | sk_f9f10_stranger.mjs | forged W0..W3 accepted (host first:true / guest 0 / '' squat 0); 40 future-dated fakes hide the real room; join fake 16 s; 8 squatted seats -> taken x3, seat 2->4->6 |
| F11 | sk_f11_kicked.mjs | G1 writes fail 20 s -> host unacks at 22.6 s; G1 skip W0='' -> G2's correct word 1 = first:false 0; G1 opponentGone {gone,left,kicked}; claimAbandonWin win |
| F12 | sk_f12_backwards.mjs | after seeing abandonWin=host, one read 1.5 s behind -> reportResult {mine:500,theirs:1,result:'win'}; caught up -> lose |
| F13 | sk_f13_dup_silent.mjs silent/overwrite/silent 0/request_failed 400 | both first 4/4, 4/4, 0/4, 0/4 |
| X1 | sk_x1b_watchdog.mjs tap / direct | rescue 「这一局卡住了」 over idle new-player ladder home at 25 s (both entry paths). sk_x1_watchdog.mjs printed null only because it tested offsetParent of a position:fixed overlay (my bug) |
