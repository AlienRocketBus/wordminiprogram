import json,sys,re
R=sys.argv[1]; m=json.load(open(R+'/measure.json')); s=json.load(open(R+'/measure_src.json'))
CAT={
 'boss_fx':['hansen_boss_attack','hansen_boss_lock','hansen_boss_anim','hansen_boss_theme','hansen_boss_progress','hansen_weapon_fx','hansen_gear'],
 'economy':['hansen_coin_wallet','hansen_ach_wallet','hansen_cardbook_wallet','hansen_totals_wallet','hansen_gem_system','hansen_diamond_shop','hansen_theme_shop','hansen_theme_lock','hansen_freepass','hansen_econ_guide','hansen_round_reward','hansen_round_bar','hansen_review_rewards_v963','hansen_addiction','hansen_checkin_global','hansen_quest_global'],
 'collections':['hansen_cards','hansen_land_cards','hansen_gacha','hansen_pet_showcase','hansen_avatar','hansen_crystal','hansen_season','hansen_cinema_themes','hansen_palette'],
 'learning':['hansen_review','hansen_wrong_overview','hansen_mylearning','hansen_spell_practice','hansen_focused_typing_v946','hansen_explore_progress_v945','hansen_canonical_progress','hansen_island_upgrade','hansen_ex_audio','hansen_tts_volume_v1038','hansen_mute','highlight_helper','click_sound','click_setting'],
 'spellbee_pk_ladder':['hansen_spellbee','hansen_spellbee_gems','hansen_sb_ladder_v1002','hansen_sb_pk_v1022','hansen_sb_profile_v1002','hansen_pk_room_v1065','hansen_pk_room_ui_v1065','hansen_pk_record_v1103','hansen_pk_watchdog_v1155','hansen_room_warm_v1023','hansen_ladder_ui_v1108','hansen_ladder_board_v1156'],
 'cloud_account_backup':['hansen_auth_v1004','hansen_auth_ui_v1004','hansen_signup_gate_v1030','hansen_cloud_config_v965','hansen_cloud_save_v965','hansen_cloud_restore_v1048','hansen_cloud_diag_v1027','hansen_friends_v1106','hansen_friends_ui_v1107','hansen_cred_guard_v1092','hansen_cred_trap_v1085','hansen_backup_v944','hansen_backup_bootstrap_v944'],
 'web_platform_plumbing':['hansen_sw_upgrade_gate_v944','sw_v944','hansen_version_watch_v1083','hansen_change_notify_v1134','hansen_download_fix_v1140','hansen_selfrescue_v1141','hansen_boot_check_v1156','hansen_silent_watch_v1155','hansen_perf_v944','perf_boost','hansen_preload','hansen_island_prefetch_v1025','hansen_game_antifreeze','hansen_stability','hansen_early','hansen_home_link','copy_protect','hansen_accessibility','hansen_toast_v1156','hansen_onboarding','hansen_upgrade','hansen_land_scene_manifest_v972'],
 'data':['vocab_all','word_map','sentence_map'],
}
inv={f+'.js':c for c,fs in CAT.items() for f in fs}
out={}
unassigned=[]
for k,v in m['js_info'].items():
    if v['vendor']: c='vendor_cloudbase_sdk'
    else: c=inv.get(k)
    if not c: unassigned.append(k); c='?'
    o=out.setdefault(c,{'files':0,'lines':0,'bytes':0,'dom_ops':0,'ls':0,'waapi':0})
    o['files']+=1;o['lines']+=v['lines'];o['bytes']+=v['bytes']
    pc=m['api_counts_per_file'][k]
    o['dom_ops']+=sum(pc[x] for x in ['document.*','innerHTML','createElement','querySelector(All)','getElementById','addEventListener','.style.* manipulation','classList','appendChild/insertBefore/remove/replaceChild','getBoundingClientRect'])
    o['ls']+=pc['localStorage']; o['waapi']+=pc['element.animate (WAAPI)']
for k,v in s['inline_source_stats'].items():
    o=out.setdefault('inline:'+k,{'files':1,'lines':v['lines'],'bytes':v['bytes']})
for k,v in out.items(): print('%-34s files=%3d lines=%6d KB=%7.1f %s'%(k,v['files'],v['lines'],v['bytes']/1024, ('dom_ops=%d ls=%d waapi=%d'%(v['dom_ops'],v['ls'],v['waapi'])) if 'dom_ops' in v else ''))
print('unassigned',unassigned)
json.dump(out,open(R+'/categories.json','w'),indent=1,ensure_ascii=False)
