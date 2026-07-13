#!/usr/bin/env python3
"""img_guard.py (v933) — 图片尺寸守卫

Hansen 截图: "为什么我点击这个左上角这个动物的头像进来之后, 这些动物的这个立体形象怎么都变得这么小了?"

★ 根因(是 v929 提速时埋的雷):
   v929 为了加快进岛速度, 把头像从 417x720 压到了 111x192, 图标从 512~768px 压到 288px。
   压之前【只按顶栏头像的显示尺寸(46px)算了一遍】, 忘了同一张图还被用在更大的展示位上:
     · 形象选择器的网格缩略图 —— 显示 110px (3倍屏需要 330px)
     · 形象详情的大卡片     —— 显示 331px (3倍屏需要 993px)
   而大卡片的 CSS 是 `width:auto; height:auto; max-width:92%; max-height:92%` ——
   图片按【原始尺寸】画, 只有超过上限才缩小。
     720px 的原图 → 超过上限(331px) → 缩到 331px = 正好撑满卡片 ✅
     192px 的小图 → 根本够不着上限     → 就按 192px 原样画 = 只占卡片 53% = 缩成一小坨 ❌

★ 这个守卫钉死两类问题(真机渲染, 不是静态扫文件):
   ① 【撑不起展示位】源图原始高度 ≤ 画出来的高度(= 这张图已经顶格画了, 再也长不大),
      而展示位却比它大得多(填充率 < 70%) → 就是"源图太小撑不起来"。
   ② 【被拉糊】显示尺寸 × 3(手机常见倍屏) 超过源图 1.5 倍以上 → 放大失真, 肉眼可见发虚。

★ 为什么必须真机渲染: 光看文件尺寸永远发现不了这个问题 ——
   192px 的头像文件本身完全"正常", 问题出在【它被放进了一个 331px 的展示位】。
   这个组合只有真的渲染出来、量真实像素才看得见。

★ 自证有效: 把 hansen_avatar.js 的高清图改回小图 → 本守卫当场报出
   "只占容器 53% avatars/01.webp 源图111x192 显示111x192 容器300x360 [形象详情]"。
"""
import re
import subprocess
import sys
import time
import os
import signal

PORT = "8891"
ROOT = os.path.dirname(os.path.abspath(__file__)) or "."


def main():
    srv = subprocess.Popen(
        [sys.executable, "_imgguard_srv.py", PORT, ROOT],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=ROOT,
    )
    time.sleep(2)
    try:
        r = subprocess.run(["node", "img_size_audit.mjs", PORT],
                           capture_output=True, text=True, timeout=420, cwd=ROOT)
        out = r.stdout
        print(out.rstrip())
        # ⚠️ v934: 原来靠【匹配输出里的文字】来判通过/不通过 —— 我一改体检的措辞, 判定就误报了(体检明明 0 问题却说不通过)。
        #    这又是"改了一样东西没检查它的使用方"。改成【看退出码】: img_size_audit.mjs 有问题就 exit(1), 没问题 exit(0)。
        #    另外必须确认体检【真的扫到东西了】—— "什么都没找到"的绿灯不是绿灯(渲染失败也会是 0 问题)。
        m = re.search(r"(\d+)\s*个界面\s*·\s*(\d+)\s*张图", out)
        if not m or int(m.group(1)) < 20 or int(m.group(2)) < 100:
            print("  ❌ 图片尺寸守卫: 体检没扫到足够的界面/图片(渲染失败) —— 这种情况绝不能当成'通过'")
            return 1
        if r.returncode != 0:
            print("  ❌ 图片尺寸守卫未通过: 有图在大展示位上撑不起来 / 被拉糊")
            return 1
        print("  ✅ 图片尺寸守卫: 全库真机渲染 %s 个界面 %s 张图, 没有一张在展示位上撑不起来或被拉糊"
              % (m.group(1), m.group(2)))
        return 0
    except Exception as e:
        print("  ❌ 图片尺寸守卫执行失败: %s" % e)
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
