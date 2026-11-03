cd /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/visual-consistency
while pgrep -x node >/dev/null && [ -z "$(grep seg6 progress.txt)" ]; do sleep 3; done
timeout 120 node probe_pinkhome.mjs > probe_pinkhome.log 2>&1; echo pinkhome >> progress.txt
timeout 150 node probe_toasts.mjs > probe_toasts.log 2>&1; echo toasts >> progress.txt
timeout 120 node probe_door.mjs cloud > probe_door_cloud.log 2>&1; echo doorcloud >> progress.txt
timeout 120 node probe_door.mjs none > probe_door_none.log 2>&1; echo doornone >> progress.txt
timeout 240 node probe_contrast2.mjs cloud > probe_contrast2_cloud.log 2>&1; echo c2cloud >> progress.txt
