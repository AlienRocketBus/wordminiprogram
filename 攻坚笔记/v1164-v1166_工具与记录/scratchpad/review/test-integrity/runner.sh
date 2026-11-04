#!/bin/bash
# usage: runner.sh <dir> <tag> test1 test2 ...
export HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs
DIR=$1; TAG=$2; shift 2
OUT=/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/test-integrity/runs
cd "$DIR"
for t in "$@"; do
  s=$(date +%s)
  timeout 900 node "$t" > "$OUT/${t%.mjs}__$TAG.txt" 2>&1
  rc=$?
  e=$(date +%s)
  pass=$(grep -c '^  OK ' "$OUT/${t%.mjs}__$TAG.txt")
  fail=$(grep -c '^  XX ' "$OUT/${t%.mjs}__$TAG.txt")
  echo "$(date +%T) $TAG $t rc=$rc time=$((e-s))s ok=$pass xx=$fail load=$(cut -d' ' -f1 /proc/loadavg)" >> "$OUT/summary.txt"
done
