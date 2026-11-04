import sys, importlib.util
sys.path.insert(0,'/home/user/wordminiprogram')
spec = importlib.util.spec_from_file_location('g', '/home/user/wordminiprogram/hansen_guards_v1068.py')
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
src = open(sys.argv[1], encoding='utf-8').read() if len(sys.argv) > 1 else ''
if src: exec(compile(src, 'new_guards', 'exec'), g.__dict__)
names = [n for n in g.__dict__ if n.startswith('guard_')]
want = sys.argv[2].split(',') if len(sys.argv) > 2 else None
for n in ['guard_room_transport_checks_code','guard_board_friends_check_code','guard_room_no_multi_write','guard_room_no_phone','guard_overlays_above_pk','guard_session_has_timeout','guard_no_marker_without_creds','guard_join_waits_for_host','guard_watchdog_not_false_alarm','guard_ladder_routes_by_kind','guard_pk_words_typeable','guard_waitall_no_force_skip','guard_backup_skips_sdk_keys','guard_cloud_tests_no_stubs','guard_friendly_tells_truth']:
    if n not in g.__dict__: print('MISSING', n); continue
    g.PROBLEMS.clear()
    g.__dict__[n]()
    print(('RED ' if g.PROBLEMS else 'ok  ') + n, g.PROBLEMS[:3])
