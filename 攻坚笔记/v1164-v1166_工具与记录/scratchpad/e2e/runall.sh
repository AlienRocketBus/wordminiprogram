#!/bin/bash
# 依次跑给定的测试，每个写自己的日志
cd /home/claude/work/repo
export HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs
OUT=$1; shift
for t in "$@"; do
  s=$(date +%s)
  timeout 600 node $t > $OUT/$t.log 2>&1
  rc=$?
  echo "$t rc=$rc secs=$(( $(date +%s) - s ))" >> $OUT/summary.txt
done
echo DONE >> $OUT/summary.txt
