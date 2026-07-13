#!/usr/bin/env python3
"""pet_guard.py (v938) — 宠物经验/进化守卫

Hansen: "为什么宠物不进化??? 感觉宠物好像没有得到经验和进化。
         玩完一个火眼金睛得到的宠物经验, 看宠物的时候能及时看到宠物增加的经验。"

★ 这次挖出 5 个根因, 每一个都是【看不见的】—— 页面不报错、按钮都在、像素也正常, 但宠物就是不长:
  ① 8 个星域岛(island_land1~8)【不在宠物的岛屿名单里】(全库 27 个岛, 名单里只有 19 个)
     → 在【星海觉醒】里打的经验, 宠物系统根本看不见 → globalXP() 永远算成 0 → 永不进化。
     ★ 又是那个老毛病: 加了新东西(8个岛), 却没更新它的【使用方名单】。
  ② 打字大师/完形填空的关卡配置【没有 petXp 字段】→ 传进去 undefined
     → addXP 里 `if(!isFinite(n)) return;` → 一点经验都不加, 而飘字照样显示 "+undefined 经验"(骗人)
  ③ 得到经验后【没有任何东西去刷新宠物界面】→ 宠物页开着也纹丝不动
  ④ 宠物页【只有一个百分比】→ 看不到"现在多少/还差多少", 更看不出卡在哪个条件
  ⑤ perf_boost.js 把 save() 换成【防抖延迟写盘】, 而宠物读的是 localStorage
     → 刚拿到的经验还没落盘, 读盘读到旧值 → 界面显示"经验 0"

★ 本守卫真机跑一遍全链路(18 项), 任何一项不过就拒绝打包。
★ 关键是第一项: 【每一个岛的经验, 宠物都必须算得进去】——
  以后再加新岛(land9、land10...), 只要宠物算不到, 这里当场变红。
"""
import os
import re
import signal
import subprocess
import sys
import time

PORT = "8896"
ROOT = os.path.dirname(os.path.abspath(__file__)) or "."


def static_checks():
    """静态部分: 宠物系统绝不能再用【手写死的岛屿名单】"""
    bad = []
    try:
        s = open(os.path.join(ROOT, "hansen_pet_showcase.js"), encoding="utf-8", errors="replace").read()
    except Exception as e:
        return ["读不到 hansen_pet_showcase.js: %s" % e]

    # globalXP 必须走【动态扫描 + 缓存】, 不能再遍历硬名单
    if "_hsnScanOthers" not in s:
        bad.append("宠物的 globalXP 没有用动态扫描(_hsnScanOthers) —— 回到硬名单就会漏掉新岛")
    if "window.__hsnSaveKey" not in s and "__hsnSaveKey" not in s:
        bad.append("宠物没读当前岛的 __hsnSaveKey —— 会去读被防抖延迟的 localStorage, 显示旧经验")
    m = re.search(r"function\s+globalXP\s*\([^)]*\)\s*\{(.*?)\n\}", s, re.S)
    if m and "HSN_ISLAND_KEYS" in m.group(1):
        bad.append("globalXP 又在遍历【手写死的 HSN_ISLAND_KEYS 名单】—— 新加的岛会被漏掉, 宠物又不会进化了")

    # 每个岛都必须暴露自己的存档键(宠物要用内存 S, 不能读被防抖延迟的 localStorage)
    islands = [f for f in os.listdir(ROOT) if re.match(r"island_\w+\.html$", f)]
    miss = []
    for f in islands:
        t = open(os.path.join(ROOT, f), encoding="utf-8", errors="replace").read()
        if "__hsnSaveKey" not in t:
            miss.append(f)
    if miss:
        bad.append("有 %d 个岛没暴露 __hsnSaveKey(宠物会去读被防抖延迟的 localStorage → 显示旧经验): %s"
                   % (len(miss), miss[:4]))

    # petTaskComplete 必须有兜底(配置漏了 petXp 也不能变成 0 经验 + 假飘字)
    miss2 = []
    for f in islands + ["template.html"]:
        t = open(os.path.join(ROOT, f), encoding="utf-8", errors="replace").read()
        if "petTaskComplete" in t and "_fb[gameKey]" not in t:
            miss2.append(f)
    if miss2:
        bad.append("有 %d 个岛的 petTaskComplete 没有 petXp 兜底(配置漏字段就会变成 0 经验+假飘字): %s"
                   % (len(miss2), miss2[:4]))
    return bad


def main():
    bad = static_checks()
    if bad:
        print("  ❌ 宠物守卫(静态): ")
        for b in bad:
            print("     · %s" % b)
        return 1

    srv = subprocess.Popen([sys.executable, "_imgguard_srv.py", PORT, ROOT],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=ROOT)
    time.sleep(2)
    try:
        r = subprocess.run(["node", "pet_probe.mjs", PORT],
                           capture_output=True, text=True, timeout=400, cwd=ROOT)
        out = r.stdout
        print(out.rstrip())
        m = re.search(r"(\d+)\s*项通过\s*·\s*(\d+)\s*项失败", out)
        if not m:
            print("  ❌ 宠物守卫: 探针没跑完(渲染失败) —— 绝不能当成'通过'")
            return 1
        ok, nf = int(m.group(1)), int(m.group(2))
        if ok < 15:
            print("  ❌ 宠物守卫: 只验了 %d 项, 明显没跑到位 —— 不能当成'通过'" % ok)
            return 1
        if nf or r.returncode != 0:
            print("  ❌ 宠物守卫未通过: %d 项失败(宠物拿不到经验 / 不进化 / 界面不刷新)" % nf)
            return 1
        print("  ✅ 宠物守卫: %d 项全链路真机验证通过(经验到账·跨岛累计·真的进化·界面实时刷新)" % ok)
        return 0
    except Exception as e:
        print("  ❌ 宠物守卫执行失败: %s" % e)
        return 1
    finally:
        try:
            srv.send_signal(signal.SIGTERM); srv.wait(timeout=5)
        except Exception:
            try: srv.kill()
            except Exception: pass


if __name__ == "__main__":
    sys.exit(main())
