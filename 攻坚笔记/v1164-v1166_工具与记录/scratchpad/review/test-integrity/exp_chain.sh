#!/bin/bash
export HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs
D=/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/test-integrity
cd $D/exp
run() { local tag=$1; shift; local s=$(date +%s); timeout 900 "$@" > $D/runs/exp_$tag.txt 2>&1; local rc=$?; echo "$(date +%T) EXP $tag rc=$rc time=$(( $(date +%s)-s ))s ok=$(grep -c '^  OK ' $D/runs/exp_$tag.txt) xx=$(grep -c '^  XX ' $D/runs/exp_$tag.txt) load=$(cut -d' ' -f1 /proc/loadavg)" >> $D/runs/summary.txt; }
run e1_ok node e1_orderby_fallback.mjs ok 45
run e1_refuse node e1_orderby_fallback.mjs refuse 45
run e2_lag400 env LAG=400 node e2_friends_lag.mjs
run e3_flap1500 env LAGMAX=1500 SEED=7 node e3_ladder_flaplag.mjs
run e4_ladder_slow node e4_ladder_slow.mjs
run e5_rooms_slow node e5_rooms_slow.mjs
run e6_sim_a node e6_ladder_sim_probe.mjs
run e6_sim_b node e6_ladder_sim_probe.mjs
run e6_sim_c node e6_ladder_sim_probe.mjs
run e7_slow node e7_slow_path.mjs
run e8_leaks node e8_leaks.mjs
