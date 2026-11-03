#!/bin/bash
# 在 v1163 旧代码上跑新测试：必须变红
cd /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/e2e/old_repo
export HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs
OUT=$1; shift
for t in "$@"; do
  s=$(date +%s)
  timeout 600 node $t > $OUT/$t.log 2>&1
  rc=$?
  echo "$t rc=$rc secs=$(( $(date +%s) - s ))" >> $OUT/summary.txt
done
echo DONE >> $OUT/summary.txt
