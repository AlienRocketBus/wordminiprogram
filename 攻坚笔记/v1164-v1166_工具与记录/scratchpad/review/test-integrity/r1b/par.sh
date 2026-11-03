#!/bin/bash
# usage: par.sh <dir> <tag> t1 t2 t3   (runs concurrently like 分批跑测试.py PARALLEL=3)
B=/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/test-integrity/r1b
DIR=$1; TAG=$2; shift 2
pids=()
for t in "$@"; do $B/run.sh "$DIR" "$TAG" "$t" & pids+=($!); done
wait "${pids[@]}"
