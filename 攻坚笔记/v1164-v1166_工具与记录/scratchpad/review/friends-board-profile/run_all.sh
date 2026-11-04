#!/bin/bash
export HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs
D=/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/friends-board-profile
cd $D
LAGMODE=rand LAGMIN=300 LAGMAX=1500 N=4 ROUNDS=5 timeout 900 node e1_cid_race.mjs > out_e1_rand_300_1500_n4.txt 2>&1
LAGMODE=rand LAGMIN=300 LAGMAX=1500 N=2 ROUNDS=6 timeout 900 node e1_cid_race.mjs > out_e1_rand_300_1500_n2.txt 2>&1
LAG=1500 N=4 ROUNDS=2 timeout 900 node e1_cid_race.mjs > out_e1_fixed_1500.txt 2>&1
LAG=2000 N=4 ROUNDS=1 timeout 900 node e1_cid_race.mjs > out_e1_fixed_2000.txt 2>&1
timeout 300 node e2_nocid_deadend.mjs > out_e2.txt 2>&1
MODE=rules timeout 300 node e3_inbox_forgery.mjs > out_e3_rules.txt 2>&1
MODE=legacy timeout 300 node e3_inbox_forgery.mjs > out_e3_legacy.txt 2>&1
timeout 300 node e4_xss_cid.mjs > out_e4.txt 2>&1
STALE=60 timeout 300 node e5_board_stale.mjs > out_e5_60.txt 2>&1
STALE=50 timeout 300 node e5_board_stale.mjs > out_e5_50.txt 2>&1
timeout 300 node e6_seen_skew.mjs > out_e6.txt 2>&1
timeout 300 node e7_ui_refresh.mjs > out_e7.txt 2>&1
timeout 300 node e8_push_retry.mjs > out_e8.txt 2>&1
timeout 300 node e9_dup_cid_effect.mjs > out_e9.txt 2>&1
timeout 300 node e10_private_perm.mjs > out_e10.txt 2>&1
timeout 300 node e11_untrusted_names.mjs > out_e11.txt 2>&1
LAG=1500 timeout 300 node e12_lag_ui.mjs > out_e12.txt 2>&1
echo DONE > out_done.txt
