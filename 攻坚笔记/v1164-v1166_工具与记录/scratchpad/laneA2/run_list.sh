#!/bin/bash
# 依次跑（同一时间只开一个浏览器）；写死 /home/claude/work/repo 的测试先换成本工作区路径
WT=/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt
LOG=/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA2/final_tests.log
: > $LOG
cd $WT
for t in "$@"; do
  f=$t
  if grep -q "/home/claude/work/repo" "$t"; then sed "s#/home/claude/work/repo#$WT#g" "$t" > "_wt_$t"; f="_wt_$t"; fi
  start=$(date +%s)
  out=$(HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs timeout 900 node "$f" 2>&1); code=$?
  [ "$f" != "$t" ] && rm -f "$f"
  echo "=== $t exit=$code $(( $(date +%s) - start ))s" >> $LOG
  if [ $code -ne 0 ]; then echo "$out" | grep -E "❌|Error|rror:" | head -12 | cut -c1-300 >> $LOG; else echo "$out" | tail -1 | cut -c1-200 >> $LOG; fi
done
echo "=== DONE" >> $LOG
