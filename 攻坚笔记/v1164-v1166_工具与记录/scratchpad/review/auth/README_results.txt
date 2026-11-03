Auth/session/backup review (round 1) — real-SDK + emulator experiments. Run any with:
  HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs node exp/<file>.mjs      (OLD=1 => v1163 snapshot)
x5_expiry_loss.mjs     session dies mid-play -> v1164: ladder record 5->0 at once, relogin restores cloud: 15 words -> 5 (x5_new*.txt); v1163 keeps marker (x5_old.txt)
x7_iframe_expiry.mjs   returning kid, island in index.html, dead session -> top full-screen "别的窗口退出了登录" (x7_new.txt) ; v1163 none (x7_old.txt)
x7b_noaction.mjs       same, no kid action: overlay ~3 s after entering island (x7b_new.txt / x7b_old.txt)
x8_island_login_ui.mjs login via 拼写大PK->天梯 gate inside island -> top "别的窗口登录了另一个账号" (both versions)
x1b_iframe_top.mjs     same via HansenAuth in iframe (both versions)
x4_import_fail.mjs / x4b_import_count.mjs  one failed SDK download -> every ensureSession 'network' until reload; SDK never re-requested; ?retry= URL loads
x3_switch.mjs          phone A -> 退出 -> username B: B's cloud ident 'p:<A phone>', A's save restored, panel shows A's phone, legacy upload ok:true w/o write
x6_two_tabs.mjs        two pages refresh together: v1164 3/3 both signed out while tab1 DB works; v1163 3/3 marker kept
x9_restore_msg.mjs     login panel "已自动取回云端进度（0 个单词）" while restoring 40
x12_legacy_username.mjs v1058-v1163 username "registrant": silently signed out at load; username login -> "没找到这个用户名，检查一下拼写"
x10_wake_slow.mjs      NEGATIVE: offline/hung refresh at wake -> 'slow' ~10 s, marker kept, recovers; 4.5 s latency + no user_info -> ok in 9.1 s
x11_unreachable_then_upload.mjs NEGATIVE: cloud read fails at login -> cloud_restore retry restored (no loss observed)
batch/                 39 existing auth/backup/session tests: all rc=0 ; run_session.txt 51/0 ; run_cloud.txt 28/0
