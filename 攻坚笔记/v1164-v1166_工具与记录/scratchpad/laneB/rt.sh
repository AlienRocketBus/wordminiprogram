#!/bin/bash
# 用法: rt.sh <dir: wt|base|path> test1.mjs [test2.mjs ...]
# 在指定目录跑测试（一次一个浏览器）；新测试从工作树拷进 base 目录跑，证明修前失败。
SCR=/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad
WT=$SCR/wt-opt
D="$1"; shift
case "$D" in wt) DIR=$WT;; base) DIR=$SCR/laneB/base;; *) DIR="$D";; esac
tag=$(basename "$DIR")
cd "$DIR"
for t in "$@"; do
  start=$(date +%s)
  src="$t"
  if [ ! -f "$DIR/$t" ] || [ "$DIR" != "$WT" -a -f "$WT/$t" -a "$COPYTEST" = "1" ]; then cp "$WT/$t" "$DIR/$t"; fi
  log=$SCR/laneB/logs/${tag}__$t.txt
  if grep -q "/home/claude/work/repo" "$t"; then
    sed "s#/home/claude/work/repo#$DIR#g" "$t" > "_wt_$t"
    HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs timeout ${TMO:-900} node "_wt_$t" > "$log" 2>&1; rc=$?
    rm -f "_wt_$t"
  else
    HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs timeout ${TMO:-900} node "$t" > "$log" 2>&1; rc=$?
  fi
  echo "[$tag] $t rc=$rc $(( $(date +%s) - start ))s :: $(grep -v '^\[pid=' "$log" | grep -v '^\s*$' | tail -1 | cut -c1-200)"
done
