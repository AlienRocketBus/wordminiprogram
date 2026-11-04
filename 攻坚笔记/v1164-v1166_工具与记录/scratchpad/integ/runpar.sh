#!/bin/bash
# usage: runpar.sh outdir N listfile
out=$1; N=$2; list=$3
mkdir -p $out
cd /home/claude/work/repo
cat $list | xargs -P $N -I{} bash -c 's=$(date +%s); HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs timeout 600 node {} > '$out'/{}.log 2>&1; echo "{} rc=$? $(( $(date +%s)-s ))s" >> '$out'/summary.txt'
echo DONE >> $out/summary.txt
