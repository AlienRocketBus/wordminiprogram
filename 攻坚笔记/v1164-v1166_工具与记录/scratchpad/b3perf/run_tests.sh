#!/bin/bash
cd /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt
W=$PWD
export HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs
for t in "$@"; do
  sed "s#/home/claude/work/repo#$W#g" $t.mjs > _wt_$t.mjs
  timeout 580 node _wt_$t.mjs > ../b3perf/t_$t.log 2>&1; rc=$?
  echo "$t rc=$rc :: $(tail -2 ../b3perf/t_$t.log | tr '\n' ' ' | cut -c1-200)"
  rm -f _wt_$t.mjs
done
