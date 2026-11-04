cd /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/visual-consistency
timeout 500 node seg2.mjs light > seg2_light.log 2>&1; echo seg2 done >> progress.txt
timeout 500 node seg2b.mjs light mylearning,wrong,review,cards,spellbee,boss > seg2b_light.log 2>&1; echo seg2b done >> progress.txt
timeout 400 node seg3.mjs light listen,typing,moles,gacha > seg3_light.log 2>&1; echo seg3 done >> progress.txt
timeout 400 node seg4.mjs light showcase,landdetail > seg4_light.log 2>&1; echo seg4 done >> progress.txt
timeout 300 node seg5.mjs dark > seg5_dark.log 2>&1; echo seg5d done >> progress.txt
timeout 300 node seg5.mjs cloud > seg5_cloud.log 2>&1; echo seg5c done >> progress.txt
timeout 300 node seg5.mjs pink > seg5_pink.log 2>&1; echo seg5p done >> progress.txt
timeout 300 node seg6.mjs > seg6.log 2>&1; echo seg6 done >> progress.txt
