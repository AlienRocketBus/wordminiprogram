#!/bin/bash
# 用法: runwt.sh test_x.mjs [timeout]  —— 把写死的仓库路径换成工作树后跑
WT=/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt
cd $WT
t=$1; to=${2:-600}
case "$t" in
  *.py) sed "s#/home/claude/work/repo#$WT#g" $t > _wt_$t; HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs timeout $to python3 _wt_$t; rc=$?;;
  *) sed "s#/home/claude/work/repo#$WT#g" $t > _wt_$t; HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs timeout $to node _wt_$t; rc=$?;;
esac
rm -f _wt_$t
echo "RC=$rc"
