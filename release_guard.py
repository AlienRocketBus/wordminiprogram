#!/usr/bin/env python3
"""release_guard.py (v938) — 发布前总体检(按需运行, 不进每次 build)

Hansen: "用最苛刻、最挑刺的方式, 所有问题全都找出来, 坚决不可以再出现任何的问题。"

★ 与每次打包都跑的 10 道守卫不同, 这是【发布前】跑的深度体检, 覆盖守卫墙之外的领域:
   A. 全 27 岛 + 地图页: 真机加载, 0 JS 报错 · 0 资源 404 · 关键函数全部在位  (audit_all.mjs)
   C. 存档安全: 半截JSON/乱码/类型全错 → 不白屏; 主存档坏+备份好 → 自动恢复    (audit_save.mjs)
   F. 边界数据: 满级/巨大数值/宠物满阶/全新用户/存储写满(Quota) → 全部不崩      (audit_save.mjs)

★ v938 发布前实测结论(2026-07, 全部真机):
   A/B: 28 个页面 0 报错 0 404 ✅
   C/F: 9/9 全过(备份恢复实测: 主档坏 → 从 _bak 恢复 totalXP=777, 一点没丢) ✅
   D 弱网: 3G 白屏结束 2.4s · 可交互 8.3s; 4G 白屏 ~0.5s · 图标画完 2.6s ✅
      (⚠️ 曾误报"3G 白屏 15 秒" —— 是探针用 waitUntil:'domcontentloaded' 把自己堵到 15 秒才开始量。
       教训又+1: 探针报警先证明探针。)
   E 内存: 反复进出游戏 40 次, JS 堆 5.6→5.9MB(+0.3MB), 无泄漏 ✅
   G 连点: claimQuest 连调 5 次只到账 1 份(claimed 门闩); eagleComplete 有 eagleActive 门闩;
      reviewComplete 有 reviewState=null 门闩 —— 经济系统刷不动 ✅
   H iOS微信(WKWebView)兼容: requestIdleCallback 30 处调用【全部有保护】
      (if(window.X)/'X' in window); navigator.vibrate 10 处【全部 if+try/catch 双保护】 ✅
"""
import os
import re
import signal
import subprocess
import sys
import time

PORT = "8897"
ROOT = os.path.dirname(os.path.abspath(__file__)) or "."


def run_probe(mjs, timeout, need):
    srv = subprocess.Popen([sys.executable, "_imgguard_srv.py", PORT, ROOT],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=ROOT)
    time.sleep(2)
    try:
        r = subprocess.run(["node", mjs, PORT], capture_output=True, text=True, timeout=timeout, cwd=ROOT)
        out = r.stdout
        print(out.rstrip())
        return (need in out) and r.returncode == 0
    except Exception as e:
        print("  ❌ %s 执行失败: %s" % (mjs, e))
        return False
    finally:
        try:
            srv.send_signal(signal.SIGTERM); srv.wait(timeout=5)
        except Exception:
            try: srv.kill()
            except Exception: pass


def main():
    ok = True
    print("══════ 发布前总体检 ══════\n")
    print("[1/2] 全库页面体检(28 页 · JS报错/404/关键函数)")
    if not run_probe("audit_all.mjs", 600, "0 JS报错"):
        ok = False
    print("\n[2/2] 存档安全 + 边界数据(坏档不白屏 · 备份恢复 · 满级/满阶/写满不崩)")
    if not run_probe("audit_save.mjs", 480, "0 项失败"):
        ok = False
    print("\n%s" % ("✅✅ 发布前总体检全部通过" if ok else "❌ 发布前总体检未通过, 不要发布!"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
