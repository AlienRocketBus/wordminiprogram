#!/bin/bash
# usage: run.sh <dir> <tag> test1 test2 ...   (sequential; summary line per test)
export HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs
B=/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/test-integrity/r1b
DIR=$1; TAG=$2; shift 2
cd "$DIR"
for t in "$@"; do
  s=$(date +%s.%N)
  o="$B/runs/${t%.mjs}__$TAG.txt"
  timeout 1200 node "$t" > "$o" 2>&1
  rc=$?
  e=$(date +%s.%N)
  pass=$(grep -c '^  OK ' "$o")
  fail=$(grep -c '^  XX ' "$o")
  printf "%s %-8s %-40s rc=%s time=%.0fs ok=%s xx=%s load=%s\n" "$(date +%T)" "$TAG" "$t" "$rc" "$(echo "$e - $s" | bc)" "$pass" "$fail" "$(cut -d' ' -f1 /proc/loadavg)" >> "$B/runs/summary.txt"
done
