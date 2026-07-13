#!/usr/bin/env python3
"""sb_guard.py (v939) — 拼写蜂守卫

Hansen: "岛里明明有 30 个或 40 个单词, 但这个模块里考的单词却不全面。
         比如某个岛有 40 个单词, 却只考了 25 个。
         而且我希望他念完单词之后我再拼写, 有时候单词还没念, 机器人就已经开始拼写了。"

★ 两个 bug, 都是【看不见的】—— 页面不报错、能玩、像素也正常, 但内容和公平性是错的:

  🔴① 出题池不全: 拼写蜂自带一份【独立词库】(936条), 建库时【按英文去重】了 ——
     每个英文词只有一条、只能挂【一个】isl 标签。但岛之间是【共享单词】的:
       orange 既在食物岛也在颜色岛, fish 既在食物岛也在动物岛,
       teacher 既在学校岛也在职业岛, driver 既在交通岛也在职业岛……
     去重时这些词被分给了其中一个岛 → 【另一个岛就永远考不到它】。
     真机核对: 27 个岛的词位共 952 个, 词库只有 936 条 —— 正好差 16 个:
       traffic 30→25(map/driver/right/turn/stop) · food 56→53(orange/chicken/fish)
       treasure 60→57(when/hard/answer) · school 38→36(teacher/chair)
       adjective 51→50(clean) · job 30→29(cook) · time 40→39(second)
     ★修法(治本): 岛内运行时【直接用岛自己的词表 parent.allW】, 不再维护会漂移的第二份词库。
       以后加新岛/加新词自动生效, 这个 bug 不可能再犯。

  🔴② 机器人抢跑: nextWord 的时序是
       started=Date.now();                            // 玩家【立刻】开始计时
       botTimer=setTimeout(botStep, 500+random*500);  // 机器人 0.5~1.0 秒后开打
       setTimeout(()=>speak(word), 300);              // 单词 0.3 秒才【开始】念(念完要 0.8~1.5 秒)
     → 单词还在念, 机器人已经在拼; 听读音模式下单词是藏着的, 玩家还没听清就落后了;
       而且玩家在"听的时候"就被计时 —— 双重不公平。
     ★修法: speakThen(text, cb) —— 念完(audio.onended / TTS onend / 3.5秒兜底)才回调,
       机器人和玩家计时【都等这个回调】。音频全坏也一定开赛, 绝不卡死。

★ 本守卫每次打包真机验:
   ① 27 个岛逐个: 拼写蜂考的词 == 岛上的词(一个不多一个不少, 且逐词比对)
   ② 时间轴: 机器人第一次落键的时刻 > 单词念完的时刻; 玩家计时也从念完才开始
   ③ 音频全 404 时兜底开赛(不卡死)
"""
import os
import re
import signal
import subprocess
import sys
import time

PORT = "8898"
ROOT = os.path.dirname(os.path.abspath(__file__)) or "."


def static_checks():
    bad = []
    try:
        s = open(os.path.join(ROOT, "spelling_bee.html"), encoding="utf-8", errors="replace").read()
    except Exception as e:
        return ["读不到 spelling_bee.html: %s" % e]
    # 必须优先用岛自己的词表
    if "parent.allW" not in s:
        bad.append("拼写蜂没有读岛自己的词表(parent.allW) —— 会退回那份按英文去重的独立词库, 一词多岛的词又要漏")
    # 必须有"念完再开跑"
    if "speakThen" not in s:
        bad.append("拼写蜂没有 speakThen(念完回调) —— 机器人会在单词念完之前抢跑")
    # 老的抢跑写法不许回来
    if re.search(r"botTimer=setTimeout\(function\(\)\{botStep\(msPerChar\);\},500\+Math\.random\(\)\*500\);\s*if\(S\.mode==='listen'\)setTimeout", s):
        bad.append("nextWord 又回到了【机器人先跑、单词后念】的老时序")
    return bad


def run(mjs, timeout, need):
    srv = subprocess.Popen([sys.executable, "_imgguard_srv.py", PORT, ROOT],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=ROOT)
    time.sleep(2)
    try:
        r = subprocess.run(["node", mjs, PORT], capture_output=True, text=True, timeout=timeout, cwd=ROOT)
        print(r.stdout.rstrip())
        return (need in r.stdout) and r.returncode == 0
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
    bad = static_checks()
    if bad:
        print("  ❌ 拼写蜂守卫(静态):")
        for x in bad:
            print("     · %s" % x)
        return 1
    ok = True
    print("  [1/2] 出题池: 27 个岛逐词核对(拼写蜂考的词 == 岛上的词)")
    if not run("sb_audit.mjs", 600, "一个不多一个不少"):
        ok = False
    print("\n  [2/2] 时序: 机器人必须等单词念完才动手")
    if not run("sb_race.mjs", 300, "0 项失败"):
        ok = False
    if ok:
        print("\n  ✅ 拼写蜂守卫: 27 岛出题池一个词不差 + 机器人不抢跑 + 音频坏了也不卡死")
        return 0
    print("\n  ❌ 拼写蜂守卫未通过, 拒绝打包")
    return 1


if __name__ == "__main__":
    sys.exit(main())
