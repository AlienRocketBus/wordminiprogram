#!/bin/bash
cd /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/theme-visual
uptime > out/cpu.log
ROUNDS=3 timeout 3000 node scripts/s20_idle_cpu.mjs >> out/cpu.log 2>&1
echo IDLEDONE >> out/cpu.log
uptime >> out/cpu.log
ROUNDS=3 timeout 1500 node scripts/s21_event_cpu.mjs >> out/cpu.log 2>&1
echo EVENTDONE >> out/cpu.log
uptime >> out/cpu.log
