#!/bin/bash
cd /home/claude/work/repo
export HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs
for i in $(seq 1 12); do
  echo "=== batch $i $(date +%T)"
  python3 分批跑测试.py 540 2>&1 | tail -14
  if python3 分批跑测试.py 1 2>&1 | grep -q "剩余 0"; then break; fi
done
echo FULLDONE
