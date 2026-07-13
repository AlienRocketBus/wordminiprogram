#!/usr/bin/env python3
"""e2e_guard.py (v935) — 端到端回归守卫

Hansen: "为什么每次新做一件事总会出现新 bug? 修好之后就锁死。"

★ 前面的守卫各管一摊(特效/配色/性能/图片/字体/发音), 但有一类问题它们都管不到:
   【功能本身被改坏了】—— 按钮还在、页面不报错、像素也正常, 但点下去不起作用。
   这次会话里我就干过: 把 boss 引擎改成按需加载(万一保险层写错, 打Boss就永远转圈),
   把 AudioContext 改成手势后才建(万一写错, 音效全哑), 给卡册加 loading=lazy(万一写错, 卡册全白)。
   这些【静态检查和像素检查都发现不了】—— 必须真的点一遍。

★ 本守卫真机把我改过的每一个功能【真的用一遍】:
   ① 打Boss 主题选择器: 真点「晨曦」, 主题有没有切过去 + 有没有存进去 + 能不能切回来
   ② 真打一场 Boss: 进岛时引擎【没被解析执行】(只预取暖缓存) → 叫它才加载 → 6张特效图真的画得出来
   ③ 卡册: 加了 loading=lazy 之后, 首屏的图还显不显示
   ④ 形象详情: 大卡片用的是不是高清图, 立绘有没有撑满(≥85%)
   任何一项失败 → 拒绝打包。
"""
import os
import re
import signal
import subprocess
import sys
import time

PORT = "8893"
ROOT = os.path.dirname(os.path.abspath(__file__)) or "."


def main():
    srv = subprocess.Popen([sys.executable, "_imgguard_srv.py", PORT, ROOT],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=ROOT)
    time.sleep(2)
    try:
        r = subprocess.run(["node", "e2e_probe.mjs", PORT],
                           capture_output=True, text=True, timeout=420, cwd=ROOT)
        out = r.stdout
        print(out.rstrip())
        m = re.search(r"(\d+)\s*项通过\s*·\s*(\d+)\s*项失败", out)
        if not m:
            print("  ❌ 端到端守卫: 探针没跑完(渲染失败) —— 绝不能当成'通过'")
            return 1
        ok, bad = int(m.group(1)), int(m.group(2))
        if ok < 9:
            print("  ❌ 端到端守卫: 只验了 %d 项, 明显没跑到位 —— 不能当成'通过'" % ok)
            return 1
        if bad or r.returncode != 0:
            print("  ❌ 端到端守卫未通过: 有 %d 项功能被改坏了" % bad)
            return 1
        print("  ✅ 端到端守卫: %d 项功能真机点过一遍, 全部正常" % ok)
        return 0
    except Exception as e:
        print("  ❌ 端到端守卫执行失败: %s" % e)
        return 1
    finally:
        try:
            srv.send_signal(signal.SIGTERM)
            srv.wait(timeout=5)
        except Exception:
            try:
                srv.kill()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
