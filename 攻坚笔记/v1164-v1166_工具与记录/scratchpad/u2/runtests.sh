#!/bin/bash
# usage: runtests.sh outdir test1 test2 ...
out=$1; shift
mkdir -p $out
cd /home/claude/work/repo
for t in "$@"; do
  s=$(date +%s)
  HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs timeout 600 node $t > $out/$t.log 2>&1
  rc=$?
  e=$(date +%s)
  echo "$t rc=$rc $((e-s))s $(tail -1 $out/$t.log | cut -c1-80)" >> $out/summary.txt
done
echo DONE >> $out/summary.txt
