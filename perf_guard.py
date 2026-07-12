#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
⭐ v929 加载性能守卫 (Hansen: "进岛很卡·很多画面加载不出来·点打Boss卡在那儿·我要极致快·这是上线前最高优先级的问题")

修前实测(island_land3, 本地无限速 —— 已经是最好的情况了)
------------------------------------------------------------------
  首次绘制 2364ms · DOMContentLoaded 3826ms · load 4619ms · 158 个请求 / 11.95 MB

三个根因(每一个都致命)
------------------------------------------------------------------
① hansen_boss_attack.js 有 2.44MB(其中 1.28MB 是内嵌 base64 图), 而且【一执行就再预下十几张 boss 图】。
   它只有【打 Boss 时】才用得上, 却在每次进岛时同步下完+解析完。
   再加上 hansen_cards.js 的 loadNext() 进岛 200ms 就开始预下 19 张卡册 boss 图。
   → 进岛时白白下了 45 张 boss 图(4.58MB), 把首屏图标的带宽全抢光 = "图片加载不出来"。
   修法: boss 引擎【按需加载】(进岛不下 → 首屏画完后空闲预取 → 点打Boss时通常已就位, 没就位则自动等);
        卡册图预下载挪到【首屏画完+空闲】之后。

② Baloo2 字体是 font-display:block —— block 的意思是【字体没下完, 文字就不画】。
   而它排在 4.58MB boss 图后面抢带宽 → 白屏好几秒。
   修法: block → swap(先用系统字体显示, 字体到了再换)。单这一条: 首次绘制 2364ms → 936ms。

③ 图片尺寸严重超标: 图标真机实测【最大只显示 91px】却存着 512~768px; 头像只显示 46px 却存着 720px。
   修法: 按真实显示尺寸 ×3倍屏 重压(图标 288px / 头像 192px), 肉眼零差别。
        另外 CartoonBlack 装饰字体(只用在按钮标题上)子集化 613KB→244KB, 并推迟到首屏画完后再加载。

修后(模拟 4G + gzip, 和用户手机上的 CloudBase 一致)
------------------------------------------------------------------
  看到内容 ~0.9s · 可点击 ~1.1s · 首屏图标画完 ~1.2s (修前图标要 3.4s)

这道守卫怎么防
------------------------------------------------------------------
每次 build 在【模拟 4G + gzip】下真机加载 3 个代表岛, 量用户真正感觉到的三个时间 + 关键路径字节数。
任何一项超标 → 拒绝打包。(gzip 必须模拟: CloudBase 对文本开 gzip, 本地裸 http 不开 —— 不模拟会把结果
测得比真实差 2~3 倍, 从而做出错误的优化决策。)

用法: python3 perf_guard.py    (build.py 步骤 6.7 自动调用)
"""
import os, sys, json, time, gzip, socket, subprocess, threading
import http.server, socketserver

PORT = 8891
PROBE = "perf_probe.mjs"
ISLANDS = "island_land3.html,island_season.html,island_animal.html"

# 预算(模拟 4G + gzip)。留了余量, 只在【明显退步】时才拦, 避免因机器抖动误报。
BUDGET = {
    "content":    2000,   # 看到内容(首页模式卡出现)   实测 ~0.9s
    "interactive": 2500,  # 可点击(showScreen 就绪)     实测 ~1.1s
    "icons":       2800,  # 首屏图标全部画完             实测 ~1.2s  ← Hansen 抱怨的正是这个
    "criticalKB":  2200,  # load 之前下载的字节(关键路径) 实测 ~1.4MB
}

_CACHE = {}


class _H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.translate_path(self.path.split('?')[0])
        if not os.path.isfile(path):
            return super().do_GET()
        ae = self.headers.get('Accept-Encoding', '')
        gz = 'gzip' in ae and path.endswith(('.html', '.js', '.css', '.json', '.svg'))
        key = (path, gz)
        if key not in _CACHE:                       # 压一次缓存住(模拟 CDN 的预压缩, 否则服务器自己成瓶颈)
            data = open(path, 'rb').read()
            if gz:
                data = gzip.compress(data, 6)
            _CACHE[key] = data
        data = _CACHE[key]
        self.send_response(200)
        self.send_header('Content-Type', self.guess_type(path))
        if gz:
            self.send_header('Content-Encoding', 'gzip')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'public, max-age=31536000')
        self.end_headers()
        self.wfile.write(data)


def run():
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(("", PORT), _H)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    time.sleep(0.6)
    try:
        # 预热一次(把 gzip 缓存填满, 否则第一个岛会被压缩耗时污染)
        subprocess.run(["node", PROBE, str(PORT), "island_land3.html"],
                       capture_output=True, text=True, timeout=300)
        r = subprocess.run(["node", PROBE, str(PORT), ISLANDS],
                           capture_output=True, text=True, timeout=900)
        line = [l for l in r.stdout.strip().split("\n") if l.startswith("[")]
        if not line:
            return ["性能探针没有输出: " + (r.stderr or r.stdout)[:120]]
        data = json.loads(line[-1])
    except Exception as e:
        return ["性能探针异常: %s" % str(e)[:110]]
    finally:
        srv.shutdown()

    problems = []
    rows = []
    for d in data:
        if d.get("err"):
            problems.append("[%s] 加载失败: %s" % (d.get("island"), d["err"]))
            continue
        rows.append(d)
        for k, lim in BUDGET.items():
            v = d.get(k, -1)
            if v < 0:
                problems.append("[%s] %s 没量到" % (d["island"], k))
            elif v > lim:
                unit = "KB" if k == "criticalKB" else "ms"
                label = {"content": "看到内容", "interactive": "可点击",
                         "icons": "首屏图标画完", "criticalKB": "关键路径字节"}[k]
                problems.append("[%s] %s %d%s 超预算(≤%d%s)" % (d["island"], label, v, unit, lim, unit))
    return problems if problems else {"ok": rows}


if __name__ == "__main__":
    res = run()
    if isinstance(res, dict):
        print("✅ 加载性能守卫 (模拟 4G + gzip · 和用户手机上的 CloudBase 一致):")
        for d in res["ok"]:
            print("   %-24s 看到内容 %4dms · 可点击 %4dms · 首屏图标画完 %4dms · 关键路径 %4dKB/%d个请求"
                  % (d["island"], d["content"], d["interactive"], d["icons"], d["criticalKB"], d["requests"]))
        sys.exit(0)
    print("❌ 加载性能守卫: %d 项超标, 拒绝打包" % len(res))
    for p in res[:10]:
        print("   - " + p)
    sys.exit(1)
