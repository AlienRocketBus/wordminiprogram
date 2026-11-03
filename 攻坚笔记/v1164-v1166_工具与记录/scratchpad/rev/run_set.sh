#!/bin/bash
# 依次跑一组测试（一次一个浏览器），写结果
WT=/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt
OUT=/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/rev/sets
mkdir -p $OUT
cd $WT
for t in "$@"; do
  f=$t.mjs; tmp=_wt_$t.mjs
  if grep -q '/home/claude/work/repo' $f; then sed "s#/home/claude/work/repo#$WT#g" $f > $tmp; run=$tmp; else run=$f; fi
  HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs timeout 600 node $run > $OUT/$t.log 2>&1
  code=$?
  rm -f $tmp
  echo "$t exit=$code fails=$(grep -c '❌' $OUT/$t.log)"
done
echo SETDONE
