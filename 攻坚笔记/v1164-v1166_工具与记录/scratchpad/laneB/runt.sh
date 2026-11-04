#!/bin/bash
# 用法: runt.sh test1.mjs test2.mjs ...   —— 依次跑（一次一个浏览器），硬编码路径的测试先换成本工作树
WT=/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt
cd $WT
for t in "$@"; do
  start=$(date +%s)
  if grep -q "/home/claude/work/repo" "$t"; then
    sed "s#/home/claude/work/repo#$WT#g" "$t" > "_wt_$t"
    HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs timeout 900 node "_wt_$t" > /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneB/log_$t.txt 2>&1; rc=$?
    rm -f "_wt_$t"
  else
    HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs timeout 900 node "$t" > /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneB/log_$t.txt 2>&1; rc=$?
  fi
  echo "$t rc=$rc $(( $(date +%s) - start ))s :: $(tail -1 /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneB/log_$t.txt | cut -c1-150)"
done
