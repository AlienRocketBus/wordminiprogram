#!/bin/bash
cd /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/b3perf
export PORTFILE=../b3perf/port_base.txt TAG=base
for s in s29_warm_cpu s14_warm_ab s31_anim_ab s01_firstrun; do
  echo "=== $s" ; timeout 500 node $s.mjs 2>&1 | tail -30
done
