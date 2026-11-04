#!/bin/bash
cd /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/b3perf
run(){ echo "=== $1 $2 $3"; PORTFILE=../b3perf/port_$1.txt TAG=$2 timeout 500 node $3.mjs 2>&1 | grep -E '^(home|island)|label|^\{' | head -12; }
run base base2 s30_idle
run base base2 s31_anim_ab
run base base2 s01_firstrun
run wt final s31_anim_ab
run wt final s30_idle
run wt final s01_firstrun
run wt final2 s01_firstrun
