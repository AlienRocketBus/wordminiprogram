#!/bin/bash
cd /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/theme-visual
for p in cosmos cloud violet sakura aurora cream woods mint coin_rainbow coin_pink imax_candy gallery_fairy; do
  PRESET=$p timeout 900 node scripts/s10_matrix.mjs >> out/matrix.log 2>&1
  echo "DONE $p" >> out/matrix.log
done
echo ALLDONE >> out/matrix.log
