#!/bin/bash
R=/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/rev
PW=/opt/node22/lib/node_modules/playwright/index.mjs
cd /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt
HANSEN_PLAYWRIGHT_MODULE=$PW timeout 700 node test_lesson_review_fix_v1165.mjs > $R/c4_new_wt.log 2>&1; echo "new@wt exit=$? fails=$(grep -c '❌' $R/c4_new_wt.log)"
cd $R/base_head
HANSEN_PLAYWRIGHT_MODULE=$PW timeout 700 node test_lesson_review_fix_v1165.mjs > $R/c4_new_head.log 2>&1; echo "new@pre-fix-HEAD exit=$? fails=$(grep -c '❌' $R/c4_new_head.log)"
cd $R/base_main
HANSEN_PLAYWRIGHT_MODULE=$PW timeout 700 node test_srs_plan_v1165.mjs > $R/c4_srs_main.log 2>&1; echo "srs@origin-main exit=$? fails=$(grep -c '❌' $R/c4_srs_main.log)"
$R/run_set.sh test_canonical_progress_v941 test_canonical_economy_v941 test_canonical_input_safety_v946 test_canonical_srs_hf2_v946 test_canonical_partial_backup_v942 test_canonical_clear_crystal_v942 test_canonical_backup_schema_v942 test_land_sync_v942 test_storage_reset_v942 test_backup_v942 test_answer_coin_v941 test_answer_coin_transaction_v942 test_explore_dual_progress_v945 test_explore_progress_api_v945 test_explore_template_v945 test_camel_runtime_v1015 test_backup_coverage_v1019 test_mock_contract_v970 test_today_overlay_fixed_v1006 test_review_rewards_v963 test_legacy_economy_v941 test_mistake_lesson_v1165 test_real_path_smoke_v1163 test_land_mode_xp_v941
echo CHAIN4DONE
